"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseTool = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class DatabaseTool {
    name = 'database_query';
    description = 'Query and analyze data from the Supabase database';
    inputSchema = {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'The table to query'
            },
            query: {
                type: 'string',
                description: 'SQL query to execute (if provided, takes precedence over other parameters)'
            },
            select: {
                type: 'array',
                items: { type: 'string' },
                description: 'Columns to select'
            },
            filter: {
                type: 'object',
                description: 'Filter conditions'
            },
            order: {
                type: 'object',
                properties: {
                    column: { type: 'string' },
                    ascending: { type: 'boolean' }
                },
                description: 'Order by configuration'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of rows to return'
            }
        },
        required: ['table']
    };
    supabase;
    constructor(projectId, key) {
        if (!projectId || !key) {
            throw new Error('projectId and key are required for DatabaseTool');
        }
        const url = `https://${projectId}.supabase.co`;
        try {
            this.supabase = (0, supabase_js_1.createClient)(url, key, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });
        }
        catch (error) {
            console.error('Failed to create Supabase client:', error);
            throw new Error(`Failed to initialize database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async execute(params, context) {
        // Validate table name first
        try {
            const tableExists = await this.validateTable(params.table);
            if (!tableExists) {
                throw new Error(`Table '${params.table}' does not exist`);
            }
        }
        catch (error) {
            console.error('Table validation error:', error);
            throw new Error(`Table validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        try {
            let result;
            if (params.query) {
                // Direct SQL query
                const { data, error } = await this.supabase.rpc('execute_query', {
                    query_text: params.query
                });
                if (error)
                    throw error;
                result = data;
            }
            else {
                // Build query using Supabase query builder
                let query = this.supabase.from(params.table).select(params.select ? params.select.join(',') : '*');
                if (params.filter) {
                    Object.entries(params.filter).forEach(([key, value]) => {
                        query = query.eq(key, value);
                    });
                }
                if (params.order) {
                    query = query.order(params.order.column, {
                        ascending: params.order.ascending
                    });
                }
                if (params.limit) {
                    query = query.limit(params.limit);
                }
                const { data, error } = await query;
                if (error)
                    throw error;
                result = data;
            }
            // Track the database query action
            context.trackAction('database_query_executed');
            context.remember(`query_${Date.now()}`, {
                params,
                rowCount: Array.isArray(result) ? result.length : 0
            });
            return {
                data: result,
                metadata: {
                    timestamp: new Date().toISOString(),
                    rowCount: Array.isArray(result) ? result.length : 0
                }
            };
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Database error:', error);
                throw new Error(`Database query failed: ${error.message}`);
            }
            const supabaseError = error;
            console.error('Supabase error:', supabaseError);
            throw new Error(`Database query failed: ${supabaseError.message || supabaseError.details || 'Unknown error'}`);
        }
    }
    // Utility methods for database operations
    async validateTable(table) {
        try {
            console.error('Validating table:', table);
            const { data, error } = await this.supabase
                .from(table)
                .select('count')
                .limit(1);
            if (error) {
                console.error('Table validation error:', error);
                throw error;
            }
            console.error('Table validation successful:', table);
            return true;
        }
        catch (error) {
            console.error('Table validation failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Table validation failed: ${errorMessage}`);
        }
    }
    async getTableSchema(table) {
        try {
            const { data, error } = await this.supabase
                .from('information_schema.columns')
                .select('column_name,data_type,is_nullable')
                .eq('table_name', table);
            if (error)
                throw error;
            return data;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Schema retrieval failed: ${errorMessage}`);
        }
    }
    async validateQuery(query) {
        try {
            // Explain query to validate without executing
            const { data, error } = await this.supabase.rpc('explain_query', {
                query_text: query
            });
            if (error)
                throw error;
            return true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Query validation failed: ${errorMessage}`);
        }
    }
}
exports.DatabaseTool = DatabaseTool;
//# sourceMappingURL=database.js.map