/**
 * MCP Context Manager - Manage Claude Code MCP context usage
 * 
 * Reads ~/.claude.json and manages disabledMcpServers per project
 * to reduce context token usage while keeping MCPs accessible.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface McpServerConfig {
  type: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ProjectConfig {
  allowedTools?: string[];
  mcpContextUris?: string[];
  mcpServers?: Record<string, McpServerConfig>;
  disabledMcpServers?: string[];
  hasTrustDialogAccepted?: boolean;
  hasCompletedProjectOnboarding?: boolean;
  [key: string]: unknown;
}

interface ClaudeConfig {
  [projectPath: string]: ProjectConfig;
}

const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude.json');

// MCPs that should always stay enabled for Iris to work
const ALWAYS_ENABLED = ['iris'];

// MCPs that are recommended to keep enabled (used in optimize suggestions)
// const RECOMMENDED_ENABLED = ['iris'];

/**
 * Load Claude Code config
 */
interface RawClaudeConfig {
  projects?: Record<string, ProjectConfig>;
  [projectPath: string]: ProjectConfig | Record<string, ProjectConfig> | unknown;
}

interface McpJsonConfig {
  mcpServers?: Record<string, McpServerConfig>;
}

async function loadClaudeConfig(): Promise<{ raw: RawClaudeConfig; projects: ClaudeConfig }> {
  try {
    const content = await fs.readFile(CLAUDE_CONFIG_PATH, 'utf8');
    const raw = JSON.parse(content) as RawClaudeConfig;
    
    // Merge old format (direct path keys) and new format (under "projects")
    const projects: ClaudeConfig = {};
    
    // New format - under "projects" key
    if (raw.projects) {
      Object.assign(projects, raw.projects);
    }
    
    // Old format - direct path keys (check if it looks like a path)
    for (const [key, value] of Object.entries(raw)) {
      if (key.startsWith('/') && typeof value === 'object' && value !== null) {
        projects[key] = value as ProjectConfig;
      }
    }
    
    return { raw, projects };
  } catch {
    return { raw: {}, projects: {} };
  }
}

/**
 * Load project-level .mcp.json (shared MCP config)
 */
async function loadProjectMcpJson(projectPath: string): Promise<McpJsonConfig> {
  try {
    const mcpJsonPath = path.join(projectPath, '.mcp.json');
    const content = await fs.readFile(mcpJsonPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Get all MCPs for a project (merged from all sources)
 */
async function getAllProjectMcps(projectPath: string): Promise<{
  mcpServers: Record<string, McpServerConfig>;
  disabledMcpServers: string[];
  sources: { local: string[]; project: string[] };
}> {
  const { projects } = await loadClaudeConfig();
  const projectMcp = await loadProjectMcpJson(projectPath);
  
  const localConfig = projects[projectPath] || {};
  const localServers = localConfig.mcpServers || {};
  const projectServers = projectMcp.mcpServers || {};
  
  // Merge servers (local takes precedence)
  const mcpServers = { ...projectServers, ...localServers };
  const disabledMcpServers = localConfig.disabledMcpServers || [];
  
  return {
    mcpServers,
    disabledMcpServers,
    sources: {
      local: Object.keys(localServers),
      project: Object.keys(projectServers)
    }
  };
}

/**
 * Save Claude Code config - preserves full structure
 */
async function saveClaudeConfig(raw: RawClaudeConfig, projectPath: string, projectConfig: ProjectConfig): Promise<void> {
  // Update in the correct location (prefer "projects" if it exists)
  if (raw.projects) {
    raw.projects[projectPath] = projectConfig;
  } else {
    (raw as any)[projectPath] = projectConfig;
  }
  await fs.writeFile(CLAUDE_CONFIG_PATH, JSON.stringify(raw, null, 2));
}

/**
 * Get current project path
 */
function getCurrentProjectPath(): string {
  return process.cwd();
}

/**
 * List MCPs and their status
 */
export async function runMcpContextList(): Promise<void> {
  const projectPath = getCurrentProjectPath();
  const { mcpServers, disabledMcpServers, sources } = await getAllProjectMcps(projectPath);

  console.log(chalk.blue('\n🔍 MCP Context Status\n'));
  console.log(chalk.gray(`Project: ${projectPath}\n`));

  if (Object.keys(mcpServers).length === 0) {
    console.log(chalk.yellow('No MCPs configured for this project.\n'));
    console.log('MCPs can be configured in:');
    console.log(chalk.gray('  • ~/.claude.json (local scope) - run: claude mcp add <name> ...'));
    console.log(chalk.gray('  • .mcp.json (project scope) - shared with team'));
    console.log();
    return;
  }

  const disabled = new Set(disabledMcpServers);
  
  // Show sources
  if (sources.local.length > 0) {
    console.log(chalk.gray(`Local MCPs (${sources.local.length}): ${sources.local.join(', ')}`));
  }
  if (sources.project.length > 0) {
    console.log(chalk.gray(`Project MCPs (${sources.project.length}): ${sources.project.join(', ')}`));
  }
  console.log();

  console.log(chalk.cyan('MCP Servers:\n'));

  let enabledCount = 0;
  let disabledCount = 0;
  let totalTokens = 0;

  for (const [id, server] of Object.entries(mcpServers)) {
    const isDisabled = disabled.has(id);
    const status = isDisabled 
      ? chalk.gray('○ disabled') 
      : chalk.green('● enabled');
    
    // Estimate tokens (rough estimate based on tool count)
    const estimatedTokens = isDisabled ? 0 : 50; // ~50 tokens per enabled MCP
    totalTokens += estimatedTokens;

    if (isDisabled) {
      disabledCount++;
    } else {
      enabledCount++;
    }

    console.log(`  ${status} ${chalk.white(id)}`);
    console.log(chalk.gray(`     ${server.command} ${server.args?.slice(0, 2).join(' ')}`));
    
    if (ALWAYS_ENABLED.includes(id)) {
      console.log(chalk.yellow('     ⚠️  Required by Iris'));
    }
    console.log();
  }

  console.log('─'.repeat(50));
  console.log(`  ${chalk.green('●')} Enabled: ${enabledCount} (~${enabledCount * 50} tokens)`);
  console.log(`  ${chalk.gray('○')} Disabled: ${disabledCount} (0 tokens)`);
  console.log();

  console.log(chalk.blue('💡 Why This Matters:'));
  console.log('  • Each enabled MCP eats context tokens (check /context in Claude Code)');
  console.log('  • Disabled MCPs = 0 tokens but still accessible via Iris');
  console.log('  • More free context = longer conversations, better responses');
  console.log();
  console.log(chalk.yellow('🎯 Recommendation:'));
  console.log(`  Run ${chalk.cyan('npx iris mcp context optimize')} to disable unused MCPs`);
  console.log('  Iris will document their tools so Claude still knows what\'s available');
  console.log();
}

/**
 * Disable specific MCPs
 */
export async function runMcpContextDisable(mcpIds: string[]): Promise<void> {
  const { raw, projects } = await loadClaudeConfig();
  const projectPath = getCurrentProjectPath();
  
  if (!projects[projectPath]) {
    console.log(chalk.yellow('No project config found. Run this in a Claude Code project.\n'));
    return;
  }

  const projectConfig = projects[projectPath];
  const disabled = new Set(projectConfig.disabledMcpServers || []);

  console.log(chalk.blue('\n🔒 Disabling MCPs...\n'));

  for (const id of mcpIds) {
    if (ALWAYS_ENABLED.includes(id)) {
      console.log(chalk.yellow(`⚠️  Skipping ${id} - required by Iris`));
      continue;
    }

    if (disabled.has(id)) {
      console.log(chalk.gray(`  Already disabled: ${id}`));
    } else {
      disabled.add(id);
      console.log(chalk.green(`  ✓ Disabled: ${id}`));
    }
  }

  projectConfig.disabledMcpServers = Array.from(disabled);
  await saveClaudeConfig(raw, projectPath, projectConfig);

  console.log(chalk.green('\n✅ Config updated. Restart Claude Code to apply.\n'));
}

/**
 * Enable specific MCPs
 */
export async function runMcpContextEnable(mcpIds: string[]): Promise<void> {
  const { raw, projects } = await loadClaudeConfig();
  const projectPath = getCurrentProjectPath();
  
  if (!projects[projectPath]) {
    console.log(chalk.yellow('No project config found. Run this in a Claude Code project.\n'));
    return;
  }

  const projectConfig = projects[projectPath];
  const disabled = new Set(projectConfig.disabledMcpServers || []);

  console.log(chalk.blue('\n🔓 Enabling MCPs...\n'));

  for (const id of mcpIds) {
    if (disabled.has(id)) {
      disabled.delete(id);
      console.log(chalk.green(`  ✓ Enabled: ${id}`));
    } else {
      console.log(chalk.gray(`  Already enabled: ${id}`));
    }
  }

  projectConfig.disabledMcpServers = Array.from(disabled);
  await saveClaudeConfig(raw, projectPath, projectConfig);

  console.log(chalk.green('\n✅ Config updated. Restart Claude Code to apply.\n'));
}

/**
 * Optimize - disable all MCPs except essential ones
 */
export async function runMcpContextOptimize(options: {
  keepEnabled?: string[];
  interactive?: boolean;
} = {}): Promise<void> {
  const { raw, projects } = await loadClaudeConfig();
  const projectPath = getCurrentProjectPath();
  
  // Get merged MCP config
  const { mcpServers, disabledMcpServers } = await getAllProjectMcps(projectPath);
  
  if (Object.keys(mcpServers).length === 0) {
    console.log(chalk.yellow('No MCPs configured for this project.\n'));
    return;
  }

  // Get or create project config
  let projectConfig = projects[projectPath];
  if (!projectConfig) {
    projectConfig = { mcpServers: {}, disabledMcpServers: [] };
  }
  
  const currentDisabled = new Set(disabledMcpServers);

  console.log(chalk.blue('\n⚡ MCP Context Optimizer\n'));
  console.log(chalk.yellow('💡 Confused? Run /context in Claude Code to see how much context your MCPs use.'));
  console.log(chalk.gray('   This tool makes MCP context usage = 0 while keeping tools accessible.\n'));
  console.log(chalk.gray('   Disabled MCPs are documented as skills so Claude knows what\'s available.\n'));

  const mcpIds = Object.keys(mcpServers);
  const keepEnabled = new Set([...ALWAYS_ENABLED, ...(options.keepEnabled || [])]);

  let toDisable: string[] = [];

  // Interactive mode - let user choose
  if (options.interactive !== false) {
    const choices = mcpIds.map(id => ({
      name: `${id}${ALWAYS_ENABLED.includes(id) ? ' (required)' : ''}${currentDisabled.has(id) ? ' [currently disabled]' : ''}`,
      value: id,
      checked: keepEnabled.has(id) || !currentDisabled.has(id),
      disabled: ALWAYS_ENABLED.includes(id) ? 'Required by Iris' : false
    }));

    const { selected } = await inquirer.prompt([{
      type: 'checkbox',
      name: 'selected',
      message: 'Select MCPs to keep ENABLED (others will be disabled):',
      choices,
      pageSize: 15
    }]);

    // Add always-enabled back
    for (const id of ALWAYS_ENABLED) {
      if (!selected.includes(id)) {
        selected.push(id);
      }
    }

    // Calculate what to disable
    toDisable = mcpIds.filter(id => !selected.includes(id));
    
    if (toDisable.length === 0) {
      console.log(chalk.yellow('\nNo changes made.\n'));
      return;
    }

    projectConfig.disabledMcpServers = toDisable;
    await saveClaudeConfig(raw, projectPath, projectConfig);

    console.log(chalk.green(`\n✅ Disabled ${toDisable.length} MCP(s):`));
    toDisable.forEach(id => console.log(chalk.gray(`   • ${id}`)));
    
    console.log(chalk.green(`\n✅ Kept ${selected.length} MCP(s) enabled:`));
    selected.forEach((id: string) => console.log(chalk.green(`   • ${id}`)));

  } else {
    // Non-interactive - disable everything except keepEnabled
    toDisable = mcpIds.filter(id => !keepEnabled.has(id));
    
    projectConfig.disabledMcpServers = toDisable;
    await saveClaudeConfig(raw, projectPath, projectConfig);

    console.log(chalk.green(`✅ Disabled ${toDisable.length} MCP(s), kept ${keepEnabled.size} enabled.`));
  }

  console.log(chalk.blue('\n💡 Restart Claude Code to apply changes.'));
  console.log(chalk.gray(`   Run ${chalk.cyan('npx iris mcp context enable <name>')} to re-enable specific MCPs.\n`));

  // Ask if they want to scan and document the disabled MCPs
  if (toDisable.length > 0) {
    const { wantScan } = await inquirer.prompt([{
      type: 'confirm',
      name: 'wantScan',
      message: 'Would you like Iris to scan and document the disabled MCPs\' tools?\n  (This lets Claude know what tools are available even when MCPs are disabled)',
      default: true
    }]);

    if (wantScan) {
      console.log(chalk.blue('\n📡 Scanning MCPs for tool documentation...\n'));
      try {
        const { runMcpScan } = await import('./mcp-scan.js');
        await runMcpScan({ mcpIds: toDisable });
      } catch (error) {
        console.log(chalk.yellow('⚠️  Scan failed - you can run it later with: npx iris mcp scan'));
      }
    } else {
      console.log(chalk.gray('\n💡 You can scan MCPs later with: npx iris mcp scan\n'));
    }
  }
}

/**
 * Show context usage summary across all projects
 */
export async function runMcpContextSummary(): Promise<void> {
  const { projects } = await loadClaudeConfig();
  
  console.log(chalk.blue('\n📊 MCP Context Summary (All Projects)\n'));

  let totalProjects = 0;
  let totalMcps = 0;
  let totalDisabled = 0;

  for (const [projectPath, projectConfig] of Object.entries(projects)) {
    if (!projectConfig.mcpServers || Object.keys(projectConfig.mcpServers).length === 0) continue;
    
    totalProjects++;
    const mcpCount = Object.keys(projectConfig.mcpServers).length;
    const disabledCount = (projectConfig.disabledMcpServers || []).length;
    
    totalMcps += mcpCount;
    totalDisabled += disabledCount;

    const shortPath = projectPath.replace(os.homedir(), '~');
    const enabled = mcpCount - disabledCount;
    
    console.log(`${chalk.cyan(shortPath)}`);
    console.log(`  MCPs: ${mcpCount} total, ${chalk.green(enabled + ' enabled')}, ${chalk.gray(disabledCount + ' disabled')}`);
    console.log();
  }

  console.log('─'.repeat(50));
  console.log(`Total: ${totalProjects} projects, ${totalMcps} MCPs, ${totalDisabled} disabled`);
  console.log(`Estimated savings: ~${totalDisabled * 50} tokens\n`);
}

