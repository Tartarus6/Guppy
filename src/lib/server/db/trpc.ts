import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '..';
import type { TodoSection, TodoItem, NewTodoSection, NewTodoItem } from '.';
import envProps from '../envProps';
import { db } from '.';
import { sections as sectionsTable, todos as todosTable } from './schema';
import { eq, like, and, inArray } from 'drizzle-orm';

// Define the context type
export type Context = {
	sessionId?: string;
};

/**
 * Initialization of tRPC backend with context
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
	transformer: superjson, // to fix date formatting issues
});

/**
 * Middleware to check if user is authenticated
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
	// Check if session is valid
	if (!ctx.sessionId) {
		throw new TRPCError({ 
			code: 'UNAUTHORIZED',
			message: 'Not authenticated'
		});
	}
	
	const valid = await validateSessionInDb(ctx.sessionId);
	if (!valid) {
		throw new TRPCError({ 
			code: 'UNAUTHORIZED',
			message: 'Not authenticated'
		});
	}
	
	return next({
		ctx: {
			...ctx,
			// sessionId is guaranteed to be valid here
		},
	});
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);

// Determine the API URL based on environment
const getApiUrl = () => {
    return "http://localhost:" + envProps.PORT;
};

// trpc router for internal use (unauthenticated - use getAuthenticatedTrpc for protected routes)
export const trpc = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: getApiUrl(),
            transformer: superjson,
        })
    ]
});

/**
 * Create an authenticated tRPC client for internal server calls
 */
export function getAuthenticatedTrpc(sessionId: string) {
    return createTRPCProxyClient<AppRouter>({
        links: [
            httpBatchLink({
                url: getApiUrl(),
                transformer: superjson,
                headers: () => ({
                    'x-session-id': sessionId,
                }),
            })
        ]
    });
}

/**
 * Get all sections with their todos
 */
export async function getSectionsWithTodos(): Promise<(TodoSection & { todos: TodoItem[] })[]> {
    // Get all sections and todos in parallel using direct DB access
    const [sectionsData, todosData] = await Promise.all([
        db.select().from(sectionsTable),
        db.select().from(todosTable)
    ]);

    // Group todos by section
    const todosBySection = todosData.reduce((acc, todo) => {
        if (!acc[todo.sectionId]) {
            acc[todo.sectionId] = [];
        }
        acc[todo.sectionId].push(todo);
        return acc;
    }, {} as Record<number, TodoItem[]>);

    // Combine sections with their todos
    return sectionsData
        .sort((a, b) => a.order - b.order)
        .map(section => ({
            ...section,
            todos: (todosBySection[section.id] || []).sort((a, b) => a.order - b.order)
        }));
}

export async function getSectionsWithTodosPriority(sessionId: string): Promise<(TodoSection & { priorities: Record<number, TodoItem[]> })[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    // Get all sections and todos in parallel
    const [sectionsData, todosData] = await Promise.all([
        authenticatedTrpc.sections.query(),
        authenticatedTrpc.todos.query()
    ]);

    // Group todos by section
    const todosByPriorityBySection = todosData.reduce((acc, todo) => {
        if (!acc[todo.sectionId]) {
            acc[todo.sectionId] = [];
        }
        if (!acc[todo.sectionId][todo.priority]) {
            acc[todo.sectionId][todo.priority] = []
        }
        acc[todo.sectionId][todo.priority].push(todo);
        return acc;
    }, {} as Record<number, Record<number, TodoItem[]>>);

    // Combine sections with their todos
    return sectionsData
        .sort((a, b) => a.order - b.order)
        .map(section => {
            const sectionPriorities = todosByPriorityBySection[section.id] || {};
            const sortedPriorities: Record<number, TodoItem[]> = {};
            
            // Sorting todos by order within priority
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
 * Get all sections
 */
export async function getSections(sessionId: string): Promise<TodoSection[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.sections.query()
    return output
}

/**
 * Create a new section
 */
export async function createSection(sessionId: string, data: NewTodoSection): Promise<TodoSection> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.sectionCreate.mutate(data)
    // sectionsContext.refreshSections()
    return output
}

/**
 * Update an existing section
 * 'id', 'createdAt', and 'updatedAt' are omitted since they shouldn't be modified or are handled by the server
 */
export async function updateSection(sessionId: string, id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    // Filter out updatedAt since it's handled on the server side
    const output = await authenticatedTrpc.sectionUpdate.mutate({ id, ...updates });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Delete a section and optionally move its todos
 */
export async function deleteSection(sessionId: string, id: number, moveToSectionId?: number): Promise<boolean> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.sectionDelete.mutate({ id, moveToSectionId });
    // sectionsContext.refreshSections()
    return output
}

// ===== TODO OPERATIONS =====

/**
 * Get all todos, optionally filtered by section
 */
export async function getTodos(sessionId: string, sectionId?: number, includeCompleted = true): Promise<TodoItem[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    let output
    if (sectionId) {
        output = await authenticatedTrpc.todosBySectionId.query(sectionId)
    } else {
        output = await authenticatedTrpc.todos.query()
    }
    
    return output
}

/**
 * Get a specific todo by ID
 */
export async function getTodoById(sessionId: string, id: number): Promise<TodoItem | null> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const result = await authenticatedTrpc.todoById.query(id);
    return result.length > 0 ? result[0] : null;
}

/**
 * Find todos by text (for LLM tool operations)
 */
export async function findTodosByText(sessionId: string, text: string, sectionId?: number): Promise<TodoItem[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    return await authenticatedTrpc.todosFindByText.query({ text, sectionId });
}

/**
 * Create a new todo item
 */
export async function createTodo(sessionId: string, data: NewTodoItem): Promise<TodoItem> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todoCreate.mutate(data)
    // sectionsContext.refreshSections()
    return output
}

/**
 * Update an existing todo
 */
export async function updateTodo(sessionId: string, id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todoUpdate.mutate({ id, ...updates });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Delete a todo item
 */
export async function deleteTodo(sessionId: string, id: number): Promise<boolean> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todoDelete.mutate(id);
    // sectionsContext.refreshSections()
    return output
}

/**
 * Move todos to a different section
 */
export async function moveTodos(sessionId: string, todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todosMoveToSection.mutate({ todoIds, targetSectionId });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Mark todos as completed/incomplete
 */
export async function markTodosCompleted(sessionId: string, todoIds: number[], completed: boolean): Promise<TodoItem[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todosMarkCompleted.mutate({ todoIds, completed });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Set priority for multiple todos
 */
export async function setTodosPriority(sessionId: string, todoIds: number[], priority: number): Promise<TodoItem[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todosSetPriority.mutate({ todoIds, priority });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Set due date for todos
 */
export async function setTodosDueDate(sessionId: string, todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
    const authenticatedTrpc = getAuthenticatedTrpc(sessionId);
    const output = await authenticatedTrpc.todosSetDueDate.mutate({ todoIds, dueDate });
    // sectionsContext.refreshSections()
    return output
}

// ===== SESSION OPERATIONS =====

/**
 * Create a new session
 */
export async function createSession(options?: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    expirationDays?: number;
}): Promise<string> {
    return await trpc.sessionCreate.mutate({
        userId: options?.userId,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
        expirationDays: options?.expirationDays || 7
    });
}

/**
 * Validate a session and update last accessed time
 */
export async function validateSessionInDb(sessionId: string): Promise<boolean> {
    const result = await trpc.sessionValidate.query(sessionId);
    return result.valid;
}

/**
 * Destroy a session
 */
export async function destroySessionInDb(sessionId: string): Promise<boolean> {
    return await trpc.sessionDestroy.mutate(sessionId);
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const result = await trpc.sessionCleanup.mutate();
    return result.deletedCount;
}
