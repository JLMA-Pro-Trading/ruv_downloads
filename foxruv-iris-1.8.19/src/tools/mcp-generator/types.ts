/**
 * MCP Wrapper Generator Types
 * Universal types for generating MCP server wrappers
 */

export interface MCPServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPServerInfo extends MCPServer {
  tools: MCPTool[];
  resources?: MCPResource[];
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface GeneratorOptions {
  /** Output directory for generated wrappers */
  outputDir?: string;

  /** Target environment: frontend (fetch) or backend (node) */
  target?: 'frontend' | 'backend' | 'both';

  /** Interactive mode (prompts) or automated */
  interactive?: boolean;

  /** Dry-run mode (don't write files) */
  dryRun?: boolean;

  /** Update existing wrappers */
  update?: boolean;

  /** Custom template directory */
  templateDir?: string;

  /** Include types generation */
  includeTypes?: boolean;

  /** Include tests generation */
  includeTests?: boolean;

  /** MCP config file path */
  configPath?: string;

  /** Force overwrite existing files */
  force?: boolean;

  /** Specific servers to generate (empty = all) */
  servers?: string[];
}

export interface GeneratorResult {
  success: boolean;
  filesGenerated: string[];
  filesUpdated: string[];
  errors: string[];
  warnings: string[];
  dryRun: boolean;
}

export interface MCPConfig {
  mcpServers?: Record<string, MCPServer>;
  servers?: Record<string, MCPServer>;
}

export interface TemplateContext {
  serverName: string;
  normalizedName: string;
  className: string;
  tools: MCPTool[];
  resources?: MCPResource[];
  target: 'frontend' | 'backend';
  timestamp: string;
  packageName: string;
}
