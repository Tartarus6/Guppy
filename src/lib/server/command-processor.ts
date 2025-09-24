import { LLMService, type LLMConfig } from './llm';
import { todoService } from '../client/todos';
import { executeTools } from './tools';
import type { TodoContext } from './llm';

/**
 * Main orchestrator for LLM-powered todo operations
 * This service coordinates between the LLM service, todo service, and tool execution
 */
export class TodoCommandProcessor {
	private llmService: LLMService;

	constructor(llmConfig: LLMConfig) {
		this.llmService = new LLMService(llmConfig);
	}

	/**
	 * Process a natural language command and execute the necessary actions
	 * @param command - User's natural language command
	 * @returns Processing result with actions taken
	 */
	async processCommand(command: string): Promise<{
		success: boolean;
		message: string;
		actions: any[];
		context: TodoContext;
	}> {
		try {
			// Get current todo context
			const context = await this.getTodoContext();
			
			// Process command with LLM
			const llmResponse = await this.llmService.processCommand(command, context);
			
			let actions = [];
			
			// Execute any tool calls
			if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
				actions = await executeTools(llmResponse.toolCalls);
			}
			
			// Get updated context after actions
			const updatedContext = await this.getTodoContext();
			
			return {
				success: actions.length === 0 || actions.every(a => a.success),
				message: llmResponse.content || 'Command processed successfully',
				actions,
				context: updatedContext
			};
			
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Failed to process command',
				actions: [],
				context: await this.getTodoContext()
			};
		}
	}

	/**
	 * Get current todo context for LLM processing
	 */
	private async getTodoContext(): Promise<TodoContext> {
		// TODO: Implement context gathering
		// Get all sections with their todos
		// Format for LLM consumption
		const sectionsWithTodos = await todoService.getSectionsWithTodos();
		
		return {
			sections: sectionsWithTodos.map(s => ({ ...s, todos: undefined })),
			todos: sectionsWithTodos.flatMap(s => s.todos || [])
		};
	}

	/**
	 * Update LLM configuration
	 */
	updateConfig(config: LLMConfig): void {
		this.llmService = new LLMService(config);
	}
}

/**
 * Factory function to create configured command processor
 */
export function createCommandProcessor(config?: Partial<LLMConfig>): TodoCommandProcessor {
	// TODO: Get default config from environment variables or user settings
	const defaultConfig: LLMConfig = {
		provider: 'ollama',
		model: 'llama3.2:3b',
		baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
	};

	const finalConfig = { ...defaultConfig, ...config };
	return new TodoCommandProcessor(finalConfig);
}