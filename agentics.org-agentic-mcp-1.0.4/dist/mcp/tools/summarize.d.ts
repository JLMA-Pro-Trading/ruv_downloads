import { MCPTool, Context } from '../../types';
export declare class SummarizeTool implements MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            content: {
                type: string;
                description: string;
            };
            format: {
                type: string;
                description: string;
                enum: string[];
                default: string;
            };
            max_length: {
                type: string;
                description: string;
                default: number;
            };
            include_key_quotes: {
                type: string;
                description: string;
                default: boolean;
            };
        };
        required: string[];
    };
    private openai;
    constructor(apiKey: string);
    execute(params: {
        content: string;
        format?: string;
        max_length?: number;
        include_key_quotes?: boolean;
    }, context: Context): Promise<any>;
    private constructSummaryPrompt;
    private formatSummary;
}
