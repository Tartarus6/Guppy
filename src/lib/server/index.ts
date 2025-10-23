import { db, initializeDatabase } from '$lib/server/db/index'
import z from 'zod'
import { eq, like, and, count, sql, inArray } from 'drizzle-orm'
import { createHTTPServer } from "@trpc/server/adapters/standalone"
import { publicProcedure, router } from '$lib/server/db/trpc'
import { sections, todos, userSettings, commandHistory } from '$lib/server/db/schema'
import { getSpeech, getText, sendLLMMessage } from '$lib/server/llm'
import cors from 'cors'
import { env } from '$env/dynamic/private'
import '$lib/server/mcp'

let listenPort = env.PORT

const appRouter = router({
    // Get all TODOs
    todos: publicProcedure.query(async () => {
        const output = await db.select().from(todos)
        return output
    }),

    // Get all TODOs matching the given section id
    todosBySectionId: publicProcedure.input(z.int()).query(async (opts) => {
        const { input } = opts
        const output = await db.select().from(todos).where(eq(todos.sectionId, input))
        return output
    }),

    // Get the TODO with the given id
    todoById: publicProcedure.input(z.int()).query(async (opts) => {
        const { input } = opts
        const output = await db.select().from(todos).where(eq(todos.id, input))
        return output
    }),

    // TODO: implement optional due date
    // Create a todo with the given state
    todoCreate: publicProcedure.input(z.object({sectionId: z.int(), text: z.string(), priority: z.int(), completed: z.boolean()})).mutation(async (opts) => {
        const { input } = opts
        const output = await db.insert(todos).values(input).returning()
        return output[0] // Return the first (and only) created todo
    }),

    // Get all sections
    sections: publicProcedure.query(async () => {
        const output = await db.select().from(sections)
        return output
    }),

    // Create a section with the given state
    sectionCreate: publicProcedure.input(z.object({name: z.string()})).mutation(async (opts) => {
        const { input } = opts
        const output = await db.insert(sections).values(input).returning()
        return output[0]
    }),

    // Update a section
    sectionUpdate: publicProcedure.input(z.object({
        id: z.number(),
        name: z.string().optional(),
        order: z.number().optional()
    })).mutation(async (opts) => {
        const { input } = opts
        const { id, ...updates } = input
        const output = await db.update(sections)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(sections.id, id))
            .returning()
        return output[0] || null
    }),

    // Delete a section
    sectionDelete: publicProcedure.input(z.object({
        id: z.number(),
        moveToSectionId: z.number().optional()
    })).mutation(async (opts) => {
        const { input } = opts
        const { id, moveToSectionId } = input

        // Handle todos in the section
        if (moveToSectionId) {
            // Move todos to another section
            await db.update(todos)
                .set({ sectionId: moveToSectionId, updatedAt: new Date() })
                .where(eq(todos.sectionId, id))
        } else {
            // Delete all todos in the section
            await db.delete(todos).where(eq(todos.sectionId, id))
        }

        // Delete the section
        const result = await db.delete(sections).where(eq(sections.id, id))
        return result.changes > 0
    }),

    // Update a todo
    todoUpdate: publicProcedure.input(z.object({
        id: z.number(),
        text: z.string().optional(),
        completed: z.boolean().optional(),
        priority: z.number().optional(),
        sectionId: z.number().optional(),
        order: z.number().optional(),
        dueDate: z.date().optional().nullable()
    })).mutation(async (opts) => {
        const { input } = opts
        const { id, ...updates } = input
        const output = await db.update(todos)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(todos.id, id))
            .returning()
        return output[0] || null
    }),

    // Delete a todo
    todoDelete: publicProcedure.input(z.number()).mutation(async (opts) => {
        const { input } = opts
        const result = await db.delete(todos).where(eq(todos.id, input))
        return result.changes > 0
    }),

    // Find todos by text search
    todosFindByText: publicProcedure.input(z.object({
        text: z.string(),
        sectionId: z.number().optional()
    })).query(async (opts) => {
        const { input } = opts
        const { text, sectionId } = input
        
        const conditions = [like(todos.text, `%${text}%`)]
        if (sectionId) {
            conditions.push(eq(todos.sectionId, sectionId))
        }
        
        return await db.select().from(todos).where(and(...conditions))
    }),

    // Move multiple todos to a different section
    todosMoveToSection: publicProcedure.input(z.object({
        todoIds: z.array(z.number()),
        targetSectionId: z.number()
    })).mutation(async (opts) => {
        const { input } = opts
        const { todoIds, targetSectionId } = input
        
        const output = await db.update(todos)
            .set({ sectionId: targetSectionId, updatedAt: new Date() })
            .where(inArray(todos.id, todoIds))
            .returning()
        
        return output
    }),

    // Mark multiple todos as completed/incomplete
    todosMarkCompleted: publicProcedure.input(z.object({
        todoIds: z.array(z.number()),
        completed: z.boolean()
    })).mutation(async (opts) => {
        const { input } = opts
        const { todoIds, completed } = input
        
        const output = await db.update(todos)
            .set({ completed, updatedAt: new Date() })
            .where(inArray(todos.id, todoIds))
            .returning()
        
        return output
    }),

    // Set priority for multiple todos
    todosSetPriority: publicProcedure.input(z.object({
        todoIds: z.array(z.number()),
        priority: z.number()
    })).mutation(async (opts) => {
        const { input } = opts
        const { todoIds, priority } = input
        
        const output = await db.update(todos)
            .set({ priority, updatedAt: new Date() })
            .where(inArray(todos.id, todoIds))
            .returning()
        
        return output
    }),

    // Set due date for multiple todos
    todosSetDueDate: publicProcedure.input(z.object({
        todoIds: z.array(z.number()),
        dueDate: z.date().nullable()
    })).mutation(async (opts) => {
        const { input } = opts
        const { todoIds, dueDate } = input
        
        const output = await db.update(todos)
            .set({ dueDate, updatedAt: new Date() })
            .where(inArray(todos.id, todoIds))
            .returning()
        
        return output
    }),

    // Text to speech
    textToSpeech: publicProcedure.input(z.string()).query(async (opts) => {
        const { input } = opts

        return await getSpeech(input)
    }),

    // Speech to text
    speechToText: publicProcedure.query(async () => {
        return await getText()
    }),

    // Save audio for speech to text
    saveAudio: publicProcedure.input(z.string()).mutation(async (opts) => {
        const { input } = opts
        const fs = await import('fs')
        
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(input, 'base64')
        
        // Save to the expected location
        const filePath = 'data/message.wav'
        await fs.promises.writeFile(filePath, audioBuffer)
        
        return { success: true, filePath }
    }),

    // Get todo statistics
    todoStats: publicProcedure.query(async () => {
        const now = new Date()
        
        // Get basic counts
        const totalTodos = await db.select({ count: count() }).from(todos)
        const completedTodos = await db.select({ count: count() }).from(todos).where(eq(todos.completed, true))
        const overdueTodos = await db.select({ count: count() }).from(todos)
            .where(and(eq(todos.completed, false), sql`${todos.dueDate} < ${now}`))
        
        // Get counts by priority
        const priorityCounts = await db.select({ 
            priority: todos.priority, 
            count: count() 
        }).from(todos).groupBy(todos.priority)
        
        // Get counts by section
        const sectionCounts = await db.select({ 
            sectionId: todos.sectionId, 
            count: count() 
        }).from(todos).groupBy(todos.sectionId)
        
        // Format the results
        const total = totalTodos[0]?.count || 0
        const completed = completedTodos[0]?.count || 0
        const overdue = overdueTodos[0]?.count || 0
        
        const byPriority: Record<string, number> = {}
        priorityCounts.forEach(p => {
            const label = p.priority === 1 ? 'high' : p.priority === -1 ? 'low' : 'medium'
            byPriority[label] = p.count
        })
        
        const bySections: Record<string, number> = {}
        sectionCounts.forEach(s => {
            bySections[s.sectionId.toString()] = s.count
        })
        
        return {
            total,
            completed,
            pending: total - completed,
            overdue,
            byPriority,
            bySections
        }
    }),

    llmMessage: publicProcedure.input(z.string()).query(async (opts) => {
        const { input } = opts

        let response = await sendLLMMessage(input)
        return response
    })
})

const server = createHTTPServer({
    router: appRouter,
    middleware: cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            // In production, allow any origin that matches the expected pattern
            if (env.NODE_ENV === 'production') {
                // Allow any HTTPS origin, plus localhost for development
                const allowedPatterns = [
                    /^https:\/\/.*$/, // Any HTTPS origin
                    /^http:\/\/localhost(:\d+)?$/, // localhost with any port
                    /^http:\/\/127\.0\.0\.1(:\d+)?$/, // 127.0.0.1 with any port
                ];

                const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
                return callback(null, isAllowed);
            }

            // In development, allow specific local origins
            const allowedOrigins = [
                'http://localhost:4173', // SvelteKit preview
                'http://localhost:5173', // SvelteKit dev
                'http://127.0.0.1:4173',
                'http://127.0.0.1:5173',
                'http://localhost:80', // Docker SvelteKit server
                'http://127.0.0.1:80',
                'https://localhost:4173', // HTTPS variants
                'https://localhost:5173',
                'https://127.0.0.1:4173',
                'https://127.0.0.1:5173'
            ];

            return callback(null, allowedOrigins.includes(origin));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'trpc-batch-mode']
    })
})

export type AppRouter = typeof appRouter;
// TODO: export other useful types maybe

export async function startServer() {
    try {
        // await initializeDatabase();
        server.listen(listenPort);
        console.log(`Server listening on port ${listenPort}`);
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}