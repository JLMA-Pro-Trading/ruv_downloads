#!/usr/bin/env node
/**
 * MCP Wrapper Generator for IRIS
 *
 * Generates TypeScript wrappers for MCP servers configured in:
 * - .mcp.json (project-level)
 * - ~/.claude.json (user-level)
 *
 * This allows external projects to use IRIS MCP servers with type safety.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

interface MCPServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
  type?: string;
}

interface MCPConfig {
  mcpServers: Record<string, MCPServer>;
}

interface ClaudeConfig extends MCPConfig {
  env?: Record<string, string>;
  projects?: Record<string, {
    env?: Record<string, string>;
    mcpServers?: Record<string, MCPServer>;
  }>;
}

/**
 * Load MCP configuration from various sources
 */
function loadMCPConfig(): { servers: Record<string, MCPServer>; sources: string[] } {
  const servers: Record<string, MCPServer> = {};
  const sources: string[] = [];

  // 1. Load from project .mcp.json
  const projectConfigPath = join(process.cwd(), '.mcp.json');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig: MCPConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
      Object.assign(servers, projectConfig.mcpServers);
      sources.push(projectConfigPath);
    } catch (error) {
      console.warn(`Warning: Failed to parse ${projectConfigPath}:`, error);
    }
  }

  // 2. Load from user ~/.claude.json
  const userConfigPath = join(homedir(), '.claude.json');
  if (existsSync(userConfigPath)) {
    try {
      const userConfig: ClaudeConfig = JSON.parse(readFileSync(userConfigPath, 'utf-8'));

      // Add global MCP servers
      if (userConfig.mcpServers) {
        Object.assign(servers, userConfig.mcpServers);
        sources.push(userConfigPath);
      }

      // Add project-specific MCP servers
      if (userConfig.projects) {
        const currentProject = process.cwd();
        if (userConfig.projects[currentProject]?.mcpServers) {
          Object.assign(servers, userConfig.projects[currentProject].mcpServers);
          sources.push(`${userConfigPath} (project: ${currentProject})`);
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to parse ${userConfigPath}:`, error);
    }
  }

  return { servers, sources };
}

/**
 * Generate TypeScript wrapper for MCP server
 */
function generateWrapper(serverName: string, server: MCPServer): string {
  const safeName = serverName.replace(/[^a-zA-Z0-9_]/g, '_');
  const className = safeName.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('');

  return `
/**
 * MCP Wrapper for ${serverName}
 * Generated from: ${server.command} ${server.args.join(' ')}
 */
export class ${className}MCPWrapper {
  private serverName = '${serverName}';

  constructor() {
    // MCP server configuration
    this.config = {
      command: '${server.command}',
      args: ${JSON.stringify(server.args)},
      ${server.env ? `env: ${JSON.stringify(server.env, null, 2)},` : ''}
      ${server.type ? `type: '${server.type}'` : ''}
    };
  }

  /**
   * Get MCP server configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Call MCP tool (implement based on MCP SDK)
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement MCP SDK integration
    throw new Error('MCP SDK integration not yet implemented');
  }

  /**
   * List available tools from this MCP server
   */
  async listTools(): Promise<string[]> {
    // TODO: Implement MCP SDK integration
    throw new Error('MCP SDK integration not yet implemented');
  }
}
`;
}

/**
 * Generate index file with all wrappers
 */
function generateIndex(serverNames: string[]): string {
  const exports = serverNames.map(name => {
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_');
    const className = safeName.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    return `export { ${className}MCPWrapper } from './${safeName}.js';`;
  }).join('\n');

  return `
/**
 * IRIS MCP Wrappers
 * Auto-generated from MCP configuration
 */

${exports}

/**
 * Available MCP servers
 */
export const MCP_SERVERS = ${JSON.stringify(serverNames, null, 2)};
`;
}

/**
 * Main generator function
 */
function generateWrappers(outputDir: string = './src/mcp/wrappers') {
  console.log('🔍 Loading MCP configuration...\n');

  const { servers, sources } = loadMCPConfig();

  if (Object.keys(servers).length === 0) {
    console.log('❌ No MCP servers found in configuration files.');
    console.log('   Checked:');
    console.log(`   - ${join(process.cwd(), '.mcp.json')}`);
    console.log(`   - ${join(homedir(), '.claude.json')}`);
    process.exit(1);
  }

  console.log('✅ Found MCP servers from:');
  sources.forEach(source => console.log(`   - ${source}`));
  console.log();

  console.log(`📝 Generating wrappers for ${Object.keys(servers).length} servers...\n`);

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate wrapper for each server
  const serverNames: string[] = [];
  for (const [serverName, server] of Object.entries(servers)) {
    const safeName = serverName.replace(/[^a-zA-Z0-9_]/g, '_');
    serverNames.push(serverName);

    const wrapperCode = generateWrapper(serverName, server);
    const outputPath = join(outputDir, `${safeName}.ts`);

    writeFileSync(outputPath, wrapperCode);
    console.log(`   ✓ Generated: ${outputPath}`);
  }

  // Generate index file
  const indexCode = generateIndex(serverNames);
  const indexPath = join(outputDir, 'index.ts');
  writeFileSync(indexPath, indexCode);
  console.log(`   ✓ Generated: ${indexPath}`);

  console.log('\n✨ Wrapper generation complete!\n');
  console.log('📚 Usage:');
  console.log(`   import { IrisPrimeMCPWrapper } from '${outputDir}';`);
  console.log(`   const iris = new IrisPrimeMCPWrapper();`);
  console.log();
}

/**
 * CLI interface
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MCP Wrapper Generator for IRIS

Usage:
  npx tsx src/mcp/generate-wrapper.ts [options]

Options:
  --output <dir>        Output directory for wrappers (default: ./src/mcp/wrappers)
  --detect-from=<file>  Detect MCP servers from specific config file
  --help, -h            Show this help message

Configuration Sources (in order of priority):
  1. Project config: .mcp.json in current directory
  2. User config: ~/.claude.json (global servers)
  3. User config: ~/.claude.json (project-specific servers)

Examples:
  # Generate wrappers from detected configuration
  npx tsx src/mcp/generate-wrapper.ts

  # Generate to custom directory
  npx tsx src/mcp/generate-wrapper.ts --output ./generated/mcp

  # Detect from specific config file
  npx tsx src/mcp/generate-wrapper.ts --detect-from=.mcp.json
`);
    process.exit(0);
  }

  const outputIndex = args.indexOf('--output');
  const outputDir = outputIndex >= 0 && args[outputIndex + 1]
    ? args[outputIndex + 1]
    : './src/mcp/wrappers';

  generateWrappers(outputDir);
}

// Run if called directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMainModule) {
  main();
}

export { loadMCPConfig, generateWrapper, generateWrappers };
