import { MCPTool, Context } from '../../types';
export declare class HandoffTool implements MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            agent_name: {
                type: string;
                description: string;
                enum: string[];
            };
            reason: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(params: {
        agent_name: string;
        reason: string;
    }, context: Context): Promise<any>;
}
