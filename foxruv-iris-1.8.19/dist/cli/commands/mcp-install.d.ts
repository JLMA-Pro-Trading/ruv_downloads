/**
 * MCP Installation System
 *
 * Complete MCP server installation, configuration, and management
 */
export interface McpServer {
    name: string;
    description: string;
    category: string;
    author: string;
    npm_package: string;
    version: string;
    verified: boolean;
    security_audit: string;
    required_env: string[];
    optional_env?: string[];
    tools: string[];
    skill_templates?: string[];
    contexts?: string[];
    installation: {
        command: string;
        args: string[];
        post_install?: string;
    };
}
export interface McpRegistry {
    version: string;
    mcps: Record<string, McpServer>;
    categories: Record<string, string[]>;
}
/**
 * List available MCPs from registry
 */
export declare function runMcpList(options: {
    category?: string;
    search?: string;
}): Promise<void>;
/**
 * Install MCP server
 */
export declare function runMcpInstall(mcpId: string, options?: {
    yes?: boolean;
    skipWrappers?: boolean;
    skipSkills?: boolean;
}): Promise<void>;
//# sourceMappingURL=mcp-install.d.ts.map