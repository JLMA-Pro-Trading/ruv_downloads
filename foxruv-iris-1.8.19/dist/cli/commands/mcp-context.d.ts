/**
 * MCP Context Manager - Manage Claude Code MCP context usage
 *
 * Reads ~/.claude.json and manages disabledMcpServers per project
 * to reduce context token usage while keeping MCPs accessible.
 */
/**
 * List MCPs and their status
 */
export declare function runMcpContextList(): Promise<void>;
/**
 * Disable specific MCPs
 */
export declare function runMcpContextDisable(mcpIds: string[]): Promise<void>;
/**
 * Enable specific MCPs
 */
export declare function runMcpContextEnable(mcpIds: string[]): Promise<void>;
/**
 * Optimize - disable all MCPs except essential ones
 */
export declare function runMcpContextOptimize(options?: {
    keepEnabled?: string[];
    interactive?: boolean;
}): Promise<void>;
/**
 * Show context usage summary across all projects
 */
export declare function runMcpContextSummary(): Promise<void>;
//# sourceMappingURL=mcp-context.d.ts.map