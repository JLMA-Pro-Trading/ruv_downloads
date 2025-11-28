/**
 * MCP Server Detector
 * Auto-detects MCP servers from project configuration
 */
import { MCPServer, MCPServerInfo } from './types.js';
export declare class MCPDetector {
    private projectRoot;
    constructor(projectRoot?: string);
    /**
     * Detect all MCP servers from various config sources
     * Priority order (highest to lowest):
     * 1. Project config (./.mcp.json)
     * 2. User config (~/.claude.json)
     * 3. Legacy config (~/.config/claude/claude_desktop_config.json)
     * 4. Package.json
     * 5. Environment file
     */
    detectServers(): Promise<MCPServer[]>;
    /**
     * Get detailed server information including available tools
     */
    getServerInfo(server: MCPServer): Promise<MCPServerInfo>;
    /**
     * Detect from project config (./.mcp.json)
     * Highest priority - project-specific MCP servers
     */
    private detectFromProjectConfig;
    /**
     * Detect from user config (~/.claude.json)
     * Second priority - user-wide MCP servers
     */
    private detectFromUserConfig;
    /**
     * Detect from legacy Claude Desktop config (~/.config/claude/claude_desktop_config.json)
     * Third priority - legacy compatibility
     */
    private detectFromLegacyConfig;
    /**
     * Detect from package.json (custom mcp field)
     */
    private detectFromPackageJson;
    /**
     * Detect from .env file (MCP_SERVERS variable)
     */
    private detectFromEnvFile;
    /**
     * Parse server configuration from various formats
     */
    private parseServerConfig;
    /**
     * Introspect MCP server to get available tools
     * This is a placeholder - actual implementation would need to start the server
     * and query its capabilities via the MCP protocol
     */
    private introspectTools;
    /**
     * Get common tools for well-known MCP servers
     */
    private getCommonToolsForServer;
    /**
     * Check if config file exists
     */
    hasConfig(configPath: string): Promise<boolean>;
}
//# sourceMappingURL=detector.d.ts.map