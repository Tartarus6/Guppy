import type { TodoItem, TodoSection, NewTodoItem, NewTodoSection } from '$lib/server/db';
import type { SectionsContext } from '$lib/client/context.svelte';
import { trpc } from '.';

/**
 * Todo Service - Client logic layer for todo operations
 * This service handles all CRUD operations for todos and sections
 * All operations automatically include changelog tracking via the server
 */
class TodoService {
	
	// ===== SECTION OPERATIONS =====
	
	/**
	 * Get all sections with their todos
	 */
	async getSectionsWithTodos(): Promise<(TodoSection & { todos: TodoItem[] })[]> {
		const [sectionsData, todosData] = await Promise.all([
			trpc.sections.query(),
			trpc.todos.query()
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

	async getSectionsWithTodosPriority(): Promise<(TodoSection & { priorities: Record<number, TodoItem[]> })[]> {
		const [sectionsData, todosData] = await Promise.all([
			trpc.sections.query(),
			trpc.todos.query()
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
	 * Get all sections
	 */
	async getSections(): Promise<TodoSection[]> {
		return await trpc.sections.query();
	}

	/**
	 * Create a new section (with automatic changelog tracking)
	 */
	async createSection(sectionsContext: SectionsContext, data: NewTodoSection): Promise<TodoSection> {
		const output = await trpc.sectionCreate.mutate(data);
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Update an existing section (with automatic changelog tracking)
	 */
	async updateSection(sectionsContext: SectionsContext, id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
		const output = await trpc.sectionUpdate.mutate({ id, ...updates });
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Delete a section (with automatic changelog tracking)
	 */
	async deleteSection(sectionsContext: SectionsContext, id: number, moveToSectionId?: number): Promise<boolean> {
		const output = await trpc.sectionDelete.mutate({ id, moveToSectionId });
		sectionsContext.refreshSections();
		return output;
	}

	// ===== TODO OPERATIONS =====

	/**
	 * Get all todos, optionally filtered by section
	 */
	async getTodos(sectionId?: number): Promise<TodoItem[]> {
		if (sectionId) {
			return await trpc.todosBySectionId.query(sectionId);
		} else {
			return await trpc.todos.query();
		}
	}

	/**
	 * Get a specific todo by ID
	 */
	async getTodoById(id: number): Promise<TodoItem | null> {
		const result = await trpc.todoById.query(id);
		return result.length > 0 ? result[0] : null;
	}

	/**
	 * Find todos by text
	 */
	async findTodosByText(text: string, sectionId?: number): Promise<TodoItem[]> {
		return await trpc.todosFindByText.query({ text, sectionId });
	}

	/**
	 * Create a new todo item (with automatic changelog tracking)
	 */
	async createTodo(sectionsContext: SectionsContext, data: NewTodoItem): Promise<TodoItem> {
		const output = await trpc.todoCreate.mutate(data);
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Update an existing todo (with automatic changelog tracking)
	 */
	async updateTodo(sectionsContext: SectionsContext, id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
		const output = await trpc.todoUpdate.mutate({ id, ...updates });
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Delete a todo item (with automatic changelog tracking)
	 */
	async deleteTodo(sectionsContext: SectionsContext, id: number): Promise<boolean> {
		const output = await trpc.todoDelete.mutate(id);
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Move todos to a different section
	 */
	async moveTodos(sectionsContext: SectionsContext, todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
		const output = await trpc.todosMoveToSection.mutate({ todoIds, targetSectionId });
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Mark todos as completed/incomplete
	 */
	async markTodosCompleted(sectionsContext: SectionsContext, todoIds: number[], completed: boolean): Promise<TodoItem[]> {
		const output = await trpc.todosMarkCompleted.mutate({ todoIds, completed });
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Set priority for multiple todos
	 */
	async setTodosPriority(sectionsContext: SectionsContext, todoIds: number[], priority: number): Promise<TodoItem[]> {
		const output = await trpc.todosSetPriority.mutate({ todoIds, priority });
		sectionsContext.refreshSections();
		return output;
	}

	/**
	 * Set due date for todos
	 */
	async setTodosDueDate(sectionsContext: SectionsContext, todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
		const output = await trpc.todosSetDueDate.mutate({ todoIds, dueDate });
		sectionsContext.refreshSections();
		return output;
	}

	// ===== UTILITY METHODS =====

	/**
	 * Get todo statistics
	 */
	async getTodoStats(): Promise<{
		total: number;
		completed: number;
		pending: number;
		overdue: number;
		byPriority: Record<string, number>;
		bySections: Record<string, number>;
	}> {
		return await trpc.todoStats.query();
	}

	// ===== CHANGELOG OPERATIONS =====
	
	/**
	 * Undo the last change (uses centralized undo logic from server)
	 */
	async undo(sectionsContext: SectionsContext): Promise<boolean> {
		const success = await trpc.undo.mutate();
		if (success) {
			sectionsContext.refreshSections();
		}
		return success;
	}
}

// Export singleton instance
export const todoService = new TodoService();