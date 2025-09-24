import type { TodoItem, TodoSection } from './db';

// LLM Provider types for different services
export type LLMProvider = 'ollama' | 'openai' | 'groq' | 'together';

export interface LLMConfig {
	provider: LLMProvider;
	model: string;
	baseUrl?: string;
	apiKey?: string;
}

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface LLMTool {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, any>;
		required?: string[];
	};
}

export interface LLMResponse {
	content?: string;
	toolCalls?: ToolCall[];
}

export interface ToolCall {
	name: string;
	arguments: Record<string, any>;
}

// Current state of the todo system to provide context to the LLM
export interface TodoContext {
	sections: TodoSection[];
	todos: TodoItem[];
}

export class LLMService {
	private config: LLMConfig;

	constructor(config: LLMConfig) {
		this.config = config;
	}

	/**
	 * Process a natural language command to modify the todo list
	 * @param command - User's natural language command
	 * @param context - Current state of todos and sections
	 * @returns LLM response with potential tool calls
	 */
	async processCommand(command: string, context: TodoContext): Promise<LLMResponse> {
		// TODO: Implement LLM API calls based on provider
		// This will send the command and context to the LLM with available tools
		throw new Error('Not implemented');
	}

	/**
	 * Generate system prompt with current todo context
	 */
	private generateSystemPrompt(context: TodoContext): string {
		// TODO: Create comprehensive system prompt that explains:
		// - Available tools and their usage
		// - Current todo state
		// - How to interpret user commands
		// - Examples of common operations
		return '';
	}

	/**
	 * Make API call to the configured LLM provider
	 */
	private async callLLM(messages: LLMMessage[], tools: LLMTool[]): Promise<LLMResponse> {
		// TODO: Implement provider-specific API calls
		// Switch based on this.config.provider and handle:
		// - Ollama: Direct HTTP calls to local instance
		// - OpenAI: OpenAI SDK
		// - Groq: Groq SDK
		// - Together: Together SDK
		throw new Error('Not implemented');
	}

	/**
	 * Validate and sanitize LLM responses
	 */
	private validateResponse(response: any): LLMResponse {
		// TODO: Ensure the LLM response is properly formatted
		// Validate tool calls have correct structure
		// Handle malformed responses gracefully
		throw new Error('Not implemented');
	}
}