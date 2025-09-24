import { initTRPC } from '@trpc/server';
import superjson from 'superjson';

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.create({
	transformer: superjson, // to fix date formatting issues
});
/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;