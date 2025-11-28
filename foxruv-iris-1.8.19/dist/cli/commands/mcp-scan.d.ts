/**
 * MCP Scanner - Scan MCPs and generate skill files from their tool schemas
 *
 * This connects to each MCP, extracts tool definitions, and generates
 * skill documentation so Claude knows what's available even when MCPs are disabled.
 */
/**
 * Main scan command
 */
export declare function runMcpScan(options?: {
    mcpIds?: string[];
    output?: string;
    skipDisabled?: boolean;
}): Promise<void>;
/**
 * Quick scan that just lists tools without generating files
 */
export declare function runMcpQuickScan(): Promise<void>;
//# sourceMappingURL=mcp-scan.d.ts.map