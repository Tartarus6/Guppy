import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { todoService } from '$lib/client/todos';

/**
 * GET /api/todos/[id]
 * Get a specific todo by ID
 */
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		
		if (isNaN(id)) {
			return json({ error: 'Invalid todo ID' }, { status: 400 });
		}
		
		const todo = await todoService.getTodoById(id);
		
		if (!todo) {
			return json({ error: 'Todo not found' }, { status: 404 });
		}
		
		return json({ todo });
		
	} catch (error) {
		console.error('Error fetching todo:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to fetch todo'
		}, { status: 500 });
	}
};

/**
 * PUT /api/todos/[id]
 * Update a specific todo
 * 
 * Request body:
 * {
 *   "text"?: string,
 *   "completed"?: boolean,
 *   "priority"?: "low" | "medium" | "high",
 *   "sectionId"?: number,
 *   "dueDate"?: string | null
 * }
 */
export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		
		if (isNaN(id)) {
			return json({ error: 'Invalid todo ID' }, { status: 400 });
		}
		
		const updates = await request.json();
		
		// Convert dueDate string to Date object if provided
		if (updates.dueDate) {
			updates.dueDate = new Date(updates.dueDate);
		}
		
		const updatedTodo = await todoService.updateTodo(id, updates);
		
		if (!updatedTodo) {
			return json({ error: 'Todo not found' }, { status: 404 });
		}
		
		return json({
			success: true,
			todo: updatedTodo
		});
		
	} catch (error) {
		console.error('Error updating todo:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to update todo'
		}, { status: 500 });
	}
};

/**
 * DELETE /api/todos/[id]
 * Delete a specific todo
 */
export const DELETE: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		
		if (isNaN(id)) {
			return json({ error: 'Invalid todo ID' }, { status: 400 });
		}
		
		const success = await todoService.deleteTodo(id);
		
		if (!success) {
			return json({ error: 'Todo not found' }, { status: 404 });
		}
		
		return json({ success: true });
		
	} catch (error) {
		console.error('Error deleting todo:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to delete todo'
		}, { status: 500 });
	}
};