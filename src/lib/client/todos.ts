import type { TodoItem, TodoSection, NewTodoItem, NewTodoSection } from '$lib/server/db';
import { trpc } from '.';

/**
 * Todo Service - Business logic layer for todo operations
 * This service handles all CRUD operations for todos and sections
 */
export class TodoService {
	
	// ===== SECTION OPERATIONS =====
	
	/**
	 * Get all sections with their todos
	 */
	async getSectionsWithTodos(): Promise<(TodoSection & { todos: TodoItem[] })[]> {
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

	async getSectionsWithTodosPriority(): Promise<(TodoSection & { priorities: Record<number, TodoItem[]> })[]> {
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
	 * Get a specific section by name
	 */
	async getSections(): Promise<TodoSection[]> {
		const output = await trpc.sections.query()
		return output
	}

	/**
	 * Create a new section
	 */
	async createSection(data: NewTodoSection): Promise<TodoSection> {
		const output = await trpc.sectionCreate.mutate(data)
		return output
	}

	/**
	 * Update an existing section
	 * 'id' and 'createdAt' are omitted since they shouldn't be modified
	 */
	async updateSection(id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
		// Filter out updatedAt since it's handled on the server side
		return await trpc.sectionUpdate.mutate({ id, ...updates });
	}

	/**
	 * Delete a section and optionally move its todos
	 */
	async deleteSection(id: number, moveToSectionId?: number): Promise<boolean> {
		return await trpc.sectionDelete.mutate({ id, moveToSectionId });
	}

	// ===== TODO OPERATIONS =====

	/**
	 * Get all todos, optionally filtered by section
	 */
	async getTodos(sectionId?: number, includeCompleted = true): Promise<TodoItem[]> {
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
	async getTodoById(id: number): Promise<TodoItem | null> {
		const result = await trpc.todoById.query(id);
		return result.length > 0 ? result[0] : null;
	}

	/**
	 * Find todos by text (for LLM tool operations)
	 */
	async findTodosByText(text: string, sectionId?: number): Promise<TodoItem[]> {
		return await trpc.todosFindByText.query({ text, sectionId });
	}

	/**
	 * Create a new todo item
	 */
	async createTodo(data: NewTodoItem): Promise<TodoItem> {
		const output = await trpc.todoCreate.mutate(data)
		return output
	}

	/**
	 * Update an existing todo
	 */
	async updateTodo(id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
		// Filter out updatedAt since it's handled on the server side
		return await trpc.todoUpdate.mutate({ id, ...updates });
	}

	/**
	 * Delete a todo item
	 */
	async deleteTodo(id: number): Promise<boolean> {
		return await trpc.todoDelete.mutate(id);
	}

	/**
	 * Move todos to a different section
	 */
	async moveTodos(todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
		return await trpc.todosMoveToSection.mutate({ todoIds, targetSectionId });
	}

	/**
	 * Mark todos as completed/incomplete
	 */
	async markTodosCompleted(todoIds: number[], completed: boolean): Promise<TodoItem[]> {
		return await trpc.todosMarkCompleted.mutate({ todoIds, completed });
	}

	/**
	 * Set priority for multiple todos
	 */
	async setTodosPriority(todoIds: number[], priority: number): Promise<TodoItem[]> {
		return await trpc.todosSetPriority.mutate({ todoIds, priority });
	}

	/**
	 * Set due date for todos
	 */
	async setTodosDueDate(todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
		return await trpc.todosSetDueDate.mutate({ todoIds, dueDate });
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
}

// Export singleton instance
export const todoService = new TodoService();