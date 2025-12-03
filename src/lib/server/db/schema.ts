import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { string } from 'zod';
import { en } from 'zod/locales';

// Sections represent different categories of todos (e.g., "Work", "Personal", "Grocery")
export const sections = sqliteTable('sections', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(), // Section name like "Work", "High Priority", "Grocery"
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

// Database changelog for undo/redo functionality
export const changelog = sqliteTable('changelog', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	entityType: text('entity_type').notNull(), // "todo" or "section"
	entityId: integer('entity_id').notNull(), // ID of the todo or section
	previousState: text('previous_data'), // JSON string of previous state, null if new entity
	newState: text('new_data'), // JSON string of new state, null if deleted
	timestamp: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date())
});

// Authenticated sessions
export const authenticatedSessions = sqliteTable('authenticated_sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id'), // For future multi-user support (nullable for now)
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), // Essential for cleanup
	lastAccessedAt: integer('last_accessed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
	ipAddress: text('ip_address'), // Optional: security tracking
	userAgent: text('user_agent'), // Optional: security tracking
})
