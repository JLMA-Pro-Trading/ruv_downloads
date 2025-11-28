#!/usr/bin/env node
/**
 * IRIS MCP Server
 *
 * Model Context Protocol server for IRIS AI Operations Orchestrator
 * Follows FoxRev ReasoningBank pattern - runs programmatically, results loaded into model context
 *
 * Key Design:
 * - MCP tools are called PROGRAMMATICALLY (not directly by Claude)
 * - Results are loaded into model context as text
 * - Keeps heavy operations OUT of Claude's direct context
 * - Claude gets the RESULTS, not the direct MCP connection
 *
 * @author FoxRuv
 * @license MIT
 */
export declare function startMcpServer(): Promise<void>;
//# sourceMappingURL=iris-prime-mcp-server.d.ts.map