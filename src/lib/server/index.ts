import { db, initializeDatabase, type TodoItem, type TodoSection, type NewTodoItem, type NewTodoSection } from '$lib/server/db/index'
import z from 'zod'
import { eq, like, and, count, sql, inArray } from 'drizzle-orm'
import { createHTTPServer } from "@trpc/server/adapters/standalone"
import { publicProcedure, protectedProcedure, router, type Context } from '$lib/server/db/trpc'
import { sections, todos, authenticatedSessions, changelog } from '$lib/server/db/schema'
import { getSpeech, getText, sendLLMMessage } from '$lib/server/llm'
import { env } from '$env/dynamic/private'
import { validateCredentials } from '$lib/server/auth'

let listenPort = 3000

// ===== INTERNAL SESSION MANAGEMENT =====

/**
 * Create a new session
 */
export async function createSession(options?: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    expirationDays?: number;
}): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expirationDays = options?.expirationDays || 7;
    const expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);

    await db.insert(authenticatedSessions).values({
        id: sessionId,
        userId: options?.userId || null,
        createdAt: now,
        expiresAt: expiresAt,
        lastAccessedAt: now,
        ipAddress: options?.ipAddress || null,
        userAgent: options?.userAgent || null,
    });

    return sessionId;
}

/**
 * Validate a session and update last accessed time
 */
export async function validateSessionInDb(sessionId: string): Promise<boolean> {
    const now = new Date();

    const result = await db.select()
        .from(authenticatedSessions)
        .where(eq(authenticatedSessions.id, sessionId));

    if (result.length === 0) {
        return false;
    }

    const session = result[0];

    // Check if session has expired
    if (session.expiresAt < now) {
        // Clean up expired session
        await db.delete(authenticatedSessions)
            .where(eq(authenticatedSessions.id, sessionId));
        return false;
    }

    // Update last accessed time (sliding expiration)
    await db.update(authenticatedSessions)
        .set({ lastAccessedAt: now })
        .where(eq(authenticatedSessions.id, sessionId));

    return true;
}

/**
 * Destroy a session
 */
export async function destroySessionInDb(sessionId: string): Promise<boolean> {
    const result = await db.delete(authenticatedSessions)
        .where(eq(authenticatedSessions.id, sessionId));
    return result.changes > 0;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const result = await db.delete(authenticatedSessions)
        .where(sql`${authenticatedSessions.expiresAt} < ${now}`);
    return result.changes;
}

// ===== CHANGELOG OPERATIONS =====

/**
 * Add a changelog entry
 * Removes any inactive entries prior to adding a new one
 */
async function addChangelogEntry(
    entityType: string,
    entityId: number,
    previousState: string | null,
    newState: string | null
): Promise<void> {
    // Remove inactive entries
    await db.delete(changelog).where(eq(changelog.isActive, false));

    // Add new entry
    await db.insert(changelog).values({
        entityType,
        entityId,
        previousState,
        newState,
        timestamp: new Date()
    });
}

/**
 * Set changelog entry active state
 */
async function setChangelogEntryActiveState(id: number, isActive: boolean): Promise<boolean> {
    const result = await db.update(changelog)
        .set({ isActive })
        .where(eq(changelog.id, id));
    return result.changes > 0;
}

/**
 * Get the latest active changelog entry
 */
async function getLatestActiveChangelogEntry() {
    const output = await db.select().from(changelog).where(eq(changelog.isActive, true)).orderBy(sql`${changelog.id} DESC`).limit(1);
    return output[0] || null;
}

/**
 * Get the most recently undone changelog entry
 */
async function getLatestUndoneChangelogEntry() {
    const output = await db.select().from(changelog).where(eq(changelog.isActive, false)).orderBy(sql`${changelog.id} ASC`).limit(1);
    return output[0] || null;
}


// ===== SECTION OPERATIONS =====

/**
 * Get section by its id
 */
export async function getSectionById(id: number): Promise<TodoSection | null> {
    const output = await db.select().from(sections).where(eq(sections.id, id));
    return output[0] || null;
}

/**
 * Get all sections
 */
export async function getSections(): Promise<TodoSection[]> {
    const output = await db.select().from(sections);
    return output;
}

/**
 * Get all sections with their todos
 */
export async function getSectionsWithTodos(): Promise<(TodoSection & { todos: TodoItem[] })[]> {
    const [sectionsData, todosData] = await Promise.all([
        db.select().from(sections),
        db.select().from(todos)
    ]);

    const todosBySection = todosData.reduce((acc, todo) => {
        if (!acc[todo.sectionId]) {
            acc[todo.sectionId] = [];
        }
        acc[todo.sectionId].push(todo);
        return acc;
    }, {} as Record<number, TodoItem[]>);

    return sectionsData
        .sort((a, b) => a.order - b.order)
        .map(section => ({
            ...section,
            todos: (todosBySection[section.id] || []).sort((a, b) => a.order - b.order)
        }));
}

/**
 * Get all sections with their todos grouped by priority
 */
export async function getSectionsWithTodosPriority(): Promise<(TodoSection & { priorities: Record<number, TodoItem[]> })[]> {
    const [sectionsData, todosData] = await Promise.all([
        db.select().from(sections),
        db.select().from(todos)
    ]);

    const todosByPriorityBySection = todosData.reduce((acc, todo) => {
        if (!acc[todo.sectionId]) {
            acc[todo.sectionId] = {};
        }
        if (!acc[todo.sectionId][todo.priority]) {
            acc[todo.sectionId][todo.priority] = [];
        }
        acc[todo.sectionId][todo.priority].push(todo);
        return acc;
    }, {} as Record<number, Record<number, TodoItem[]>>);

    return sectionsData
        .sort((a, b) => a.order - b.order)
        .map(section => {
            const sectionPriorities = todosByPriorityBySection[section.id] || {};
            const sortedPriorities: Record<number, TodoItem[]> = {};
            
            for (const [priority, todos] of Object.entries(sectionPriorities)) {
                sortedPriorities[Number(priority)] = todos.sort((a, b) => a.order - b.order);
            }
            
            return {
                ...section,
                priorities: sortedPriorities
            };
        });
}

/**
 * Create a new section
 */
export async function createSection(data: NewTodoSection): Promise<TodoSection> {
    const output = await db.insert(sections).values(data).returning();
    const newSection = output[0];

    await addChangelogEntry('section', newSection.id, null, JSON.stringify(newSection));

    return newSection;
}

/**
 * Update an existing section
 */
export async function updateSection(id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
    const previousState = await getSectionById(id);
    
    const output = await db.update(sections)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(sections.id, id))
        .returning();
    
    const updatedSection = output[0] || null;
    
    if (updatedSection) {
        await addChangelogEntry('section', id, JSON.stringify(previousState), JSON.stringify(updatedSection));
    }
    
    return updatedSection;
}

/**
 * Delete a section and optionally move its todos
 */
export async function deleteSection(id: number, moveToSectionId?: number): Promise<boolean> {
    const previousState = await getSectionById(id);

    if (moveToSectionId) {
        await db.update(todos)
            .set({ sectionId: moveToSectionId, updatedAt: new Date() })
            .where(eq(todos.sectionId, id));
    } else {
        await db.delete(todos).where(eq(todos.sectionId, id));
    }

    const result = await db.delete(sections).where(eq(sections.id, id));
    const success = result.changes > 0;
    
    if (success) {
        await addChangelogEntry('section', id, JSON.stringify(previousState), null);
    }
    
    return success;
}

// ===== TODO OPERATIONS =====

/**
 * Get all todos
 */
export async function getTodos(): Promise<TodoItem[]> {
    const output = await db.select().from(todos);
    return output;
}

/**
 * Get all todos by section id
 */
export async function getTodosBySectionId(sectionId: number): Promise<TodoItem[]> {
    const output = await db.select().from(todos).where(eq(todos.sectionId, sectionId));
    return output;
}

/**
 * Get a specific todo by ID
 */
export async function getTodoById(id: number): Promise<TodoItem | null> {
    const result = await db.select().from(todos).where(eq(todos.id, id));
    return result.length > 0 ? result[0] : null;
}

/**
 * Find todos by text search
 */
export async function findTodosByText(text: string, sectionId?: number): Promise<TodoItem[]> {
    const conditions = [like(todos.text, `%${text}%`)];
    if (sectionId) {
        conditions.push(eq(todos.sectionId, sectionId));
    }
    
    return await db.select().from(todos).where(and(...conditions));
}

/**
 * Create a new todo item
 */
export async function createTodo(data: NewTodoItem): Promise<TodoItem> {
    const output = await db.insert(todos).values(data).returning();
    const newTodo = output[0];

    await addChangelogEntry('todo', newTodo.id, null, JSON.stringify(newTodo));

    return newTodo;
}

/**
 * Update an existing todo
 */
export async function updateTodo(id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
    const previousState = await getTodoById(id);
    
    const output = await db.update(todos)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(todos.id, id))
        .returning();
    
    const updatedTodo = output[0] || null;
    
    if (updatedTodo) {
        await addChangelogEntry('todo', id, JSON.stringify(previousState), JSON.stringify(updatedTodo));
    }
    
    return updatedTodo;
}

/**
 * Delete a todo item
 */
export async function deleteTodo(id: number): Promise<boolean> {
    const previousState = await getTodoById(id);
    
    const result = await db.delete(todos).where(eq(todos.id, id));
    const success = result.changes > 0;
    
    if (success) {
        await addChangelogEntry('todo', id, JSON.stringify(previousState), null);
    }
    
    return success;
}

/**
 * Move todos to a different section
 */
export async function moveTodos(todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
    const output = await db.update(todos)
        .set({ sectionId: targetSectionId, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    return output;
}

/**
 * Mark todos as completed/incomplete
 */
export async function markTodosCompleted(todoIds: number[], completed: boolean): Promise<TodoItem[]> {
    const output = await db.update(todos)
        .set({ completed, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    return output;
}

/**
 * Set priority for multiple todos
 */
export async function setTodosPriority(todoIds: number[], priority: number): Promise<TodoItem[]> {
    const output = await db.update(todos)
        .set({ priority, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    return output;
}

/**
 * Set due date for todos
 */
export async function setTodosDueDate(todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
    const output = await db.update(todos)
        .set({ dueDate, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    return output;
}

/**
 * Get todo statistics
 */
export async function getTodoStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    byPriority: Record<string, number>;
    bySections: Record<string, number>;
}> {
    const now = new Date();
    
    const totalTodos = await db.select({ count: count() }).from(todos);
    const completedTodos = await db.select({ count: count() }).from(todos).where(eq(todos.completed, true));
    const overdueTodos = await db.select({ count: count() }).from(todos)
        .where(and(eq(todos.completed, false), sql`${todos.dueDate} < ${now}`));
    
    const priorityCounts = await db.select({ 
        priority: todos.priority, 
        count: count() 
    }).from(todos).groupBy(todos.priority);
    
    const sectionCounts = await db.select({ 
        sectionId: todos.sectionId, 
        count: count() 
    }).from(todos).groupBy(todos.sectionId);
    
    const total = totalTodos[0]?.count || 0;
    const completed = completedTodos[0]?.count || 0;
    const overdue = overdueTodos[0]?.count || 0;
    
    const byPriority: Record<string, number> = {};
    priorityCounts.forEach(p => {
        const label = p.priority === 1 ? 'high' : p.priority === -1 ? 'low' : 'medium';
        byPriority[label] = p.count;
    });
    
    const bySections: Record<string, number> = {};
    sectionCounts.forEach(s => {
        bySections[s.sectionId.toString()] = s.count;
    });
    
    return {
        total,
        completed,
        pending: total - completed,
        overdue,
        byPriority,
        bySections
    };
}

/**
 * Convert date strings to Date objects in parsed JSON
 */
function parseDates<T extends Record<string, any>>(obj: T): T {
    const result = { ...obj };
    for (const key in result) {
        if (result[key] && typeof result[key] === 'string') {
            // Check if it looks like an ISO date string
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(result[key])) {
                result[key] = new Date(result[key]) as any;
            }
        }
    }
    return result;
}

/**
 * Undo the last change
 */
export async function undo(): Promise<boolean> {
    const latestEntry = await getLatestActiveChangelogEntry();
    if (!latestEntry) {
        return false;
    }

    if (latestEntry.entityType === 'todo') {
        if (!latestEntry.newState && latestEntry.previousState) {
            // It was deleted, so recreate (without original ID to avoid conflicts)
            const prevTodo: TodoItem = parseDates(JSON.parse(latestEntry.previousState));
            const { id, ...todoWithoutId } = prevTodo;
            const [recreated] = await db.insert(todos).values(todoWithoutId).returning();
            // Update changelog to track the new ID
            await db.update(changelog)
                .set({ entityId: recreated.id })
                .where(eq(changelog.id, latestEntry.id));
        }

        if (!latestEntry.previousState && latestEntry.newState) {
            // It was created, so delete (without logging)
            await db.delete(todos).where(eq(todos.id, latestEntry.entityId));
        }

        if (latestEntry.previousState && latestEntry.newState) {
            // It was updated, so revert (without logging)
            const prevTodo: TodoItem = parseDates(JSON.parse(latestEntry.previousState));
            await db.update(todos)
                .set({ ...prevTodo, updatedAt: new Date() })
                .where(eq(todos.id, latestEntry.entityId));
        }
    }

    if (latestEntry.entityType === 'section') {
        if (!latestEntry.newState && latestEntry.previousState) {
            // It was deleted, so recreate (without original ID to avoid conflicts)
            const prevSection: TodoSection = parseDates(JSON.parse(latestEntry.previousState));
            const { id, ...sectionWithoutId } = prevSection;
            const [recreated] = await db.insert(sections).values(sectionWithoutId).returning();
            // Update changelog to track the new ID
            await db.update(changelog)
                .set({ entityId: recreated.id })
                .where(eq(changelog.id, latestEntry.id));
        }

        if (!latestEntry.previousState && latestEntry.newState) {
            // It was created, so delete (without logging)
            await db.delete(sections).where(eq(sections.id, latestEntry.entityId));
        }

        if (latestEntry.previousState && latestEntry.newState) {
            // It was updated, so revert (without logging)
            const prevSection: TodoSection = parseDates(JSON.parse(latestEntry.previousState));
            await db.update(sections)
                .set({ ...prevSection, updatedAt: new Date() })
                .where(eq(sections.id, latestEntry.entityId));
        }
    }

    await setChangelogEntryActiveState(latestEntry.id, false);
    return true;
}

export async function redo(): Promise<boolean> {
    const latestUndoneEntry = await getLatestUndoneChangelogEntry();

    if (!latestUndoneEntry) {
        return false;
    }

    if (latestUndoneEntry.entityType === 'todo') {
        if (!latestUndoneEntry.previousState && latestUndoneEntry.newState) {
            // It was created, so recreate (without original ID to avoid conflicts)
            const newTodo: TodoItem = parseDates(JSON.parse(latestUndoneEntry.newState));
            const { id, ...todoWithoutId } = newTodo;
            const [recreated] = await db.insert(todos).values(todoWithoutId).returning();
            // Update changelog to track the new ID
            await db.update(changelog)
                .set({ entityId: recreated.id })
                .where(eq(changelog.id, latestUndoneEntry.id));
        }

        if (latestUndoneEntry.previousState && !latestUndoneEntry.newState) {
            // It was deleted, so delete again (without logging)
            await db.delete(todos).where(eq(todos.id, latestUndoneEntry.entityId));
        }

        if (latestUndoneEntry.previousState && latestUndoneEntry.newState) {
            // It was updated, so reapply the update (without logging)
            const newTodo: TodoItem = parseDates(JSON.parse(latestUndoneEntry.newState));
            await db.update(todos)
                .set({ ...newTodo, updatedAt: new Date() })
                .where(eq(todos.id, latestUndoneEntry.entityId));
        }
    }

    if (latestUndoneEntry.entityType === 'section') {
        if (!latestUndoneEntry.previousState && latestUndoneEntry.newState) {
            // It was created, so recreate (without original ID to avoid conflicts)
            const newSection: TodoSection = parseDates(JSON.parse(latestUndoneEntry.newState));
            const { id, ...sectionWithoutId } = newSection;
            const [recreated] = await db.insert(sections).values(sectionWithoutId).returning();
            // Update changelog to track the new ID
            await db.update(changelog)
                .set({ entityId: recreated.id })
                .where(eq(changelog.id, latestUndoneEntry.id));
        }

        if (latestUndoneEntry.previousState && !latestUndoneEntry.newState) {
            // It was deleted, so delete again (without logging)
            await db.delete(sections).where(eq(sections.id, latestUndoneEntry.entityId));
        }

        if (latestUndoneEntry.previousState && latestUndoneEntry.newState) {
            // It was updated, so reapply the update (without logging)
            const newSection: TodoSection = parseDates(JSON.parse(latestUndoneEntry.newState));
            await db.update(sections)
                .set({ ...newSection, updatedAt: new Date() })
                .where(eq(sections.id, latestUndoneEntry.entityId));
        }
    }

    await setChangelogEntryActiveState(latestUndoneEntry.id, true);
    return true;
}

// ===== TRPC ROUTER =====

const appRouter = router({
    // Get all TODOs
    todos: protectedProcedure.query(async () => {
        return await getTodos();
    }),

    // Get all TODOs matching the given section id
    todosBySectionId: protectedProcedure.input(z.int()).query(async (opts) => {
        return await getTodosBySectionId(opts.input);
    }),

    // Get the TODO with the given id
    todoById: protectedProcedure.input(z.int()).query(async (opts) => {
        const todo = await getTodoById(opts.input);
        return todo ? [todo] : [];
    }),

    // Create a todo with the given state
    todoCreate: protectedProcedure.input(z.object({sectionId: z.int(), text: z.string(), priority: z.int(), completed: z.boolean()})).mutation(async (opts) => {
        return await createTodo(opts.input);
    }),

    // Get section by id
    sectionById: publicProcedure.input(z.int()).query(async (opts) => {
        return await getSectionById(opts.input);
    }),

    // Get all sections
    sections: protectedProcedure.query(async () => {
        return await getSections();
    }),

    // Create a section with the given state
    sectionCreate: protectedProcedure.input(z.object({name: z.string()})).mutation(async (opts) => {
        return await createSection(opts.input);
    }),

    // Update a section
    sectionUpdate: protectedProcedure.input(z.object({
        id: z.number(),
        name: z.string().optional(),
        order: z.number().optional()
    })).mutation(async (opts) => {
        const { id, ...updates } = opts.input;
        return await updateSection(id, updates);
    }),

    // Delete a section
    sectionDelete: protectedProcedure.input(z.object({
        id: z.number(),
        moveToSectionId: z.number().optional()
    })).mutation(async (opts) => {
        const { id, moveToSectionId } = opts.input;
        return await deleteSection(id, moveToSectionId);
    }),

    // Update a todo
    todoUpdate: protectedProcedure.input(z.object({
        id: z.number(),
        text: z.string().optional(),
        completed: z.boolean().optional(),
        priority: z.number().optional(),
        sectionId: z.number().optional(),
        order: z.number().optional(),
        dueDate: z.date().optional().nullable()
    })).mutation(async (opts) => {
        const { id, ...updates } = opts.input;
        return await updateTodo(id, updates);
    }),

    // Delete a todo
    todoDelete: protectedProcedure.input(z.number()).mutation(async (opts) => {
        return await deleteTodo(opts.input);
    }),

    // Find todos by text search
    todosFindByText: protectedProcedure.input(z.object({
        text: z.string(),
        sectionId: z.number().optional()
    })).query(async (opts) => {
        const { text, sectionId } = opts.input;
        return await findTodosByText(text, sectionId);
    }),

    // Move multiple todos to a different section
    todosMoveToSection: protectedProcedure.input(z.object({
        todoIds: z.array(z.number()),
        targetSectionId: z.number()
    })).mutation(async (opts) => {
        const { todoIds, targetSectionId } = opts.input;
        return await moveTodos(todoIds, targetSectionId);
    }),

    // Mark multiple todos as completed/incomplete
    todosMarkCompleted: protectedProcedure.input(z.object({
        todoIds: z.array(z.number()),
        completed: z.boolean()
    })).mutation(async (opts) => {
        const { todoIds, completed } = opts.input;
        return await markTodosCompleted(todoIds, completed);
    }),

    // Set priority for multiple todos
    todosSetPriority: protectedProcedure.input(z.object({
        todoIds: z.array(z.number()),
        priority: z.number()
    })).mutation(async (opts) => {
        const { todoIds, priority } = opts.input;
        return await setTodosPriority(todoIds, priority);
    }),

    // Set due date for multiple todos
    todosSetDueDate: protectedProcedure.input(z.object({
        todoIds: z.array(z.number()),
        dueDate: z.date().nullable()
    })).mutation(async (opts) => {
        const { todoIds, dueDate } = opts.input;
        return await setTodosDueDate(todoIds, dueDate);
    }),

    // Text to speech
    textToSpeech: protectedProcedure.input(z.string()).query(async (opts) => {
        const { input } = opts

        return await getSpeech(input)
    }),

    // Speech to text
    speechToText: protectedProcedure.query(async () => {
        return await getText()
    }),

    // Save audio for speech to text
    saveAudio: protectedProcedure.input(z.string()).mutation(async (opts) => {
        const { input } = opts
        const fs = await import('fs')
        
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(input, 'base64')
        
        // Save to the expected location
        const filePath = 'data/message.wav'
        await fs.promises.writeFile(filePath, audioBuffer)
        
        return { success: true, filePath }
    }),

    // Get todo statistics
    todoStats: protectedProcedure.query(async () => {
        return await getTodoStats();
    }),

    // Undo last change
    undo: protectedProcedure.mutation(async () => {
        return await undo();
    }),

    // Redo last undone change
    redo: protectedProcedure.mutation(async () => {
        return await redo();
    }),

    llmMessage: protectedProcedure.input(z.string()).query(async (opts) => {
        const { input, ctx } = opts

        let response = await sendLLMMessage(input, ctx.sessionId!)
        return response
    }),

    validateCredentials: publicProcedure.input(z.object({username: z.string(), password: z.string()})).query(async (opts) => {
        const { username, password } = opts.input;
        const valid = validateCredentials(username, password);

        if (valid) {
            return await createSession();
        } else {
            return null;
        }
    }),

    logout: protectedProcedure.mutation(async (opts) => {
        const { ctx } = opts;
        if (ctx.sessionId) {
            await destroySessionInDb(ctx.sessionId);
        }
        return { success: true };
    }),

    // Session management procedures (internal use)
    sessionCreate: publicProcedure.input(z.object({
        userId: z.string().optional(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
        expirationDays: z.number().default(7)
    })).mutation(async (opts) => {
        return await createSession(opts.input);
    }),

    sessionValidate: publicProcedure.input(z.string()).query(async (opts) => {
        const valid = await validateSessionInDb(opts.input);
        return { valid };
    }),

    sessionDestroy: publicProcedure.input(z.string()).mutation(async (opts) => {
        return await destroySessionInDb(opts.input);
    }),

    sessionCleanup: publicProcedure.mutation(async () => {
        const deletedCount = await cleanupExpiredSessions();
        return { deletedCount };
    }),
})

const server = createHTTPServer({
    router: appRouter,
    createContext(opts) {
        // Check for session in header first (for internal calls), then fall back to cookie
        const headerSessionId = opts.req.headers['x-session-id'] as string | undefined;
        
        if (headerSessionId) {
            return {
                sessionId: headerSessionId,
            } satisfies Context;
        }
        
        // Extract session from cookie header
        const cookieHeader = opts.req.headers.cookie || '';
        const cookies: Record<string, string> = {};
        
        if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
                const [key, ...valueParts] = cookie.trim().split('=');
                if (key) {
                    cookies[key] = valueParts.join('=');
                }
            });
        }
        
        return {
            sessionId: cookies.guppy_session,
        } satisfies Context;
    },
    middleware: (req, res, next) => {
        const origin = req.headers.origin;
        
        // Determine if origin is allowed
        let isAllowed = false;
        
        if (!origin) {
            // Allow requests with no origin
            isAllowed = true;
        } else if (env.NODE_ENV === 'production') {
            const allowedPatterns = [
                /^https:\/\/.*$/, // Any HTTPS origin
                /^http:\/\/.*$/, // TODO: TEMPORARY: allow HTTP for testing ONLY
                /^http:\/\/localhost(:\d+)?$/, // localhost with any port
                /^http:\/\/127\.0\.0\.1(:\d+)?$/, // 127.0.0.1 with any port
            ];
            isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
        } else {
            const allowedOrigins = [
                'http://localhost:4173', // SvelteKit preview
                'http://localhost:5173', // SvelteKit dev
                'http://127.0.0.1:4173',
                'http://127.0.0.1:5173',
                'http://localhost:80', // Docker SvelteKit server
                'http://127.0.0.1:80',
                'http://localhost:3000', // Localhost tRPC server
                'http://127.0.0.1:3000',
            ];
            isAllowed = allowedOrigins.includes(origin);
        }
        
        if (isAllowed && origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, trpc-batch-mode, x-session-id');
        }
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        
        next();
    }
})

export type AppRouter = typeof appRouter;
// TODO: export other useful types maybe

export async function startServer() {
    try {
        // await initializeDatabase();
        server.listen(listenPort);
        console.log(`Server listening on port ${listenPort}`);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}