import type { TodoItem, TodoSection, NewTodoItem, NewTodoSection } from '$lib/server/db';
import type { SectionsContext } from '$lib/client/context.svelte';
import { trpc } from '.';

/**
 * Todo Service - Client logic layer for todo operations
 * This service handles all CRUD operations for todos and sections
 */
class TodoService {
	
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
	 * Get all sections
	 */
	async getSections(): Promise<TodoSection[]> {
		const output = await trpc.sections.query()
		return output
	}

	/**
	 * Create a new section
	 */
	async createSection(sectionsContext: SectionsContext, data: NewTodoSection): Promise<TodoSection> {
		const output = await trpc.sectionCreate.mutate(data)
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Update an existing section
	 * 'id', 'createdAt', and 'updatedAt' are omitted since they shouldn't be modified or are handled by the server
	 */
	async updateSection(sectionsContext: SectionsContext, id: number, updates: Partial<Omit<TodoSection, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoSection | null> {
		// Filter out updatedAt since it's handled on the server side
		const output = await trpc.sectionUpdate.mutate({ id, ...updates });
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Delete a section and optionally move its todos
	 */
	async deleteSection(sectionsContext: SectionsContext, id: number, moveToSectionId?: number): Promise<boolean> {
		const output = await trpc.sectionDelete.mutate({ id, moveToSectionId });
		sectionsContext.refreshSections()
		return output
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
	async createTodo(sectionsContext: SectionsContext, data: NewTodoItem): Promise<TodoItem> {
		const output = await trpc.todoCreate.mutate(data)
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Update an existing todo
	 */
	async updateTodo(sectionsContext: SectionsContext, id: number, updates: Partial<Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<TodoItem | null> {
		const output = await trpc.todoUpdate.mutate({ id, ...updates });
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Delete a todo item
	 */
	async deleteTodo(sectionsContext: SectionsContext, id: number): Promise<boolean> {
		const output = await trpc.todoDelete.mutate(id);
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Move todos to a different section
	 */
	async moveTodos(sectionsContext: SectionsContext, todoIds: number[], targetSectionId: number): Promise<TodoItem[]> {
		const output = await trpc.todosMoveToSection.mutate({ todoIds, targetSectionId });
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Mark todos as completed/incomplete
	 */
	async markTodosCompleted(sectionsContext: SectionsContext, todoIds: number[], completed: boolean): Promise<TodoItem[]> {
		const output = await trpc.todosMarkCompleted.mutate({ todoIds, completed });
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Set priority for multiple todos
	 */
	async setTodosPriority(sectionsContext: SectionsContext, todoIds: number[], priority: number): Promise<TodoItem[]> {
		const output = await trpc.todosSetPriority.mutate({ todoIds, priority });
		sectionsContext.refreshSections()
		return output
	}

	/**
	 * Set due date for todos
	 */
	async setTodosDueDate(sectionsContext: SectionsContext, todoIds: number[], dueDate: Date | null): Promise<TodoItem[]> {
		const output = await trpc.todosSetDueDate.mutate({ todoIds, dueDate });
		sectionsContext.refreshSections()
		return output
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
	 * Undo the last change
	 * @param sessionId the session ID
	 * @returns true if successful, false otherwise
	 */
	async undo(sectionsContext: SectionsContext): Promise<boolean> {
		const latestEntry = await trpc.changelogGetLatestEntry.mutate();
		if (!latestEntry) {
			console.log('No changelog entries to undo');
			return false; // No entries to undo
		}

		console.log('Undoing changelog entry:', latestEntry);
	
		if (latestEntry.entityType === 'todo') {
			if (!latestEntry.newState) {
				// it was deleted, so recreate
				const newTodo: NewTodoItem = JSON.parse(latestEntry.previousState!);
				await trpc.todoCreate.mutate(newTodo);
	
				await trpc.changelogRemoveEntry.mutate(latestEntry.id);
				return true;
			}
	
			if (!latestEntry.previousState) {
				// it was created, so delete
				const newTodo: NewTodoItem = JSON.parse(latestEntry.newState);
				console.log('Deleting todo created:', newTodo);
				await this.deleteTodo(sectionsContext, latestEntry.entityId)
				await trpc.changelogRemoveEntry.mutate(latestEntry.id);
				return true;
			} else {
				// it was updated, so revert
				const prevTodo: NewTodoItem = JSON.parse(latestEntry.previousState);
				await this.updateTodo(sectionsContext, latestEntry.entityId, prevTodo)
				await trpc.changelogRemoveEntry.mutate(latestEntry.id);
				return true;
			}
		}
	
		if (latestEntry.entityType === 'section') {
			if (!latestEntry.newState) {
				// it was deleted, so recreate
				const newSection: NewTodoSection = JSON.parse(latestEntry.previousState!);
				await trpc.sectionCreate.mutate(newSection);
				await trpc.changelogRemoveEntry.mutate(latestEntry.id);
				return true;
			}
	
			if (!latestEntry.previousState) {
				// it was created, so delete
				const newSection: NewTodoSection = JSON.parse(latestEntry.newState);
				await this.deleteSection(sectionsContext, latestEntry.entityId)
				await trpc.changelogRemoveEntry.mutate(latestEntry.id);
				return true;
			} else {
				// it was updated, so revert
				const prevSection: NewTodoSection = JSON.parse(latestEntry.previousState);
				await this.updateSection(sectionsContext, latestEntry.entityId, prevSection)
				await trpc.changelogRemoveEntry.mutate(latestEntry.id);
				return true;
			}
		}
	
		return false;
	}
}

// Export singleton instance
export const todoService = new TodoService();