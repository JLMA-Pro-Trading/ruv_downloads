/**
 * MCP Wrapper Generator Types
 * Universal types for generating MCP server wrappers
 *
 * @package ultrathink
 * @standalone Fully standalone implementation
 */
export interface MCPServer {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    description?: string;
}
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}
export interface MCPServerInfo extends MCPServer {
    tools: MCPTool[];
    resources?: MCPResource[];
}
export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}
export interface GeneratorOptions {
    /** Output directory for generated wrappers */
    outputDir?: string;
    /** Target environment: frontend (fetch) or backend (node) */
    target?: 'frontend' | 'backend' | 'both';
    /** Interactive mode (prompts) or automated */
    interactive?: boolean;
    /** Dry-run mode (don't write files) */
    dryRun?: boolean;
    /** Update existing wrappers */
    update?: boolean;
    /** Custom template directory */
    templateDir?: string;
    /** Include types generation */
    includeTypes?: boolean;
    /** Include tests generation */
    includeTests?: boolean;
    /** MCP config file path */
    configPath?: string;
    /** Force overwrite existing files */
    force?: boolean;
    /** Specific servers to generate (empty = all) */
    servers?: string[];
    /** Enable agentic-flow coordination hooks */
    enableCoordination?: boolean;
    /** Enable agentdb tracking */
    enableTracking?: boolean;
    /** Coordination namespace for memory sharing */
    coordinationNamespace?: string;
    /** Agent ID for tracking */
    agentId?: string;
}
export interface GeneratorResult {
    success: boolean;
    filesGenerated: string[];
    filesUpdated: string[];
    errors: string[];
    warnings: string[];
    dryRun: boolean;
    /** Tracking data for agentdb */
    tracking?: GeneratorTracking;
}
export interface GeneratorTracking {
    /** Number of servers processed */
    serversProcessed: number;
    /** Total tools generated */
    toolsGenerated: number;
    /** Generation duration in milliseconds */
    duration: number;
    /** Start timestamp */
    startTime: string;
    /** End timestamp */
    endTime: string;
    /** Agent ID that performed generation */
    agentId?: string;
}
export interface MCPConfig {
    mcpServers?: Record<string, MCPServer>;
    servers?: Record<string, MCPServer>;
}
export interface TemplateContext {
    serverName: string;
    normalizedName: string;
    className: string;
    tools: MCPTool[];
    resources?: MCPResource[];
    target: 'frontend' | 'backend';
    timestamp: string;
    packageName: string;
}
/**
 * Coordination event types for agentic-flow integration
 */
export interface CoordinationEvent {
    type: 'generation:start' | 'generation:progress' | 'generation:complete' | 'generation:error';
    agentId?: string;
    serverName?: string;
    progress?: number;
    total?: number;
    error?: string;
    timestamp: string;
}
/**
 * AgentDB tracking record for generation events
 */
export interface TrackingRecord {
    id: string;
    agentId?: string;
    operation: 'generate' | 'detect' | 'write';
    serverName?: string;
    filesAffected: string[];
    success: boolean;
    duration: number;
    timestamp: string;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=types.d.ts.map