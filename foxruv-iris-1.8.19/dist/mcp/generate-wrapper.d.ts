#!/usr/bin/env node
/**
 * MCP Wrapper Generator for IRIS
 *
 * Generates TypeScript wrappers for MCP servers configured in:
 * - .mcp.json (project-level)
 * - ~/.claude.json (user-level)
 *
 * This allows external projects to use IRIS MCP servers with type safety.
 */
interface MCPServer {
    command: string;
    args: string[];
    env?: Record<string, string>;
    type?: string;
}
/**
 * Load MCP configuration from various sources
 */
declare function loadMCPConfig(): {
    servers: Record<string, MCPServer>;
    sources: string[];
};
/**
 * Generate TypeScript wrapper for MCP server
 */
declare function generateWrapper(serverName: string, server: MCPServer): string;
/**
 * Main generator function
 */
declare function generateWrappers(outputDir?: string): void;
export { loadMCPConfig, generateWrapper, generateWrappers };
//# sourceMappingURL=generate-wrapper.d.ts.map