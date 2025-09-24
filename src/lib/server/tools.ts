import type { LLMTool, ToolCall } from './llm';
import type { TodoItem, TodoSection } from './db';

// Tool function definitions that the LLM can call
export interface ToolFunction {
	(args: Record<string, any>): Promise<any>;
}

// Registry of available tools mapped to their implementation
export const toolFunctions: Record<string, ToolFunction> = {
	add_todo_item: addTodoItem,
	create_section: createSection,
	move_items: moveItems,
	update_todo_item: updateTodoItem,
	delete_todo_item: deleteTodoItem,
	delete_section: deleteSection,
	reorder_items: reorderItems,
	update_section: updateSection,
	mark_completed: markCompleted,
	set_priority: setPriority,
	set_due_date: setDueDate
};

// Tool definitions for the LLM (JSON Schema format)
export const availableTools: LLMTool[] = [
	{
		name: 'add_todo_item',
		description: 'Add a new item to a specific section of the todo list',
		parameters: {
			type: 'object',
			properties: {
				text: { type: 'string', description: 'The todo item text' },
				sectionName: { type: 'string', description: 'Name of the section to add to' },
				priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
				dueDate: { type: 'string', description: 'Due date in ISO format (optional)' }
			},
			required: ['text', 'sectionName']
		}
	},
	{
		name: 'create_section',
		description: 'Create a new section in the todo list',
		parameters: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Section name' },
				type: { type: 'string', enum: ['todo', 'grocery', 'custom'], description: 'Section type' },
				color: { type: 'string', description: 'Optional color for the section' }
			},
			required: ['name']
		}
	},
	{
		name: 'move_items',
		description: 'Move one or more items between sections',
		parameters: {
			type: 'object',
			properties: {
				itemTexts: { type: 'array', items: { type: 'string' }, description: 'Text of items to move' },
				fromSection: { type: 'string', description: 'Source section name' },
				toSection: { type: 'string', description: 'Destination section name' }
			},
			required: ['itemTexts', 'toSection']
		}
	},
	{
		name: 'update_todo_item',
		description: 'Update the text or properties of an existing todo item',
		parameters: {
			type: 'object',
			properties: {
				originalText: { type: 'string', description: 'Current text of the item to update' },
				newText: { type: 'string', description: 'New text for the item' },
				priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority level' }
			},
			required: ['originalText']
		}
	},
	{
		name: 'delete_todo_item',
		description: 'Delete a todo item from the list',
		parameters: {
			type: 'object',
			properties: {
				itemText: { type: 'string', description: 'Text of the item to delete' },
				sectionName: { type: 'string', description: 'Section containing the item' }
			},
			required: ['itemText']
		}
	},
	{
		name: 'delete_section',
		description: 'Delete an entire section and optionally move its items',
		parameters: {
			type: 'object',
			properties: {
				sectionName: { type: 'string', description: 'Name of section to delete' },
				moveItemsTo: { type: 'string', description: 'Section to move items to (optional)' }
			},
			required: ['sectionName']
		}
	},
	{
		name: 'mark_completed',
		description: 'Mark one or more items as completed or incomplete',
		parameters: {
			type: 'object',
			properties: {
				itemTexts: { type: 'array', items: { type: 'string' }, description: 'Items to mark' },
				completed: { type: 'boolean', description: 'Whether to mark as completed or incomplete' }
			},
			required: ['itemTexts', 'completed']
		}
	},
	{
		name: 'set_priority',
		description: 'Update the priority of one or more items',
		parameters: {
			type: 'object',
			properties: {
				itemTexts: { type: 'array', items: { type: 'string' }, description: 'Items to update' },
				priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority level' }
			},
			required: ['itemTexts', 'priority']
		}
	}
];

// Tool execution functions (these will call the actual todo service)

async function addTodoItem(args: Record<string, any>): Promise<any> {
	// TODO: Import and call the todo service to add an item
	// Validate args.text, args.sectionName, optional args.priority, args.dueDate
	// Return success/failure result
	throw new Error('Not implemented');
}

async function createSection(args: Record<string, any>): Promise<any> {
	// TODO: Import and call the todo service to create a section
	// Validate args.name, optional args.type, args.color
	// Handle duplicate section names
	throw new Error('Not implemented');
}

async function moveItems(args: Record<string, any>): Promise<any> {
	// TODO: Import and call the todo service to move items
	// Find items by text in fromSection (or any section if not specified)
	// Move to toSection
	throw new Error('Not implemented');
}

async function updateTodoItem(args: Record<string, any>): Promise<any> {
	// TODO: Find item by originalText and update with new properties
	// Handle cases where multiple items have the same text
	throw new Error('Not implemented');
}

async function deleteTodoItem(args: Record<string, any>): Promise<any> {
	// TODO: Find and delete item by text
	// Optionally constrain search to specific section
	throw new Error('Not implemented');
}

async function deleteSection(args: Record<string, any>): Promise<any> {
	// TODO: Delete section and handle items
	// If moveItemsTo is specified, move items there
	// Otherwise, delete items with the section
	throw new Error('Not implemented');
}

async function reorderItems(args: Record<string, any>): Promise<any> {
	// TODO: Reorder items within a section
	// Could be used for commands like "move X to the top of the list"
	throw new Error('Not implemented');
}

async function updateSection(args: Record<string, any>): Promise<any> {
	// TODO: Update section properties (name, color, type)
	throw new Error('Not implemented');
}

async function markCompleted(args: Record<string, any>): Promise<any> {
	// TODO: Mark items as completed/incomplete
	// Find items by text and update completion status
	throw new Error('Not implemented');
}

async function setPriority(args: Record<string, any>): Promise<any> {
	// TODO: Update priority for multiple items
	// Find items by text and update priority
	throw new Error('Not implemented');
}

async function setDueDate(args: Record<string, any>): Promise<any> {
	// TODO: Set due date for items
	// Parse date string and validate
	throw new Error('Not implemented');
}

/**
 * Execute tool calls returned by the LLM
 * @param toolCalls - Array of tool calls from LLM response
 * @returns Results of tool execution
 */
export async function executeTools(toolCalls: ToolCall[]): Promise<any[]> {
	const results = [];
	
	for (const call of toolCalls) {
		try {
			const toolFunction = toolFunctions[call.name];
			if (!toolFunction) {
				results.push({ 
					error: `Unknown tool: ${call.name}`,
					success: false 
				});
				continue;
			}

			const result = await toolFunction(call.arguments);
			results.push({ 
				tool: call.name,
				result,
				success: true 
			});
		} catch (error) {
			results.push({ 
				tool: call.name,
				error: error instanceof Error ? error.message : 'Unknown error',
				success: false 
			});
		}
	}
	
	return results;
}