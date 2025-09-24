import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { LLMService } from '$lib/server/llm';
import { todoService } from '$lib/client/todos';
import { executeTools } from '$lib/server/tools';
import { db, commandHistory } from '$lib/server/db';

/**
 * POST /api/command
 * Process natural language commands to modify the todo list
 * 
 * Request body:
 * {
 *   "command": "add math homework page 4 to the todo list",
 *   "llmConfig"?: { provider: "ollama", model: "llama3.2:3b" }
 * }
 * 
 * Response:
 * {
 *   "success": boolean,
 *   "message": string,
 *   "actions": any[], // Results of tool executions
 *   "executionTime": number
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();
	
	try {
		// Parse request body
		const { command, llmConfig } = await request.json();
		
		if (!command || typeof command !== 'string') {
			return json({ 
				success: false, 
				error: 'Command is required and must be a string' 
			}, { status: 400 });
		}

		// TODO: Get LLM configuration from user settings or use default
        // TODO: Use .env for configuration
		const defaultConfig = {
			provider: 'ollama' as const,
			model: 'llama3.2:3b',
			baseUrl: 'http://localhost:11434'
		};
		
		const finalConfig = { ...defaultConfig, ...llmConfig };
		
		// Initialize LLM service
		const llmService = new LLMService(finalConfig);
		
		// Get current todo context for LLM
		const sectionsWithTodos = await todoService.getSectionsWithTodos();
		const context = {
			sections: sectionsWithTodos.map(s => ({ ...s, todos: undefined })),
			todos: sectionsWithTodos.flatMap(s => s.todos || [])
		};
		
		// Process command with LLM
		const llmResponse = await llmService.processCommand(command, context);
		
		let actions = [];
		
		// Execute any tool calls
		if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
			actions = await executeTools(llmResponse.toolCalls);
		}
		
		const executionTime = Date.now() - startTime;
		
		// Log command to history
		// TODO: Implement command history logging
		// await db.insert(commandHistory).values({
		//   command,
		//   response: JSON.stringify({ llmResponse, actions }),
		//   success: actions.every(a => a.success),
		//   executionTimeMs: executionTime
		// });
		
		return json({
			success: true,
			message: llmResponse.content || 'Command processed successfully',
			actions,
			executionTime
		});
		
	} catch (error) {
		const executionTime = Date.now() - startTime;
		
		console.error('Error processing command:', error);
		
		// Log failed command
		// TODO: Implement error logging
		
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred',
			executionTime
		}, { status: 500 });
	}
};