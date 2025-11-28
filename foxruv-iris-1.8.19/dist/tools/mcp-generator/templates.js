/**
 * Code Generation Templates
 * Templates for frontend (fetch) and backend (node) MCP wrappers
 */
export class TemplateGenerator {
    /**
     * Generate frontend wrapper (uses fetch API)
     */
    generateFrontendWrapper(context) {
        return `/**
 * ${context.serverName} MCP Wrapper (Frontend)
 * Generated: ${context.timestamp}
 * Package: ${context.packageName}
 */

export interface ${context.className}Options {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class ${context.className} {
  private baseUrl: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(options: ${context.className}Options = {}) {
    this.baseUrl = options.baseUrl || '/api/mcp/${context.normalizedName}';
    this.timeout = options.timeout || 30000;
    this.headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.apiKey) {
      this.headers['Authorization'] = \`Bearer \${options.apiKey}\`;
    }
  }

${this.generateFrontendMethods(context.tools, context.className)}

  /**
   * Make a request to the MCP server
   */
  private async request<T = any>(
    tool: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(\`\${this.baseUrl}/tools/\${tool}\`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(\`MCP Error: \${error.message || response.statusText}\`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
`;
    }
    /**
     * Generate backend wrapper (uses Node.js stdio)
     */
    generateBackendWrapper(context) {
        return `/**
 * ${context.serverName} MCP Wrapper (Backend)
 * Generated: ${context.timestamp}
 * Package: ${context.packageName}
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ${context.className}Options {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  autoReconnect?: boolean;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, any>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class ${context.className} extends EventEmitter {
  private process?: ChildProcess;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private options: Required<${context.className}Options>;
  private buffer = '';
  private initialized = false;

  constructor(options: ${context.className}Options = {}) {
    super();
    this.options = {
      command: options.command || 'npx',
      args: options.args || ['${context.normalizedName}', 'mcp', 'start'],
      env: options.env || {},
      timeout: options.timeout || 30000,
      autoReconnect: options.autoReconnect ?? true,
    };
  }

  /**
   * Initialize the MCP server connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.connect();

    // Send initialize request
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: '${context.packageName}',
        version: '1.0.0',
      },
    });

    this.initialized = true;
    this.emit('initialized', result);
  }

  /**
   * Connect to the MCP server
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.options.command, this.options.args, {
        env: { ...process.env, ...this.options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (chunk) => {
        this.handleData(chunk);
      });

      this.process.stderr?.on('data', (chunk) => {
        this.emit('error', new Error(chunk.toString()));
      });

      this.process.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.process.on('exit', (code) => {
        this.initialized = false;
        this.emit('exit', code);

        if (this.options.autoReconnect && code !== 0) {
          setTimeout(() => this.connect(), 1000);
        }
      });

      // Give the process time to start
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * Handle incoming data from the server
   */
  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString();

    const lines = this.buffer.split('\\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as MCPResponse;
        this.handleResponse(message);
      } catch (error) {
        this.emit('error', new Error(\`Failed to parse message: \${line}\`));
      }
    }
  }

  /**
   * Handle MCP response
   */
  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

${this.generateBackendMethods(context.tools, context.className)}

  /**
   * Make a request to the MCP server
   */
  private async request<T = any>(
    method: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    if (!this.process || this.process.exitCode !== null) {
      await this.connect();
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(\`Request timeout: \${method}\`));
      }, this.options.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.process?.stdin?.write(JSON.stringify(request) + '\\n');
    });
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
      this.initialized = false;
    }
  }
}
`;
    }
    /**
     * Generate TypeScript types
     */
    generateTypes(context) {
        return `/**
 * ${context.serverName} MCP Types
 * Generated: ${context.timestamp}
 */

${this.generateToolTypes(context.tools)}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPResult<T = any> {
  success: boolean;
  data?: T;
  error?: MCPError;
}
`;
    }
    /**
     * Generate index file
     */
    generateIndex(serverNames) {
        return `/**
 * MCP Wrappers Index
 * Auto-generated exports
 */

${serverNames.map(name => {
            const className = this.toClassName(name);
            return `export { ${className} } from './${name}/index.js';`;
        }).join('\n')}
`;
    }
    /**
     * Generate frontend methods
     */
    generateFrontendMethods(tools, className) {
        return tools.map(tool => {
            const methodName = this.toMethodName(tool.name);
            const paramsType = this.generateParamsType(tool, className);
            const requiredParams = tool.inputSchema.required || [];
            const hasRequired = requiredParams.length > 0;
            return `  /**
   * ${tool.description}
   */
  async ${methodName}(params${hasRequired ? '' : '?'}: ${paramsType}): Promise<any> {
    return this.request('${tool.name}', params${hasRequired ? '' : ' || {}'});
  }`;
        }).join('\n\n');
    }
    /**
     * Generate backend methods
     */
    generateBackendMethods(tools, className) {
        return tools.map(tool => {
            const methodName = this.toMethodName(tool.name);
            const paramsType = this.generateParamsType(tool, className);
            const requiredParams = tool.inputSchema.required || [];
            const hasRequired = requiredParams.length > 0;
            return `  /**
   * ${tool.description}
   */
  async ${methodName}(params${hasRequired ? '' : '?'}: ${paramsType}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.request('tools/call', {
      name: '${tool.name}',
      arguments: params${hasRequired ? '' : ' || {}'},
    });
  }`;
        }).join('\n\n');
    }
    /**
     * Generate parameter types
     */
    generateParamsType(tool, className) {
        const typeName = `${className}${this.toPascalCase(tool.name)}Params`;
        if (!tool.inputSchema.properties) {
            return 'Record<string, any>';
        }
        return typeName;
    }
    /**
     * Generate tool types
     */
    generateToolTypes(tools) {
        return tools.map(tool => {
            if (!tool.inputSchema.properties) {
                return '';
            }
            const typeName = this.toPascalCase(tool.name) + 'Params';
            const properties = Object.entries(tool.inputSchema.properties)
                .map(([key, schema]) => {
                const optional = !(tool.inputSchema.required || []).includes(key);
                const type = this.schemaToType(schema);
                return `  ${key}${optional ? '?' : ''}: ${type};`;
            })
                .join('\n');
            return `export interface ${typeName} {
${properties}
}`;
        }).join('\n\n');
    }
    /**
     * Convert JSON schema to TypeScript type
     */
    schemaToType(schema) {
        if (schema.enum) {
            return schema.enum.map((v) => `'${v}'`).join(' | ');
        }
        switch (schema.type) {
            case 'string': return 'string';
            case 'number': return 'number';
            case 'integer': return 'number';
            case 'boolean': return 'boolean';
            case 'array': return 'any[]';
            case 'object': return 'Record<string, any>';
            default: return 'any';
        }
    }
    /**
     * Convert server name to class name
     */
    toClassName(name) {
        return this.toPascalCase(name.replace(/[^a-zA-Z0-9]+/g, '-')) + 'Client';
    }
    /**
     * Convert to PascalCase
     */
    toPascalCase(str) {
        return str
            .split(/[-_]/)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join('');
    }
    /**
     * Convert to method name (camelCase)
     */
    toMethodName(name) {
        const pascal = this.toPascalCase(name);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }
}
