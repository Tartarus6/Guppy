import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { todoService } from '$lib/client/todos';

/**
 * GET /api/sections
 * Get all todo sections
 * 
 * Response:
 * {
 *   "sections": Section[]
 * }
 */
export const GET: RequestHandler = async () => {
	try {
		const sectionsWithTodos = await todoService.getSectionsWithTodos();
		
		// Return sections with todo counts
		const sectionsWithCounts = sectionsWithTodos.map(section => ({
			...section,
			todoCount: section.todos.length,
			completedCount: section.todos.filter(t => t.completed).length,
			todos: undefined // Don't include full todo data
		}));
		
		return json({
			sections: sectionsWithCounts
		});
		
	} catch (error) {
		console.error('Error fetching sections:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to fetch sections'
		}, { status: 500 });
	}
};

/**
 * POST /api/sections
 * Create a new section
 * 
 * Request body:
 * {
 *   "name": string,
 *   "type"?: "todo" | "grocery" | "custom",
 *   "color"?: string
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { name, type = 'todo', color } = await request.json();
		
		if (!name || typeof name !== 'string') {
			return json({
				error: 'Section name is required'
			}, { status: 400 });
		}
		
		// Check if section with this name already exists
		const existing = await todoService.getSectionByName(name);
		if (existing) {
			return json({
				error: 'Section with this name already exists'
			}, { status: 409 });
		}
		
		const sectionData = {
			name,
			type,
			order: 0, // Will be set by service
			...(color && { color })
		};
		
		const newSection = await todoService.createSection(sectionData);
		
		return json({
			success: true,
			section: newSection
		});
		
	} catch (error) {
		console.error('Error creating section:', error);
		return json({
			error: error instanceof Error ? error.message : 'Failed to create section'
		}, { status: 500 });
	}
};