import { MCPServerConfig } from '../../types';
export declare class OpenAIAgentMCPServer {
    private config;
    toolRegistry: any;
    constructor(config: MCPServerConfig);
    serve(): Promise<void>;
}
