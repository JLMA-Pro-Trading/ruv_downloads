/**
 * foxruv-agent mcp import - Import MCPs from Claude global settings
 */
export interface McpImportOptions {
    backup?: boolean;
    disableGlobal?: boolean;
    dryRun?: boolean;
}
export declare function runMcpImport(projectRoot: string, options?: McpImportOptions): Promise<void>;
//# sourceMappingURL=mcp-import.d.ts.map