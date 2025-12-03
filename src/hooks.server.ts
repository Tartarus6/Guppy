import { startServer } from "$lib/server";
import type { ServerInit } from '@sveltejs/kit';


export const init: ServerInit = async () => {
    // Start the tRPC server when the SvelteKit app initializes
	await startServer();
};

export const handle = async ({ event, resolve }) => {
    return await resolve(event);
};
