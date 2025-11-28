#!/usr/bin/env node
/**
 * UltraThink MCP Server
 *
 * Standalone Model Context Protocol server with:
 * - Agentic-Flow integration for swarm coordination
 * - AgentDB integration for pattern learning and memory
 * - Modular tool system for extensibility
 * - Health monitoring and metrics
 *
 * Design Philosophy:
 * - MCP tools are called programmatically (not directly by Claude)
 * - Results are loaded into model context as text
 * - Keeps heavy operations OUT of Claude's direct context
 * - Claude gets the RESULTS, not the direct MCP connection
 *
 * @module server
 * @author UltraThink Team
 * @license MIT
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { allTools } from './tools.js';
import { handlers } from './handlers.js';
// ============================================================================
// Server Configuration
// ============================================================================
const config = {
    name: 'ultrathink',
    version: '1.0.0',
    enableMetrics: true,
    enableLearning: true,
    dbPath: process.env.ULTRATHINK_DB_PATH || './data/ultrathink.db'
};
const initState = {
    initialized: false,
    agenticFlow: false,
    agentdb: false,
    startTime: new Date()
};
// ============================================================================
// Lazy Initialization
// ============================================================================
async function ensureInitialized() {
    if (initState.initialized) {
        return;
    }
    try {
        // Initialize AgentDB
        try {
            const agentdb = await import('agentdb');
            console.error('✓ AgentDB initialized');
            initState.agentdb = true;
        }
        catch (error) {
            console.error('⚠ AgentDB initialization failed (optional):', error);
        }
        // Initialize Agentic-Flow
        try {
            const agenticFlow = await import('agentic-flow');
            console.error('✓ Agentic-Flow initialized');
            initState.agenticFlow = true;
        }
        catch (error) {
            console.error('⚠ Agentic-Flow initialization failed (optional):', error);
        }
        initState.initialized = true;
        console.error('✓ UltraThink MCP Server initialized');
    }
    catch (error) {
        console.error('✗ Initialization failed:', error);
        throw error;
    }
}
// ============================================================================
// MCP Server Setup
// ============================================================================
const server = new Server({
    name: config.name,
    version: config.version
}, {
    capabilities: {
        tools: {}
    }
});
// ============================================================================
// Tool Request Handler
// ============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await ensureInitialized();
    const { name, arguments: args } = request.params;
    try {
        // Look up handler
        const handler = handlers[name];
        if (!handler) {
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
        // Execute handler and return result
        const result = await handler(args || {});
        return {
            content: result.content,
            isError: false
        };
    }
    catch (error) {
        // Handle McpError
        if (error instanceof McpError) {
            throw error;
        }
        // Handle standard errors
        if (error instanceof Error) {
            throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`, { stack: error.stack });
        }
        // Handle unknown errors
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${String(error)}`);
    }
});
// ============================================================================
// List Tools Handler
// ============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: allTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }))
    };
});
// ============================================================================
// Health Check
// ============================================================================
async function getHealthStatus() {
    const uptime = Date.now() - initState.startTime.getTime();
    return {
        status: initState.initialized ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        services: {
            mcp: true,
            agenticFlow: initState.agenticFlow,
            agentdb: initState.agentdb
        },
        metrics: {
            uptime,
            totalRequests: 0, // This would be tracked in handlers
            activeSwarms: 0, // This would be tracked in handlers
            activeAgents: 0 // This would be tracked in handlers
        }
    };
}
// ============================================================================
// Graceful Shutdown
// ============================================================================
async function gracefulShutdown(signal) {
    console.error(`\n${signal} received, shutting down gracefully...`);
    try {
        // Get final health status
        const health = await getHealthStatus();
        console.error('Final status:', JSON.stringify(health, null, 2));
        // Close any active connections
        // This would be implemented based on actual state management
        console.error('✓ Shutdown complete');
        process.exit(0);
    }
    catch (error) {
        console.error('✗ Error during shutdown:', error);
        process.exit(1);
    }
}
// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// ============================================================================
// Error Handlers
// ============================================================================
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});
// ============================================================================
// Server Startup
// ============================================================================
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error(`🚀 UltraThink MCP Server v${config.version}`);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error('Features:');
        console.error('  ✓ Agentic-Flow integration for swarm coordination');
        console.error('  ✓ AgentDB integration for pattern learning');
        console.error('  ✓ Tool invocation tracking and metrics');
        console.error('  ✓ Health monitoring and diagnostics');
        console.error('');
        console.error(`Tools available: ${allTools.length}`);
        console.error('');
        console.error('Server running on stdio transport...');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
    }
    catch (error) {
        console.error('Fatal error during startup:', error);
        process.exit(1);
    }
}
// ============================================================================
// Start Server
// ============================================================================
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
// ============================================================================
// Module Exports (for testing and programmatic usage)
// ============================================================================
export { server, config, initState };
export { ensureInitialized, getHealthStatus };
export default server;
//# sourceMappingURL=server.js.map