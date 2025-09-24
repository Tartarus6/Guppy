/**
 * Utility functions for the todo app backend
 */

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	baseDelay = 1000
): Promise<T> {
	let lastError: Error;
	
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			
			if (attempt === maxRetries) {
				throw lastError;
			}
			
			// Exponential backoff: baseDelay * 2^attempt
			const delay = baseDelay * Math.pow(2, attempt);
			await sleep(delay);
		}
	}
	
	throw lastError!;
}

/**
 * Validate and sanitize text input
 */
export function sanitizeText(text: string, maxLength = 500): string {
	if (typeof text !== 'string') {
		throw new Error('Text must be a string');
	}
	
	// Remove excessive whitespace and trim
	const cleaned = text.replace(/\s+/g, ' ').trim();
	
	if (cleaned.length === 0) {
		throw new Error('Text cannot be empty');
	}
	
	if (cleaned.length > maxLength) {
		throw new Error(`Text cannot exceed ${maxLength} characters`);
	}
	
	return cleaned;
}

/**
 * Validate priority value
 */
export function validatePriority(priority: string): 'low' | 'medium' | 'high' {
	const validPriorities = ['low', 'medium', 'high'] as const;
	
	if (!validPriorities.includes(priority as any)) {
		throw new Error(`Priority must be one of: ${validPriorities.join(', ')}`);
	}
	
	return priority as 'low' | 'medium' | 'high';
}

/**
 * Validate and parse date string
 */
export function parseDate(dateString: string): Date {
	const date = new Date(dateString);
	
	if (isNaN(date.getTime())) {
		throw new Error('Invalid date format');
	}
	
	return date;
}

/**
 * Generate a hash for content deduplication
 */
export function generateContentHash(content: string): string {
	// Simple hash function for content comparison
	// In production, you might want to use a proper hashing library
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash.toString(36);
}

/**
 * Fuzzy text matching for finding similar todo items
 */
export function fuzzyMatch(text: string, target: string, threshold = 0.6): boolean {
	// Simple fuzzy matching using Levenshtein distance
	const distance = levenshteinDistance(text.toLowerCase(), target.toLowerCase());
	const maxLength = Math.max(text.length, target.length);
	const similarity = 1 - (distance / maxLength);
	
	return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
	const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
	
	for (let i = 0; i <= str1.length; i++) {
		matrix[0][i] = i;
	}
	
	for (let j = 0; j <= str2.length; j++) {
		matrix[j][0] = j;
	}
	
	for (let j = 1; j <= str2.length; j++) {
		for (let i = 1; i <= str1.length; i++) {
			const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
			matrix[j][i] = Math.min(
				matrix[j][i - 1] + 1,     // deletion
				matrix[j - 1][i] + 1,     // insertion
				matrix[j - 1][i - 1] + indicator  // substitution
			);
		}
	}
	
	return matrix[str2.length][str1.length];
}

/**
 * Format execution time in human-readable format
 */
export function formatExecutionTime(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	} else if (ms < 60000) {
		return `${(ms / 1000).toFixed(1)}s`;
	} else {
		return `${(ms / 60000).toFixed(1)}m`;
	}
}

/**
 * Create a debounced version of a function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout;
	
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

/**
 * Deep clone an object (simple implementation)
 */
export function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}
	
	if (obj instanceof Date) {
		return new Date(obj.getTime()) as unknown as T;
	}
	
	if (Array.isArray(obj)) {
		return obj.map(item => deepClone(item)) as unknown as T;
	}
	
	const cloned = {} as T;
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			cloned[key] = deepClone(obj[key]);
		}
	}
	
	return cloned;
}