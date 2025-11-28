/**
 * MCP (Model Context Protocol) Server Implementation
 * Provides tools and resources for hackathon projects
 */
import type { McpRequest, McpResponse } from '../types.js';
export declare class McpServer {
    private handlers;
    constructor();
    private registerHandlers;
    handleRequest(request: McpRequest): Promise<McpResponse>;
}
//# sourceMappingURL=server.d.ts.map