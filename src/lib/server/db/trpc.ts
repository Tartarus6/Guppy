import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '..';
import type { TodoSection, TodoItem, NewTodoSection, NewTodoItem } from '.';
import { validateSessionInDb } from '..';

// Define the context type
export type Context = {
	sessionId?: string;
};

/**
 * Initialization of tRPC backend with context
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
	transformer: superjson, // to fix date formatting issues
});

/**
 * Middleware to check if user is authenticated
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
	// Check if session is valid
	if (!ctx.sessionId) {
		throw new TRPCError({ 
			code: 'UNAUTHORIZED',
			message: 'Not authenticated'
		});
	}
	
	const valid = await validateSessionInDb(ctx.sessionId);
	if (!valid) {
		throw new TRPCError({ 
			code: 'UNAUTHORIZED',
			message: 'Not authenticated'
		});
	}
	
	return next({
		ctx: {
			...ctx,
			// sessionId is guaranteed to be valid here
		},
	});
});

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);

// Determine the API URL based on environment
const getApiUrl = () => {
    return "http://localhost:" + 3000;
};

// trpc router for internal use (unauthenticated - use getAuthenticatedTrpc for protected routes)
export const trpc = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: getApiUrl(),
            transformer: superjson,
        })
    ]
});

/**
 * Create an authenticated tRPC client for internal server calls
 */
export function getAuthenticatedTrpc(sessionId: string) {
    return createTRPCProxyClient<AppRouter>({
        links: [
            httpBatchLink({
                url: getApiUrl(),
                transformer: superjson,
                headers: () => ({
                    'x-session-id': sessionId,
                }),
            })
        ]
    });
}
