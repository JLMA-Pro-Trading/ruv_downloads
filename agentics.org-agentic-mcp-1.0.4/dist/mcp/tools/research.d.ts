import { MCPTool, Context } from '../../types';
export declare class ResearchTool implements MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            query: {
                type: string;
                description: string;
            };
            depth: {
                type: string;
                description: string;
                enum: string[];
            };
            focus_areas: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
        };
        required: string[];
    };
    private openai;
    private apiKey;
    constructor(apiKey: string);
    execute(params: {
        query: string;
        depth?: string;
        focus_areas?: string[];
    }, context: Context): Promise<any>;
    private performWebSearch;
    private defineResearchAgents;
    private selectRelevantAgents;
    private getAgentInsights;
    private synthesizeFindings;
    private formatReport;
}
