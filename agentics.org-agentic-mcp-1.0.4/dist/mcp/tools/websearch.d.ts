import { MCPTool, Context } from '../../types';
export declare class WebSearchTool implements MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            context_size: {
                type: string;
                description: string;
                enum: string[];
                default: string;
            };
            country: {
                type: string;
                description: string;
            };
            city: {
                type: string;
                description: string;
            };
            region: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    private openai;
    constructor(apiKey: string);
    execute(params: {
        query: string;
        context_size?: string;
        country?: string;
        city?: string;
        region?: string;
    }, context: Context): Promise<any>;
    private formatResponse;
}
