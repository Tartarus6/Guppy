/**
 * Configuration and environment variables for the todo app backend
 */

// LLM Provider configurations
export const LLM_PROVIDERS = {
	ollama: {
		name: 'Ollama',
		defaultModel: 'llama3.2:3b',
		defaultBaseUrl: 'http://localhost:11434',
		requiresApiKey: false,
		description: 'Local LLM running via Ollama'
	},
	openai: {
		name: 'OpenAI',
		defaultModel: 'gpt-4o-mini',
		defaultBaseUrl: 'https://api.openai.com/v1',
		requiresApiKey: true,
		description: 'OpenAI GPT models'
	},
	groq: {
		name: 'Groq',
		defaultModel: 'llama-3.1-8b-instant',
		defaultBaseUrl: 'https://api.groq.com/openai/v1',
		requiresApiKey: true,
		description: 'Fast inference via Groq'
	},
	together: {
		name: 'Together AI',
		defaultModel: 'meta-llama/Llama-3-8b-chat-hf',
		defaultBaseUrl: 'https://api.together.xyz/v1',
		requiresApiKey: true,
		description: 'Together AI hosted models'
	}
} as const;

// Default application settings
export const DEFAULT_SETTINGS = {
	// LLM Configuration
	llm: {
		provider: 'ollama' as const,
		model: 'llama3.2:3b',
		baseUrl: 'http://localhost:11434',
		timeout: 30000, // 30 seconds
		maxRetries: 3
	},
	
	// Database settings
	database: {
		url: './data/todos.db',
		backup: true,
		backupInterval: 24 * 60 * 60 * 1000 // 24 hours
	},
	
	// Todo app settings
	todos: {
		maxItemsPerSection: 1000,
		maxSections: 50,
		cleanupInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
		defaultSections: [
			{ name: 'General', type: 'todo', color: '#6B7280' },
			{ name: 'Work', type: 'todo', color: '#3B82F6' },
			{ name: 'Personal', type: 'todo', color: '#10B981' },
			{ name: 'Grocery', type: 'grocery', color: '#F59E0B' }
		]
	},
	
	// API settings
	api: {
		rateLimit: {
			windowMs: 15 * 60 * 1000, // 15 minutes
			maxRequests: 100
		},
		cors: {
			origin: process.env.NODE_ENV === 'production' ? false : true,
			credentials: true
		}
	}
} as const;

// Environment variable validation
export function validateEnvironment(): void {
	const required = ['DATABASE_URL'];
	const missing = required.filter(key => !process.env[key]);
	
	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
	}
}

// Get configuration from environment variables with fallbacks
export function getConfig() {
	return {
		database: {
			url: process.env.DATABASE_URL || DEFAULT_SETTINGS.database.url
		},
		llm: {
			provider: (process.env.LLM_PROVIDER as keyof typeof LLM_PROVIDERS) || DEFAULT_SETTINGS.llm.provider,
			model: process.env.LLM_MODEL || DEFAULT_SETTINGS.llm.model,
			baseUrl: process.env.LLM_BASE_URL || DEFAULT_SETTINGS.llm.baseUrl,
			apiKey: process.env.LLM_API_KEY,
			timeout: parseInt(process.env.LLM_TIMEOUT || '') || DEFAULT_SETTINGS.llm.timeout,
			maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '') || DEFAULT_SETTINGS.llm.maxRetries
		},
		api: {
			port: parseInt(process.env.PORT || '3000'),
			host: process.env.HOST || 'localhost'
		},
		app: {
			environment: process.env.NODE_ENV || 'development',
			logLevel: process.env.LOG_LEVEL || 'info',
			enableMetrics: process.env.ENABLE_METRICS === 'true'
		}
	};
}

// Type definitions for configuration
export type AppConfig = ReturnType<typeof getConfig>;
export type LLMProviderKey = keyof typeof LLM_PROVIDERS;