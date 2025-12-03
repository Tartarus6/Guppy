import { startServer } from "$lib/server";

// Start the tRPC server when the SvelteKit app initializes
startServer();

export const handle = async ({ event, resolve }) => {
    return await resolve(event);
};
