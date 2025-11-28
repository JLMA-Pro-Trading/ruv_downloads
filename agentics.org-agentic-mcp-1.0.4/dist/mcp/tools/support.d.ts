import { MCPTool, Context } from '../../types';
export declare class SupportTool implements MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            context: {
                type: string;
                properties: {
                    userId: {
                        type: string;
                    };
                    previousInteractions: {
                        type: string;
                    };
                    category: {
                        type: string;
                        enum: string[];
                    };
                };
                description: string;
            };
            priority: {
                type: string;
                enum: string[];
                description: string;
            };
        };
        required: string[];
    };
    private openai;
    constructor(apiKey: string);
    execute(params: {
        query: string;
        context?: {
            userId?: string;
            previousInteractions?: any[];
            category?: 'technical' | 'billing' | 'product' | 'general';
        };
        priority?: 'low' | 'medium' | 'high' | 'urgent';
    }, context: Context): Promise<any>;
    private createSystemMessage;
    categorizeQuery(query: string): Promise<string>;
    determinePriority(query: string): Promise<string>;
    suggestEscalation(query: string, responseText: string): Promise<boolean>;
}
