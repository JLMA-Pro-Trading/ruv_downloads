import { MCPServerConfig, MCPTool } from '../types';
export declare class OpenAIAgentMCPServer {
    private server;
    private toolRegistry;
    private tracingEnabled;
    private config;
    constructor(config: MCPServerConfig);
    private initializeTools;
    private setupRequestHandlers;
    private setupErrorHandling;
    registerTool(tool: MCPTool): void;
    serve(): Promise<void>;
}
