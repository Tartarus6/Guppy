import { db, initializeDatabase, type TodoItem, type TodoSection, type NewTodoItem, type NewTodoSection } from '$lib/server/db/index'
import z from 'zod'
import { eq, like, and, count, sql, inArray } from 'drizzle-orm'
import { createHTTPServer } from "@trpc/server/adapters/standalone"
import { publicProcedure, protectedProcedure, router, type Context } from '$lib/server/db/trpc'
import { sections, todos, authenticatedSessions, changelog } from '$lib/server/db/schema'
import { getSpeech, getText, sendLLMMessage } from '$lib/server/llm'
import envProps from '$lib/server/envProps'
import { validateCredentials } from '$lib/server/auth'

// Get port from environment or use default
const listenPort = parseInt(envProps.SERVER_PORT || '3000', 10)

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
 * Generate a unique batch ID for grouping related changes
 */
// TODO: Improve uniqueness
function generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a changelog entry for an operation
 * Stores the inverse operation data needed to undo the change
 * Removes any inactive entries prior to adding a new one (unless part of a batch)
 */
async function addChangelogEntry(
    operation: 'insert' | 'update' | 'delete',
    tableName: 'todos' | 'sections',
    entityId: number,
    data: object, // Data needed to undo: {} for insert, changed fields for update, full row for delete
    batchId?: string
): Promise<void> {
    // Only remove inactive entries if not part of a batch
    // (batches handle cleanup at batch level)
    if (!batchId) {
        await db.delete(changelog).where(eq(changelog.isActive, false));
    }

    console.log(`Changelog - Operation: ${operation}, Table: ${tableName}, Entity ID: ${entityId}, Batch ID: ${batchId || 'N/A'}`);

    // Add new entry
    await db.insert(changelog).values({
        operation,
        tableName,
        entityId,
        data: JSON.stringify(data),
        batchId: batchId || null,
        timestamp: new Date()
    });
}

/**
 * Set changelog entry active state
 */
async function setChangelogEntryActiveState(id: number, isActive: boolean): Promise<boolean> {
    console.log(`Setting changelog entry ID ${id} active state to ${isActive}`);

    const result = await db.update(changelog)
        .set({ isActive })
        .where(eq(changelog.id, id));
    return result.changes > 0;
}

/**
 * Get the latest active changelog entry or batch of entries
 */
async function getLatestActiveChangelogEntry() {
    const latest = await db.select().from(changelog)
        .where(eq(changelog.isActive, true))
        .orderBy(sql`${changelog.id} DESC`)
        .limit(1);
    
    // If there's no active, return null
    if (!latest[0]) return null;
    
    // If this entry is part of a batch, return all entries in that batch
    if (latest[0].batchId) {
        return await db.select().from(changelog)
            .where(and(
                eq(changelog.isActive, true),
                eq(changelog.batchId, latest[0].batchId)
            ))
            .orderBy(sql`${changelog.id} ASC`);
    }
    
    // Otherwise return just the single entry as an array for consistent handling
    return [latest[0]];
}

/**
 * Get the most recently undone changelog entry or batch of entries
 */
async function getLatestUndoneChangelogEntry() {
    const latest = await db.select().from(changelog)
        .where(eq(changelog.isActive, false))
        .orderBy(sql`${changelog.id} DESC`)
        .limit(1);
    
    if (!latest[0]) return null;
    
    // If this entry is part of a batch, return all entries in that batch
    if (latest[0].batchId) {
        return await db.select().from(changelog)
            .where(and(
                eq(changelog.isActive, false),
                eq(changelog.batchId, latest[0].batchId)
            ))
            .orderBy(sql`${changelog.id} ASC`);
    }
    
    // Otherwise return just the single entry as an array for consistent handling
    return [latest[0]];
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

    // To undo an insert, we just need to delete by ID (no data needed)
    await addChangelogEntry('insert', 'sections', newSection.id, newSection);

    return newSection;
}

/**
 * Update an existing section
 */
export async function updateSection(id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
    const previousState = await getSectionById(id);
    if (!previousState) return null;
    
    // Track fields that are being changed (with both OLD and NEW values)
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    for (const [key, newValue] of Object.entries(updates)) {
        if (previousState[key as keyof TodoSection] !== newValue) {
            oldValues[key] = previousState[key as keyof TodoSection];
            newValues[key] = newValue;
        }
    }
    
    const output = await db.update(sections)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(sections.id, id))
        .returning();
    
    const updatedSection = output[0] || null;
    
    if (updatedSection && Object.keys(oldValues).length > 0) {
        // Store both old and new values for undo/redo
        await addChangelogEntry('update', 'sections', id, { old: oldValues, new: newValues });
    }
    
    return updatedSection;
}

/**
 * Delete a section and optionally move its todos
 */
export async function deleteSection(id: number, moveToSectionId?: number): Promise<boolean> {
    const previousSectionState = await getSectionById(id);
    if (!previousSectionState) return false;
    
    const previousTodos = await getTodosBySectionId(id);

    // Generate a batch ID to group this operation
    const batchId = generateBatchId();
    
    // Clean up inactive entries once for the entire batch
    await db.delete(changelog).where(eq(changelog.isActive, false));

    if (moveToSectionId) {
        await db.update(todos)
            .set({ sectionId: moveToSectionId, updatedAt: new Date() })
            .where(eq(todos.sectionId, id));
    } else {
        // Record each todo deletion as part of the batch (store full row to recreate)
        for (const todo of previousTodos) {
            await addChangelogEntry('delete', 'todos', todo.id, todo, batchId);
        }
        await db.delete(todos).where(eq(todos.sectionId, id));
    }

    const result = await db.delete(sections).where(eq(sections.id, id));
    const success = result.changes > 0;
    
    if (success) {
        // Record section deletion (store full row to recreate)
        await addChangelogEntry('delete', 'sections', id, previousSectionState, batchId);
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

    // To undo an insert, we just need to delete by ID (no data needed)
    await addChangelogEntry('insert', 'todos', newTodo.id, newTodo);

    return newTodo;
}

/**
 * Update an existing todo
 */
export async function updateTodo(id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
    const previousState = await getTodoById(id);
    if (!previousState) return null;
    
    // Track fields that are being changed (with both OLD and NEW values)
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    for (const [key, newValue] of Object.entries(updates)) {
        if (previousState[key as keyof TodoItem] !== newValue) {
            oldValues[key] = previousState[key as keyof TodoItem];
            newValues[key] = newValue;
        }
    }
    
    const output = await db.update(todos)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(todos.id, id))
        .returning();
    
    const updatedTodo = output[0] || null;
    
    if (updatedTodo && Object.keys(oldValues).length > 0) {
        // Store both old and new values for undo/redo
        await addChangelogEntry('update', 'todos', id, { old: oldValues, new: newValues });
    }
    
    return updatedTodo;
}

/**
 * Delete a todo item
 */
export async function deleteTodo(id: number): Promise<boolean> {
    const previousState = await getTodoById(id);
    if (!previousState) return false;
    
    const result = await db.delete(todos).where(eq(todos.id, id));
    const success = result.changes > 0;
    
    if (success) {
        // Store full row to recreate on undo
        await addChangelogEntry('delete', 'todos', id, previousState);
    }
    
    return success;
}

/**
 * Move todos to a different section
 */
export async function moveTodos(todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
    // Generate a batch ID to group this operation
    const batchId = generateBatchId();
    
    // Get previous state of all todos
    const previousStates = await db.select().from(todos).where(inArray(todos.id, todoIds));
    
    const result = await db.update(todos)
        .set({ sectionId: targetSectionId, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    // Record each todo update as part of the batch
    for (const todo of previousStates) {
        const oldValues = { sectionId: todo.sectionId };
        const newValues = { sectionId: targetSectionId };
        await addChangelogEntry('update', 'todos', todo.id, { old: oldValues, new: newValues }, batchId);
    }
    
    return result;
}

/**
 * Mark todos as completed/incomplete
 */
export async function markTodosCompleted(todoIds: number[], completed: boolean): Promise<TodoItem[]> {
    // Generate a batch ID to group this operation
    const batchId = generateBatchId();
    
    // Get previous state of all todos
    const previousStates = await db.select().from(todos).where(inArray(todos.id, todoIds));
    
    const result = await db.update(todos)
        .set({ completed, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    // Record each todo update as part of the batch
    for (const todo of previousStates) {
        const oldValues = { completed: todo.completed };
        const newValues = { completed };
        await addChangelogEntry('update', 'todos', todo.id, { old: oldValues, new: newValues }, batchId);
    }
    
    return result;
}

/**
 * Set priority for multiple todos
 */
export async function setTodosPriority(todoIds: number[], priority: number): Promise<TodoItem[]> {
    // Generate a batch ID to group this operation
    const batchId = generateBatchId();
        
    // Get previous state of all todos
    const previousStates = await db.select().from(todos).where(inArray(todos.id, todoIds));
    
    const result = await db.update(todos)
        .set({ priority, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    // Record each todo update as part of the batch
    for (const todo of previousStates) {
        const oldValues = { priority: todo.priority };
        const newValues = { priority };
        await addChangelogEntry('update', 'todos', todo.id, { old: oldValues, new: newValues }, batchId);
    }
    
    return result;
}

/**
 * Set due date for todos
 */
export async function setTodosDueDate(todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
    // Generate a batch ID to group this operation
    const batchId = generateBatchId();
    
    // Get previous state of all todos
    const previousStates = await db.select().from(todos).where(inArray(todos.id, todoIds));
    
    const result = await db.update(todos)
        .set({ dueDate, updatedAt: new Date() })
        .where(inArray(todos.id, todoIds))
        .returning();
    
    // Record each todo update as part of the batch
    for (const todo of previousStates) {
        const oldValues = { dueDate: todo.dueDate };
        const newValues = { dueDate };
        await addChangelogEntry('update', 'todos', todo.id, { old: oldValues, new: newValues }, batchId);
    }
    
    return result;
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
 * Undo the last change (handles both single entries and batches)
 * Much simpler now - just replays the inverse operation!
 */
export async function undo(): Promise<boolean> {
    const entries = await getLatestActiveChangelogEntry();
    if (!entries?.length) return false;

    // Process in reverse order (important for batches like deleting section + todos)
    // When undoing deletions, we need to recreate sections before todos (FK constraint)
    const sectionEntries = entries.filter(e => e.tableName === 'sections');
    const todoEntries = entries.filter(e => e.tableName === 'todos');
    const orderedEntries = [...sectionEntries.reverse(), ...todoEntries.reverse()];

    for (const entry of orderedEntries) {
        const data = JSON.parse(entry.data);
        const table = entry.tableName === 'todos' ? todos : sections;
        
        if (entry.operation === 'insert') {
            // Undo insert = delete by ID (the entity currently exists)
            await db.delete(table).where(eq(table.id, entry.entityId));
        }
        
        if (entry.operation === 'update') {
            // Undo update = restore old field values
            const oldValues = parseDates(data.old || data); // Support old format (just data) and new format (data.old)
            await db.update(table)
                .set({ ...oldValues, updatedAt: new Date() })
                .where(eq(table.id, entry.entityId));
        }
        
        if (entry.operation === 'delete') {
            // Undo delete = recreate with original ID
            // SQLite with AUTOINCREMENT never reuses IDs, so this is safe
            const parsedData = parseDates(data);
            if (entry.tableName === 'todos') {
                await db.insert(todos).values({ ...parsedData as TodoItem, id: entry.entityId });
            } else {
                await db.insert(sections).values({ ...parsedData as TodoSection, id: entry.entityId });
            }
        }
    }

    // Mark all entries as undone
    for (const entry of entries) {
        await setChangelogEntryActiveState(entry.id, false);
    }
    
    return true;
}

/**
 * Redo the last undone change (handles both single entries and batches)
 * Replays the original operation (inverse of undo)
 */
export async function redo(): Promise<boolean> {
    const entries = await getLatestUndoneChangelogEntry();
    if (!entries?.length) return false;

    // When redoing, we need to be careful about ordering:
    // - For deletions: delete todos before sections (FK constraint)
    // - For inserts: create sections before todos (FK constraint)
    const sectionEntries = entries.filter(e => e.tableName === 'sections');
    const todoEntries = entries.filter(e => e.tableName === 'todos');
    
    // Check if this batch contains deletions
    const hasDeletions = entries.some(e => e.operation === 'delete');
    const orderedEntries = hasDeletions
        ? [...todoEntries, ...sectionEntries]  // Delete todos before sections
        : [...sectionEntries, ...todoEntries]; // Create/update sections before todos

    for (const entry of orderedEntries) {
        const data = JSON.parse(entry.data);
        const table = entry.tableName === 'todos' ? todos : sections;
        
        console.log(`Redoing changelog entry ID ${entry.id}: Operation ${entry.operation} on table ${entry.tableName} for entity ID ${entry.entityId} with data: ${entry.data}`);

        if (entry.operation === 'insert') {
            // Redo insert = recreate it (undo deleted it)
            // Parse dates from the stored data
            const parsedData = parseDates(data);
            if (entry.tableName === 'todos') {
                await db.insert(todos).values({ ...parsedData as TodoItem, id: entry.entityId });
            } else {
                await db.insert(sections).values({ ...parsedData as TodoSection, id: entry.entityId });
            }
        }
        
        if (entry.operation === 'update') {
            // Redo update = reapply the new values
            const newValues = parseDates(data.new || {});
            if (Object.keys(newValues).length > 0) {
                await db.update(table)
                    .set({ ...newValues, updatedAt: new Date() })
                    .where(eq(table.id, entry.entityId));
            }
        }
        
        if (entry.operation === 'delete') {
            // Redo delete = delete again (undo recreated it)
            await db.delete(table).where(eq(table.id, entry.entityId));
        }
    }

    // Mark all entries as active again
    for (const entry of entries) {
        await setChangelogEntryActiveState(entry.id, true);
    }
    
    return true;
}

export async function clearChangelog(): Promise<void> {
    await db.delete(changelog);
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
        } else if (envProps.NODE_ENV === 'production') {
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
        clearChangelog().then(() => {
            console.log('Changelog cleared on server start.');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}