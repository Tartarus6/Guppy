import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { browser } from "$app/environment";
import type { AppRouter } from "$lib/server";
import superjson from 'superjson';

// TODO: make port determined my `.env`, rather than being hard coded

// Determine the API URL based on environment
const getApiUrl = () => {
    if (browser) {
        // In browser, use the current host with configured port
        return `${window.location.protocol}//${window.location.hostname}:` + 3000;
    }
    // Server-side, use localhost
    return "http://localhost:" + 3000;
};

export const trpc = createTRPCProxyClient<AppRouter>({
    links: [
        httpBatchLink({
            url: getApiUrl(),
            transformer: superjson,
        })
    ]
});