import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '..';
import type { TodoSection, TodoItem, NewTodoSection, NewTodoItem } from '.';
import envProps from '../envProps';


/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.create({
	transformer: superjson, // to fix date formatting issues
});
/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;

// Determine the API URL based on environment
const getApiUrl = () => {
    return "http://localhost:" + envProps.PORT;
};

// trpc router for internal use
export const trpc = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: getApiUrl(),
            transformer: superjson,
        })
    ]
});

/**
 * Get all sections with their todos
 */
export async function getSectionsWithTodos(): Promise<(TodoSection & { todos: TodoItem[] })[]> {
    // Get all sections and todos in parallel
    const [sectionsData, todosData] = await Promise.all([
        trpc.sections.query(),
        trpc.todos.query()
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

export async function getSectionsWithTodosPriority(): Promise<(TodoSection & { priorities: Record<number, TodoItem[]> })[]> {
            // Get all sections and todos in parallel
    const [sectionsData, todosData] = await Promise.all([
        trpc.sections.query(),
        trpc.todos.query()
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
export async function getSections(): Promise<TodoSection[]> {
    const output = await trpc.sections.query()
    return output
}

/**
 * Create a new section
 */
export async function createSection(data: NewTodoSection): Promise<TodoSection> {
    const output = await trpc.sectionCreate.mutate(data)
    // sectionsContext.refreshSections()
    return output
}

/**
 * Update an existing section
 * 'id', 'createdAt', and 'updatedAt' are omitted since they shouldn't be modified or are handled by the server
 */
export async function updateSection(id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
    // Filter out updatedAt since it's handled on the server side
    const output = await trpc.sectionUpdate.mutate({ id, ...updates });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Delete a section and optionally move its todos
 */
export async function deleteSection(id: number, moveToSectionId?: number): Promise<boolean> {
    const output = await trpc.sectionDelete.mutate({ id, moveToSectionId });
    // sectionsContext.refreshSections()
    return output
}

// ===== TODO OPERATIONS =====

/**
 * Get all todos, optionally filtered by section
 */
export async function getTodos(sectionId?: number, includeCompleted = true): Promise<TodoItem[]> {
    let output
    if (sectionId) {
        output = await trpc.todosBySectionId.query(sectionId)
    } else {
        output = await trpc.todos.query()
    }
    
    return output
}

/**
 * Get a specific todo by ID
 */
export async function getTodoById(id: number): Promise<TodoItem | null> {
    const result = await trpc.todoById.query(id);
    return result.length > 0 ? result[0] : null;
}

/**
 * Find todos by text (for LLM tool operations)
 */
export async function findTodosByText(text: string, sectionId?: number): Promise<TodoItem[]> {
    return await trpc.todosFindByText.query({ text, sectionId });
}

/**
 * Create a new todo item
 */
export async function createTodo(data: NewTodoItem): Promise<TodoItem> {
    const output = await trpc.todoCreate.mutate(data)
    // sectionsContext.refreshSections()
    return output
}

/**
 * Update an existing todo
 */
export async function updateTodo(id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
    const output = await trpc.todoUpdate.mutate({ id, ...updates });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Delete a todo item
 */
export async function deleteTodo(id: number): Promise<boolean> {
    const output = await trpc.todoDelete.mutate(id);
    // sectionsContext.refreshSections()
    return output
}

/**
 * Move todos to a different section
 */
export async function moveTodos(todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
    const output = await trpc.todosMoveToSection.mutate({ todoIds, targetSectionId });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Mark todos as completed/incomplete
 */
export async function markTodosCompleted(todoIds: number[], completed: boolean): Promise<TodoItem[]> {
    const output = await trpc.todosMarkCompleted.mutate({ todoIds, completed });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Set priority for multiple todos
 */
export async function setTodosPriority(todoIds: number[], priority: number): Promise<TodoItem[]> {
    const output = await trpc.todosSetPriority.mutate({ todoIds, priority });
    // sectionsContext.refreshSections()
    return output
}

/**
 * Set due date for todos
 */
export async function setTodosDueDate(todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
    const output = await trpc.todosSetDueDate.mutate({ todoIds, dueDate });
    // sectionsContext.refreshSections()
    return output
}