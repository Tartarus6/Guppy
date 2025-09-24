import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { todoService } from '$lib/client/todos';

/**
 * GET /api/todos
 * Get all todos and sections
 * 
 * Query params:
 * - section: Filter by section ID
 * - includeCompleted: Include completed todos (default: true)
 * 
 * Response:
 * {
 *   "sections": Section[],
 *   "todos": Todo[],
 *   "stats": { total, completed, pending, ... }
 * }
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const sectionId = url.searchParams.get('section');
		const includeCompleted = url.searchParams.get('includeCompleted') !== 'false';
		
		// Get all sections with their todos
		const sectionsWithTodos = await todoService.getSectionsWithTodos();
		
		// Get todo statistics
		const stats = await todoService.getTodoStats();
		
		// Filter if section specified
		let filteredSections = sectionsWithTodos;
		if (sectionId) {
			filteredSections = sectionsWithTodos.filter(s => s.id === parseInt(sectionId));
		}
		
		// Filter completed todos if requested
		if (!includeCompleted) {
			filteredSections = filteredSections.map(section => ({
				...section,
				todos: section.todos.filter(todo => !todo.completed)
			}));
		}
		
		return json({
			sections: filteredSections.map(s => ({ ...s, todos: undefined })),
			todos: filteredSections.flatMap(s => s.todos || []),
			stats
		});
		
	} catch (error) {
		console.error('Error fetching todos:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to fetch todos'
		}, { status: 500 });
	}
};

/**
 * POST /api/todos
 * Create a new todo item
 * 
 * Request body:
 * {
 *   "text": string,
 *   "sectionId": number,
 *   "priority"?: "low" | "medium" | "high",
 *   "dueDate"?: string (ISO date)
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { text, sectionId, priority = 'medium', dueDate } = await request.json();
		
		if (!text || !sectionId) {
			return json({
				error: 'text and sectionId are required'
			}, { status: 400 });
		}
		
		const todoData = {
			text,
			sectionId,
			priority,
			completed: false,
			order: 0, // Will be set by service
			...(dueDate && { dueDate: new Date(dueDate) })
		};
		
		const newTodo = await todoService.createTodo(todoData);
		
		return json({
			success: true,
			todo: newTodo
		});
		
	} catch (error) {
		console.error('Error creating todo:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to create todo'
		}, { status: 500 });
	}
};