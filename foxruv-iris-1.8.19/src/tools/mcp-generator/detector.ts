/**
 * MCP Server Detector
 * Auto-detects MCP servers from project configuration
 */

import { readFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import { homedir } from 'os';
import { MCPServer, MCPConfig, MCPServerInfo, MCPTool } from './types.js';

export class MCPDetector {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Detect all MCP servers from various config sources
   * Priority order (highest to lowest):
   * 1. Project config (./.mcp.json)
   * 2. User config (~/.claude.json)
   * 3. Legacy config (~/.config/claude/claude_desktop_config.json)
   * 4. Package.json
   * 5. Environment file
   */
  async detectServers(): Promise<MCPServer[]> {
    const serverMap = new Map<string, MCPServer>();

    // Try config sources in reverse priority order (so higher priority overwrites)
    const configSources = [
      { name: 'env', servers: await this.detectFromEnvFile() },
      { name: 'package.json', servers: await this.detectFromPackageJson() },
      { name: 'legacy', servers: await this.detectFromLegacyConfig() },
      { name: 'user', servers: await this.detectFromUserConfig() },
      { name: 'project', servers: await this.detectFromProjectConfig() },
    ];

    // Process in order, later sources override earlier ones
    for (const source of configSources) {
      for (const server of source.servers) {
        serverMap.set(server.name, server);
      }
    }

    return Array.from(serverMap.values());
  }

  /**
   * Get detailed server information including available tools
   */
  async getServerInfo(server: MCPServer): Promise<MCPServerInfo> {
    // This would normally introspect the MCP server
    // For now, return basic info with placeholder tools
    return {
      ...server,
      tools: await this.introspectTools(server),
      resources: [],
    };
  }

  /**
   * Detect from project config (./.mcp.json)
   * Highest priority - project-specific MCP servers
   */
  private async detectFromProjectConfig(): Promise<MCPServer[]> {
    try {
      const configPath = resolve(this.projectRoot, '.mcp.json');
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      return this.parseServerConfig(config);
    } catch {
      return [];
    }
  }

  /**
   * Detect from user config (~/.claude.json)
   * Second priority - user-wide MCP servers
   */
  private async detectFromUserConfig(): Promise<MCPServer[]> {
    try {
      const configPath = join(homedir(), '.claude.json');
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      return this.parseServerConfig(config);
    } catch {
      return [];
    }
  }

  /**
   * Detect from legacy Claude Desktop config (~/.config/claude/claude_desktop_config.json)
   * Third priority - legacy compatibility
   */
  private async detectFromLegacyConfig(): Promise<MCPServer[]> {
    try {
      const configPath = join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
      const content = await readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      return this.parseServerConfig(config);
    } catch {
      return [];
    }
  }

  /**
   * Detect from package.json (custom mcp field)
   */
  private async detectFromPackageJson(): Promise<MCPServer[]> {
    try {
      const pkgPath = resolve(this.projectRoot, 'package.json');
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);

      if (pkg.mcp?.servers) {
        return this.parseServerConfig({ mcpServers: pkg.mcp.servers });
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Detect from .env file (MCP_SERVERS variable)
   */
  private async detectFromEnvFile(): Promise<MCPServer[]> {
    try {
      const envPath = resolve(this.projectRoot, '.env');
      const content = await readFile(envPath, 'utf-8');

      const mcpServersLine = content
        .split('\n')
        .find(line => line.startsWith('MCP_SERVERS='));

      if (mcpServersLine) {
        const serversJson = mcpServersLine.split('=')[1];
        const servers = JSON.parse(serversJson);
        return this.parseServerConfig({ mcpServers: servers });
      }

      return [];
    } catch {
      return [];
    }
  }


  /**
   * Parse server configuration from various formats
   */
  private parseServerConfig(config: MCPConfig): MCPServer[] {
    const servers: MCPServer[] = [];
    const serverConfig = config.mcpServers || config.servers || {};

    for (const [name, serverDef] of Object.entries(serverConfig)) {
      if (typeof serverDef === 'object' && serverDef.command) {
        servers.push({
          name,
          command: serverDef.command,
          args: serverDef.args,
          env: serverDef.env,
          description: serverDef.description,
        });
      }
    }

    return servers;
  }

  /**
   * Introspect MCP server to get available tools
   * This is a placeholder - actual implementation would need to start the server
   * and query its capabilities via the MCP protocol
   */
  private async introspectTools(server: MCPServer): Promise<MCPTool[]> {
    // For now, return common tool patterns based on server name
    const commonTools = this.getCommonToolsForServer(server.name);

    // TODO: Implement actual MCP introspection via stdio
    // This would involve:
    // 1. Starting the server process
    // 2. Sending initialize request
    // 3. Calling tools/list
    // 4. Parsing the response
    // 5. Shutting down the server

    return commonTools;
  }

  /**
   * Get common tools for well-known MCP servers
   */
  private getCommonToolsForServer(serverName: string): MCPTool[] {
    const commonPatterns: Record<string, MCPTool[]> = {
      'claude-flow': [
        {
          name: 'swarm_init',
          description: 'Initialize swarm with topology',
          inputSchema: {
            type: 'object',
            properties: {
              topology: { type: 'string', enum: ['hierarchical', 'mesh', 'ring', 'star'] },
              maxAgents: { type: 'number', default: 8 },
              strategy: { type: 'string', default: 'auto' },
            },
            required: ['topology'],
          },
        },
        {
          name: 'agent_spawn',
          description: 'Create specialized AI agents',
          inputSchema: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              name: { type: 'string' },
              capabilities: { type: 'array' },
            },
            required: ['type'],
          },
        },
        {
          name: 'task_orchestrate',
          description: 'Orchestrate complex task workflows',
          inputSchema: {
            type: 'object',
            properties: {
              task: { type: 'string' },
              strategy: { type: 'string' },
              priority: { type: 'string' },
            },
            required: ['task'],
          },
        },
      ],
      'ruv-swarm': [
        {
          name: 'swarm_init',
          description: 'Initialize a new swarm with specified topology',
          inputSchema: {
            type: 'object',
            properties: {
              topology: { type: 'string' },
              maxAgents: { type: 'number' },
              strategy: { type: 'string' },
            },
            required: ['topology'],
          },
        },
      ],
      'flow-nexus': [
        {
          name: 'sandbox_create',
          description: 'Create new code execution sandbox',
          inputSchema: {
            type: 'object',
            properties: {
              template: { type: 'string' },
              name: { type: 'string' },
              env_vars: { type: 'object' },
            },
            required: ['template'],
          },
        },
      ],
    };

    // Check for partial matches
    for (const [pattern, tools] of Object.entries(commonPatterns)) {
      if (serverName.toLowerCase().includes(pattern.toLowerCase())) {
        return tools;
      }
    }

    // Return generic tools if no match
    return [
      {
        name: 'execute',
        description: 'Execute a generic operation',
        inputSchema: {
          type: 'object',
          properties: {
            operation: { type: 'string' },
            params: { type: 'object' },
          },
          required: ['operation'],
        },
      },
    ];
  }

  /**
   * Check if config file exists
   */
  async hasConfig(configPath: string): Promise<boolean> {
    try {
      await access(configPath);
      return true;
    } catch {
      return false;
    }
  }
}
