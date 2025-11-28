import { MCPTool, Context } from '../../types';
export declare class DatabaseTool implements MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            table: {
                type: string;
                description: string;
            };
            query: {
                type: string;
                description: string;
            };
            select: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            filter: {
                type: string;
                description: string;
            };
            order: {
                type: string;
                properties: {
                    column: {
                        type: string;
                    };
                    ascending: {
                        type: string;
                    };
                };
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    private supabase;
    constructor(projectId: string, key: string);
    execute(params: {
        table: string;
        query?: string;
        select?: string[];
        filter?: Record<string, any>;
        order?: {
            column: string;
            ascending: boolean;
        };
        limit?: number;
    }, context: Context): Promise<any>;
    validateTable(table: string): Promise<boolean>;
    getTableSchema(table: string): Promise<any>;
    validateQuery(query: string): Promise<boolean>;
}
