/**
 * Logging utility for the todo app backend
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: Record<string, any>;
	error?: Error;
}

class Logger {
	private level: LogLevel;
	private context: Record<string, any> = {};

	constructor(level: LogLevel = 'info') {
		this.level = level;
	}

	private shouldLog(level: LogLevel): boolean {
		const levels: Record<LogLevel, number> = {
			debug: 0,
			info: 1,
			warn: 2,
			error: 3
		};
		
		return levels[level] >= levels[this.level];
	}

	private formatMessage(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): string {
		const timestamp = new Date().toISOString();
		const levelStr = level.toUpperCase().padEnd(5);
		
		let formatted = `[${timestamp}] ${levelStr} ${message}`;
		
		if (context && Object.keys(context).length > 0) {
			formatted += ` | Context: ${JSON.stringify(context)}`;
		}
		
		if (error) {
			formatted += ` | Error: ${error.message}`;
			if (error.stack) {
				formatted += `\nStack: ${error.stack}`;
			}
		}
		
		return formatted;
	}

	private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
		if (!this.shouldLog(level)) {
			return;
		}

		const fullContext = { ...this.context, ...context };
		const formatted = this.formatMessage(level, message, fullContext, error);
		
		// In development, use console methods for better formatting
		if (process.env.NODE_ENV === 'development') {
			switch (level) {
				case 'debug':
					console.debug(formatted);
					break;
				case 'info':
					console.info(formatted);
					break;
				case 'warn':
					console.warn(formatted);
					break;
				case 'error':
					console.error(formatted);
					break;
			}
		} else {
			// In production, always use console.log for consistent JSON parsing
			console.log(formatted);
		}
	}

	/**
	 * Set persistent context that will be included in all log entries
	 */
	setContext(context: Record<string, any>): void {
		this.context = { ...this.context, ...context };
	}

	/**
	 * Clear persistent context
	 */
	clearContext(): void {
		this.context = {};
	}

	/**
	 * Create a child logger with additional context
	 */
	child(context: Record<string, any>): Logger {
		const childLogger = new Logger(this.level);
		childLogger.setContext({ ...this.context, ...context });
		return childLogger;
	}

	debug(message: string, context?: Record<string, any>): void {
		this.log('debug', message, context);
	}

	info(message: string, context?: Record<string, any>): void {
		this.log('info', message, context);
	}

	warn(message: string, context?: Record<string, any>, error?: Error): void {
		this.log('warn', message, context, error);
	}

	error(message: string, context?: Record<string, any>, error?: Error): void {
		this.log('error', message, context, error);
	}

	/**
	 * Log LLM-specific events
	 */
	llm(operation: string, context: Record<string, any>): void {
		this.info(`LLM ${operation}`, { component: 'llm', ...context });
	}

	/**
	 * Log database operations
	 */
	db(operation: string, context: Record<string, any>): void {
		this.debug(`DB ${operation}`, { component: 'database', ...context });
	}

	/**
	 * Log API requests
	 */
	api(method: string, path: string, context?: Record<string, any>): void {
		this.info(`API ${method} ${path}`, { component: 'api', ...context });
	}

	/**
	 * Log command processing
	 */
	command(command: string, context?: Record<string, any>): void {
		this.info(`Command: ${command}`, { component: 'command', ...context });
	}
}

// Create and export default logger instance
const logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
export const logger = new Logger(logLevel);

// Export Logger class for creating custom loggers
export { Logger };