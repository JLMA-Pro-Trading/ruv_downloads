import { AppConfig } from '../types/config.js';
/**
 * MCP Server implementation with multiple transport support
 */
export declare class MCPServer {
    private server;
    private config;
    private httpServer?;
    private wsServer?;
    private isRunning;
    constructor(config: AppConfig);
    /**
     * Setup MCP handlers
     */
    private setupHandlers;
    /**
     * Handle reasoning tool
     */
    private handleReason;
    /**
     * Handle knowledge graph query
     */
    private handleKnowledgeGraphQuery;
    /**
     * Handle add knowledge
     */
    private handleAddKnowledge;
    /**
     * Handle analyze reasoning path
     */
    private handleAnalyzeReasoningPath;
    /**
     * Handle health check
     */
    private handleHealthCheck;
    /**
     * Start the MCP server with configured transport
     */
    start(): Promise<void>;
    /**
     * Start STDIO transport
     */
    private startStdioTransport;
    /**
     * Start HTTP transport
     */
    private startHttpTransport;
    /**
     * Start SSE transport
     */
    private startSSETransport;
    /**
     * Stop the server gracefully
     */
    stop(): Promise<void>;
    /**
     * Check if server is running
     */
    isServerRunning(): boolean;
}
//# sourceMappingURL=server.d.ts.map