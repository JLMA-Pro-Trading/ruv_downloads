/**
 * MCP Server Detector
 * Auto-detects MCP servers from project configuration
 *
 * @package ultrathink
 * @standalone Fully standalone implementation with no iris-core dependencies
 */
import { MCPServer, MCPServerInfo, CoordinationEvent, TrackingRecord } from './types.js';
export interface DetectorOptions {
    /** Enable coordination events */
    enableCoordination?: boolean;
    /** Agent ID for tracking */
    agentId?: string;
    /** Coordination event handler */
    onCoordinationEvent?: (event: CoordinationEvent) => void | Promise<void>;
    /** Tracking record handler */
    onTrackingRecord?: (record: TrackingRecord) => void | Promise<void>;
}
export declare class MCPDetector {
    private projectRoot;
    private options;
    constructor(projectRoot?: string, options?: DetectorOptions);
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
    /**
     * Emit coordination event for agentic-flow integration
     */
    private emitCoordination;
    /**
     * Emit tracking record for agentdb integration
     */
    private emitTracking;
}
//# sourceMappingURL=detector.d.ts.map