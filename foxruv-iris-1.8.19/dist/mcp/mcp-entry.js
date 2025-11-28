#!/usr/bin/env node
"use strict";
/**
 * MCP Server Entry Point
 *
 * This wrapper suppresses stdout BEFORE any imports to ensure clean MCP protocol.
 * The MCP protocol requires stdout to contain ONLY JSON-RPC messages.
 */
// Suppress ALL stdout immediately - before any imports can print
const originalLog = console.log;
console.log = (...args) => {
    // Only allow JSON through (MCP protocol messages)
    if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('{')) {
        originalLog(...args);
    }
    // Everything else goes to stderr
    else {
        console.error(...args);
    }
};
// Set env var for other modules to check
process.env.IRIS_MCP_MODE = 'true';
// Now dynamically import the actual server
async function main() {
    const { startMcpServer } = await import('./iris-prime-mcp-server.js');
    await startMcpServer();
}
main().catch((error) => {
    console.error('Fatal MCP server error:', error);
    process.exit(1);
});
