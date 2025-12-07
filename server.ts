#!/usr/bin/env node
/**
 * Standalone server entry point
 * Run this to start the tRPC server independently of the SvelteKit app
 * Usage: node server.ts or npm run server
 */

import { startServer } from './src/lib/server/index';

console.log('Starting standalone Guppy server...');
await startServer();
