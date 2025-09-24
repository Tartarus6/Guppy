import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// Sections represent different categories of todos (e.g., "Work", "Personal", "Grocery")
export const sections = sqliteTable('sections', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(), // Section name like "Work", "High Priority", "Grocery"
	color: text('color'), // Optional color for UI
	order: integer('order').notNull().default(0), // For custom ordering
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Individual todo items
export const todos = sqliteTable('todos', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	text: text('text').notNull(), // The actual todo text
	completed: integer('completed', { mode: 'boolean' }).notNull(),
	priority: integer('priority').notNull(), // 0: medium, -1: low, 1: high
	sectionId: integer('section_id').references(() => sections.id).notNull(),
	order: integer('order').notNull().default(0), // For custom ordering within section
	dueDate: integer('due_date', { mode: 'timestamp' }), // Optional due date
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Optional: User settings/preferences (for multi-user support later)
export const userSettings = sqliteTable('user_settings', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	llmProvider: text('llm_provider').notNull().default('ollama'), // "ollama", "openai", etc.
	llmModel: text('llm_model').notNull().default('llama3.2:3b'),
	serverUrl: text('server_url'), // For connecting to different LLM servers
	theme: text('theme').notNull().default('light'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Command history for debugging and learning user patterns
export const commandHistory = sqliteTable('command_history', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	command: text('command').notNull(), // Original user command
	response: text('response'), // LLM response/actions taken
	success: integer('success', { mode: 'boolean' }).notNull().default(true),
	executionTimeMs: real('execution_time_ms'), // Performance tracking
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});
