import { db, initializeDatabase } from '$lib/server/db/index'
import z from 'zod'
import { eq, like, and, count, sql, inArray } from 'drizzle-orm'
import { createHTTPServer } from "@trpc/server/adapters/standalone"
import { publicProcedure, protectedProcedure, router, type Context } from '$lib/server/db/trpc'
import { sections, todos, authenticatedSessions, changelog } from '$lib/server/db/schema'
import { getSpeech, getText, sendLLMMessage } from '$lib/server/llm'
import { env } from '$env/dynamic/private'
import { validateCredentials } from '$lib/server/auth'
import { createSession, destroySessionInDb } from '$lib/server/db/trpc'

let listenPort = 3000

const appRouter = router({
    // Get all TODOs
    todos: protectedProcedure.query(async () => {
        const output = await db.select().from(todos)
        return output
    }),

    // Get all TODOs matching the given section id
    todosBySectionId: protectedProcedure.input(z.int()).query(async (opts) => {
        const { input } = opts
        const output = await db.select().from(todos).where(eq(todos.sectionId, input))
        return output
    }),

    // Get the TODO with the given id
    todoById: protectedProcedure.input(z.int()).query(async (opts) => {
        const { input } = opts
        const output = await db.select().from(todos).where(eq(todos.id, input))
        return output
    }),

    // TODO: implement optional due date
    // Create a todo with the given state
    todoCreate: protectedProcedure.input(z.object({sectionId: z.int(), text: z.string(), priority: z.int(), completed: z.boolean()})).mutation(async (opts) => {
        const { input } = opts
        const output = await db.insert(todos).values(input).returning()
        return output[0] // Return the first (and only) created todo
    }),

    // Get section by id
    sectionById: publicProcedure.input(z.int()).query(async (opts) => {
        const { input } = opts
        const output = await db.select().from(sections).where(eq(sections.id, input))
        return output[0] || null
    }),

    // Get all sections
    sections: protectedProcedure.query(async () => {
        const output = await db.select().from(sections)
        return output
    }),

    // Create a section with the given state
    sectionCreate: protectedProcedure.input(z.object({name: z.string()})).mutation(async (opts) => {
        const { input } = opts
        const output = await db.insert(sections).values(input).returning()
        return output[0]
    }),

    // Update a section
    sectionUpdate: protectedProcedure.input(z.object({
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
    sectionDelete: protectedProcedure.input(z.object({
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
    todoUpdate: protectedProcedure.input(z.object({
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
    todoDelete: protectedProcedure.input(z.number()).mutation(async (opts) => {
        const { input } = opts
        const result = await db.delete(todos).where(eq(todos.id, input))
        return result.changes > 0
    }),

    // Find todos by text search
    todosFindByText: protectedProcedure.input(z.object({
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
    todosMoveToSection: protectedProcedure.input(z.object({
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
    todosMarkCompleted: protectedProcedure.input(z.object({
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
    todosSetPriority: protectedProcedure.input(z.object({
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
    todosSetDueDate: protectedProcedure.input(z.object({
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
    textToSpeech: protectedProcedure.input(z.string()).query(async (opts) => {
        const { input } = opts

        return await getSpeech(input)
    }),

    // Speech to text
    speechToText: protectedProcedure.query(async () => {
        return await getText()
    }),

    // Save audio for speech to text
    saveAudio: protectedProcedure.input(z.string()).mutation(async (opts) => {
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
    todoStats: protectedProcedure.query(async () => {
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

    llmMessage: protectedProcedure.input(z.string()).query(async (opts) => {
        const { input, ctx } = opts

        let response = await sendLLMMessage(input, ctx.sessionId!)
        return response
    }),

    validateCredentials: publicProcedure.input(z.object({username: z.string(), password: z.string()})).query(async (opts) => {
        const { username, password } = opts.input
        const valid = validateCredentials(username, password)

        if (valid) {
            return await createSession()
        } else {
            return null
        }
    }),

    logout: protectedProcedure.mutation(async (opts) => {
        const { ctx } = opts;
        if (ctx.sessionId) {
            await destroySessionInDb(ctx.sessionId);
        }
        return { success: true };
    }),

    // Session management procedures (internal use)
    sessionCreate: publicProcedure.input(z.object({
        userId: z.string().optional(),
        ipAddress: z.string().optional(),
        userAgent: z.string().optional(),
        expirationDays: z.number().default(7)
    })).mutation(async (opts) => {
        const { input } = opts;
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + input.expirationDays * 24 * 60 * 60 * 1000);

        await db.insert(authenticatedSessions).values({
            id: sessionId,
            userId: input.userId || null,
            createdAt: now,
            expiresAt: expiresAt,
            lastAccessedAt: now,
            ipAddress: input.ipAddress || null,
            userAgent: input.userAgent || null,
        });

        return sessionId;
    }),

    sessionValidate: publicProcedure.input(z.string()).query(async (opts) => {
        const { input: sessionId } = opts;
        const now = new Date();

        const result = await db.select()
            .from(authenticatedSessions)
            .where(eq(authenticatedSessions.id, sessionId));

        if (result.length === 0) {
            return { valid: false };
        }

        const session = result[0];

        // Check if session has expired
        if (session.expiresAt < now) {
            // Clean up expired session
            await db.delete(authenticatedSessions)
                .where(eq(authenticatedSessions.id, sessionId));
            return { valid: false };
        }

        // Update last accessed time (sliding expiration)
        await db.update(authenticatedSessions)
            .set({ lastAccessedAt: now })
            .where(eq(authenticatedSessions.id, sessionId));

        return { valid: true };
    }),

    sessionDestroy: publicProcedure.input(z.string()).mutation(async (opts) => {
        const { input: sessionId } = opts;
        const result = await db.delete(authenticatedSessions)
            .where(eq(authenticatedSessions.id, sessionId));
        return result.changes > 0;
    }),

    sessionCleanup: publicProcedure.mutation(async () => {
        const now = new Date();
        const result = await db.delete(authenticatedSessions)
            .where(sql`${authenticatedSessions.expiresAt} < ${now}`);
        return { deletedCount: result.changes };
    }),

    changelogAddEntry: protectedProcedure.input(z.object({
        entityType: z.string(),
        entityId: z.number(),
        previousState: z.string().nullable(),
        newState: z.string().nullable()
    })).mutation(async (opts) => {
        const { input } = opts;
        const output = await db.insert(changelog).values({
            entityType: input.entityType,
            entityId: input.entityId,
            previousState: input.previousState,
            newState: input.newState,
            timestamp: new Date()
        }).returning();
        return output[0];
    }),

    changelogRemoveEntry: protectedProcedure.input(z.number()).mutation(async (opts) => {
        const { input } = opts;
        const result = await db.delete(changelog).where(eq(changelog.id, input));
        return result.changes > 0;
    }),

    changelogGetLatestEntry: protectedProcedure.mutation(async () => {
        const output = await db.select().from(changelog).orderBy(sql`${changelog.id} DESC`).limit(1);
        return output[0] || null;
    }),
})

const server = createHTTPServer({
    router: appRouter,
    createContext(opts) {
        // Check for session in header first (for internal calls), then fall back to cookie
        const headerSessionId = opts.req.headers['x-session-id'] as string | undefined;
        
        if (headerSessionId) {
            return {
                sessionId: headerSessionId,
            } satisfies Context;
        }
        
        // Extract session from cookie header
        const cookieHeader = opts.req.headers.cookie || '';
        const cookies: Record<string, string> = {};
        
        if (cookieHeader) {
            cookieHeader.split(';').forEach(cookie => {
                const [key, ...valueParts] = cookie.trim().split('=');
                if (key) {
                    cookies[key] = valueParts.join('=');
                }
            });
        }
        
        return {
            sessionId: cookies.guppy_session,
        } satisfies Context;
    },
    middleware: (req, res, next) => {
        const origin = req.headers.origin;
        
        // Determine if origin is allowed
        let isAllowed = false;
        
        if (!origin) {
            // Allow requests with no origin
            isAllowed = true;
        } else if (env.NODE_ENV === 'production') {
            const allowedPatterns = [
                /^https:\/\/.*$/, // Any HTTPS origin
                /^http:\/\/.*$/, // TODO: TEMPORARY: allow HTTP for testing ONLY
                /^http:\/\/localhost(:\d+)?$/, // localhost with any port
                /^http:\/\/127\.0\.0\.1(:\d+)?$/, // 127.0.0.1 with any port
            ];
            isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
        } else {
            const allowedOrigins = [
                'http://localhost:4173', // SvelteKit preview
                'http://localhost:5173', // SvelteKit dev
                'http://127.0.0.1:4173',
                'http://127.0.0.1:5173',
                'http://localhost:80', // Docker SvelteKit server
                'http://127.0.0.1:80',
                'http://localhost:3000', // Localhost tRPC server
                'http://127.0.0.1:3000',
            ];
            isAllowed = allowedOrigins.includes(origin);
        }
        
        if (isAllowed && origin) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, trpc-batch-mode, x-session-id');
        }
        
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        
        next();
    }
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