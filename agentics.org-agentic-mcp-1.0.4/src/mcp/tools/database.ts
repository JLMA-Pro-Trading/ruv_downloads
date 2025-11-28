import { MCPTool, Context } from '../../types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class DatabaseTool implements MCPTool {
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

  private supabase: SupabaseClient;

  constructor(projectId: string, key: string) {
    if (!projectId || !key) {
      throw new Error('projectId and key are required for DatabaseTool');
    }
    const url = `https://${projectId}.supabase.co`;
    try {
      this.supabase = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } catch (error) {
      console.error('Failed to create Supabase client:', error);
      throw new Error(`Failed to initialize database connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async execute(params: {
    table: string;
    query?: string;
    select?: string[];
    filter?: Record<string, any>;
    order?: { column: string; ascending: boolean };
    limit?: number;
  }, context: Context): Promise<any> {
    // Validate table name first
    try {
      const tableExists = await this.validateTable(params.table);
      if (!tableExists) {
        throw new Error(`Table '${params.table}' does not exist`);
      }
    } catch (error) {
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
        if (error) throw error;
        result = data;
      } else {
        // Build query using Supabase query builder
        let query = this.supabase.from(params.table).select(
          params.select ? params.select.join(',') : '*'
        );

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
        if (error) throw error;
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Database error:', error);
        throw new Error(`Database query failed: ${error.message}`);
      }
      const supabaseError = error as { message?: string, details?: string };
      console.error('Supabase error:', supabaseError);
      throw new Error(`Database query failed: ${supabaseError.message || supabaseError.details || 'Unknown error'}`);
    }
  }

  // Utility methods for database operations
  async validateTable(table: string): Promise<boolean> {
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
    } catch (error: unknown) {
      console.error('Table validation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Table validation failed: ${errorMessage}`);
    }
  }

  async getTableSchema(table: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('information_schema.columns')
        .select('column_name,data_type,is_nullable')
        .eq('table_name', table);

      if (error) throw error;
      return data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Schema retrieval failed: ${errorMessage}`);
    }
  }

  async validateQuery(query: string): Promise<boolean> {
    try {
      // Explain query to validate without executing
      const { data, error } = await this.supabase.rpc('explain_query', {
        query_text: query
      });

      if (error) throw error;
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Query validation failed: ${errorMessage}`);
    }
  }
}
