import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import * as schema from './schema';
import dotenv from 'dotenv';
dotenv.config();

const env = process.env;

// Database connection setup
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const sqlite = new Database(env.DATABASE_URL);

export const db = drizzle(sqlite, { schema });

// Export schema and types for use throughout the app
export * from './schema';
export type TodoItem = typeof schema.todos.$inferSelect;
export type TodoSection = typeof schema.sections.$inferSelect;
export type TodoSectionWithTodosByPriority = TodoSection & { priorities: Record<number, TodoItem[]> }
export type NewTodoItem = typeof schema.todos.$inferInsert;
export type NewTodoSection = typeof schema.sections.$inferInsert;
export type UserSettings = typeof schema.userSettings.$inferSelect;
export type CommandHistory = typeof schema.commandHistory.$inferSelect;


// Initialize database with tables if they don't exist
export async function initializeDatabase() {
    try {
        // Run migrations if they exist
        try {
            migrate(db, { migrationsFolder: './drizzle' });
            console.log('Database migrations completed');
        } catch (migrationError) {
            // TODO: automatically run migrations
            console.log('No migrations found');
            console.log('run `npx drizzle-kit push` or similar commands');
            throw migrationError
        }
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}
