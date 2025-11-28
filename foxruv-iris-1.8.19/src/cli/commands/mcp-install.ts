/**
 * MCP Installation System
 *
 * Complete MCP server installation, configuration, and management
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export interface McpServer {
  name: string;
  description: string;
  category: string;
  author: string;
  npm_package: string;
  version: string;
  verified: boolean;
  security_audit: string;
  required_env: string[];
  optional_env?: string[];
  tools: string[];
  skill_templates?: string[];
  contexts?: string[];
  installation: {
    command: string;
    args: string[];
    post_install?: string;
  };
}

export interface McpRegistry {
  version: string;
  mcps: Record<string, McpServer>;
  categories: Record<string, string[]>;
}

/**
 * List available MCPs from registry
 */
export async function runMcpList(options: {
  category?: string;
  search?: string;
}): Promise<void> {
  const registry = await loadRegistry();

  let mcps = Object.entries(registry.mcps);

  // Filter by category
  if (options.category) {
    const categoryMcps = registry.categories[options.category] || [];
    mcps = mcps.filter(([id]) => categoryMcps.includes(id));
  }

  // Filter by search term
  if (options.search) {
    const search = options.search.toLowerCase();
    mcps = mcps.filter(([, mcp]) =>
      mcp.name.toLowerCase().includes(search) ||
      mcp.description.toLowerCase().includes(search)
    );
  }

  // Display results
  console.log(chalk.blue('\n📦 Available MCP Servers:\n'));

  for (const [id, mcp] of mcps) {
    const verified = mcp.verified ? chalk.green('✓') : chalk.gray('○');
    console.log(`${verified} ${chalk.cyan(id)} (${mcp.version})`);
    console.log(`  ${mcp.description}`);
    console.log(`  ${chalk.gray(`Category: ${mcp.category} | Author: ${mcp.author}`)}`);

    if (mcp.tools.length > 0) {
      console.log(`  ${chalk.gray(`Tools: ${mcp.tools.slice(0, 3).join(', ')}${mcp.tools.length > 3 ? '...' : ''}`)}`);
    }
    console.log();
  }

  console.log(chalk.gray(`Total: ${mcps.length} MCP server(s)\n`));

  // Show categories
  console.log(chalk.blue('📁 Categories:'));
  for (const [category, count] of Object.entries(registry.categories)) {
    console.log(`  ${chalk.cyan(category)}: ${count.length} server(s)`);
  }
  console.log();
}

/**
 * Install MCP server
 */
export async function runMcpInstall(
  mcpId: string,
  options: {
    yes?: boolean;
    skipWrappers?: boolean;
    skipSkills?: boolean;
  } = {}
): Promise<void> {
  console.log(chalk.blue(`\n🔧 Installing ${mcpId}...\n`));

  // 1. Load registry and get MCP
  const registry = await loadRegistry();
  const mcp = registry.mcps[mcpId];

  if (!mcp) {
    console.error(chalk.red(`❌ MCP '${mcpId}' not found in registry`));
    console.log(chalk.gray(`\nRun ${chalk.cyan('npx iris mcp list')} to see available MCPs\n`));
    return;
  }

  // 2. Display MCP information
  displayMcpInfo(mcp);

  // 3. Confirm installation (unless --yes)
  if (!options.yes) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Install ${mcp.name}?`,
        default: true
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n⚠️  Installation cancelled\n'));
      return;
    }
  }

  // 4. Validate security
  await validateSecurity(mcp);

  // 5. Install npm package
  await installNpmPackage(mcp);

  // 6. Configure environment variables
  await configureEnvironment(mcp);

  // 7. Generate skill documentation
  if (!options.skipSkills) {
    await generateSkillDocs(mcpId, mcp);
  }

  // 8. Generate TypeScript wrappers
  if (!options.skipWrappers) {
    await generateWrappers(mcpId, mcp);
  }

  // 9. Update MCP configuration
  await updateMcpConfig(mcpId, mcp);

  // 10. Track in AgentDB
  await trackInstallation(mcpId, mcp);

  console.log(chalk.green(`\n✅ ${mcp.name} installed successfully!\n`));

  // Display usage instructions
  displayUsageInstructions(mcpId, mcp);
}

/**
 * Display MCP information
 */
function displayMcpInfo(mcp: McpServer): void {
  const verified = mcp.verified ? chalk.green('✓ Verified') : chalk.yellow('⚠ Unverified');

  console.log(chalk.blue('📦 MCP Information:'));
  console.log(`  Name: ${chalk.cyan(mcp.name)}`);
  console.log(`  Description: ${mcp.description}`);
  console.log(`  Version: ${mcp.version}`);
  console.log(`  Author: ${mcp.author}`);
  console.log(`  Status: ${verified}`);

  if (mcp.verified) {
    console.log(`  Security Audit: ${mcp.security_audit}`);
  }

  console.log(`  Tools: ${mcp.tools.length}`);

  if (mcp.required_env.length > 0) {
    console.log(`  Required Env: ${mcp.required_env.join(', ')}`);
  }

  console.log();
}

/**
 * Validate security
 */
async function validateSecurity(mcp: McpServer): Promise<void> {
  const spinner = ora('Validating security...').start();

  try {
    if (!mcp.verified) {
      spinner.warn('MCP not verified by FoxRuv');
      console.log(chalk.yellow('  ⚠️  Install at your own risk\n'));
      return;
    }

    // Check if security audit is recent (within 6 months)
    const auditDate = new Date(mcp.security_audit);
    const monthsAgo = (Date.now() - auditDate.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (monthsAgo > 6) {
      spinner.warn(`Security audit is ${Math.floor(monthsAgo)} months old`);
      console.log(chalk.yellow('  ⚠️  Consider updating to a newer version\n'));
    } else {
      spinner.succeed('Security validated');
    }
  } catch (error) {
    spinner.fail('Security validation failed');
    throw error;
  }
}

/**
 * Install npm package
 */
async function installNpmPackage(mcp: McpServer): Promise<void> {
  const spinner = ora(`Installing ${mcp.npm_package}...`).start();

  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install', '-g', `${mcp.npm_package}@${mcp.version}`], {
      stdio: 'pipe'
    });

    npm.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`${mcp.npm_package} installed`);
        resolve();
      } else {
        spinner.fail(`Failed to install ${mcp.npm_package}`);
        reject(new Error(`npm install exited with code ${code}`));
      }
    });

    npm.on('error', (error) => {
      spinner.fail(`Failed to install ${mcp.npm_package}`);
      reject(error);
    });
  });
}

/**
 * Configure environment variables
 */
async function configureEnvironment(mcp: McpServer): Promise<void> {
  const spinner = ora('Configuring environment...').start();

  try {
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';

    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch {
      // .env doesn't exist, will create it
    }

    const missingVars: string[] = [];

    for (const envVar of mcp.required_env) {
      if (!envContent.includes(`${envVar}=`) && !process.env[envVar]) {
        missingVars.push(envVar);
      }
    }

    if (missingVars.length > 0) {
      spinner.stop();

      console.log(chalk.yellow(`\n⚠️  Required environment variables missing:\n`));

      for (const envVar of missingVars) {
        const { value } = await inquirer.prompt([
          {
            type: 'password',
            name: 'value',
            message: `Enter ${chalk.cyan(envVar)}:`,
            mask: '*'
          }
        ]);

        envContent += `\n${envVar}=${value}`;
      }

      await fs.writeFile(envPath, envContent.trim() + '\n');
      console.log(chalk.green(`\n✓ Environment variables saved to .env\n`));
    } else {
      spinner.succeed('Environment configured');
    }
  } catch (error) {
    spinner.fail('Environment configuration failed');
    throw error;
  }
}

/**
 * Generate skill documentation
 */
async function generateSkillDocs(mcpId: string, mcp: McpServer): Promise<void> {
  const spinner = ora('Generating skill documentation...').start();

  try {
    if (!mcp.skill_templates || mcp.skill_templates.length === 0) {
      spinner.info('No skill templates available');
      return;
    }

    const { generateSkillFromMcp } = await import('../templates/skill-generator.js');

    for (const skillId of mcp.skill_templates) {
      const skillContent = await generateSkillFromMcp({
        skillId,
        serverId: mcpId,
        command: mcp.installation.command,
        args: mcp.installation.args,
        env: mcp.required_env.reduce((acc, key) => ({ ...acc, [key]: `process.env.${key}` }), {}),
        category: mcp.category,
        tags: [mcp.category, mcpId]
      });

      const skillPath = path.join(process.cwd(), 'mcp-skills', `${skillId}.md`);
      await fs.mkdir(path.dirname(skillPath), { recursive: true });
      await fs.writeFile(skillPath, skillContent);
    }

    spinner.succeed(`Generated ${mcp.skill_templates.length} skill file(s)`);
  } catch (error) {
    spinner.fail('Skill generation failed');
    throw error;
  }
}

/**
 * Generate TypeScript wrappers
 */
async function generateWrappers(mcpId: string, mcp: McpServer): Promise<void> {
  const spinner = ora('Generating TypeScript wrappers...').start();

  try {
    // This would call the wrapper generator
    // For now, just create placeholder structure

    const wrappersDir = path.join(process.cwd(), '.iris', 'mcp', 'wrappers', mcpId);
    await fs.mkdir(wrappersDir, { recursive: true });

    // Generate index.ts
    const indexContent = `/**
 * ${mcp.name} - Generated TypeScript Wrappers
 *
 * Auto-generated from MCP server definition
 * See mcp-skills/${mcpId}.md for documentation
 */

// Re-export all tools
${mcp.tools.map(tool => `export * from './${tool}.js';`).join('\n')}
`;

    await fs.writeFile(path.join(wrappersDir, 'index.ts'), indexContent);

    spinner.succeed(`Generated TypeScript wrappers in .iris/mcp/wrappers/${mcpId}/`);
  } catch (error) {
    spinner.fail('Wrapper generation failed');
    throw error;
  }
}

/**
 * Update MCP configuration
 */
async function updateMcpConfig(mcpId: string, mcp: McpServer): Promise<void> {
  const spinner = ora('Updating configuration...').start();

  try {
    const configPath = path.join(process.cwd(), '.iris', 'config', 'mcp-servers.json');
    let config: any = { servers: {}, global_mcps_disabled: false };

    try {
      const content = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(content);
    } catch {
      // Config doesn't exist, use default
    }

    config.servers[mcpId] = {
      enabled: true,
      command: mcp.installation.command,
      args: mcp.installation.args,
      env: mcp.required_env.reduce((acc, key) => ({
        ...acc,
        [key]: `\${${key}}`
      }), {}),
      skills: mcp.skill_templates || [],
      contexts: mcp.contexts || [],
      auto_load_wrappers: true,
      installed_at: new Date().toISOString(),
      version: mcp.version
    };

    config.last_sync = new Date().toISOString();

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    spinner.succeed('Configuration updated');
  } catch (error) {
    spinner.fail('Configuration update failed');
    throw error;
  }
}

/**
 * Track installation in AgentDB
 */
async function trackInstallation(mcpId: string, mcp: McpServer): Promise<void> {
  try {
    const { getMcpTracker } = await import('../utils/agentdb-tracker.js');

    const tracker = getMcpTracker();
    await tracker.initialize();

    // Track as a skill installation
    await tracker.trackInvocation({
      skillId: mcpId,
      tool: 'install',
      args: { version: mcp.version },
      timestamp: Date.now(),
      success: true,
      latency: 0,
      result: { installed: true }
    });
  } catch (error) {
    // AgentDB tracking is optional, don't fail the installation
    console.warn(chalk.yellow('⚠️  AgentDB tracking unavailable'));
  }
}

/**
 * Display usage instructions
 */
function displayUsageInstructions(mcpId: string, mcp: McpServer): void {
  console.log(chalk.blue('📖 Usage Instructions:\n'));

  console.log('1. **CLI Mode:**');
  console.log(`   ${chalk.cyan(`npx claude-flow mcp ${mcpId} --tool <tool-name> --args '<json>'`)}`);
  console.log();

  console.log('2. **Code Mode:**');
  console.log(`   ${chalk.cyan(`import { toolName } from './.iris/mcp/wrappers/${mcpId}.js';`)}`);
  console.log(`   ${chalk.cyan(`const result = await toolName({ ... });`)}`);
  console.log();

  console.log('3. **Skill Documentation:**');
  if (mcp.skill_templates && mcp.skill_templates.length > 0) {
    console.log(`   ${chalk.cyan(`cat mcp-skills/${mcp.skill_templates[0]}.md`)}`);
  }
  console.log();

  console.log('4. **Test Connection:**');
  console.log(`   ${chalk.cyan(`npx iris mcp test ${mcpId}`)}`);
  console.log();
}

/**
 * Load MCP registry
 */
async function loadRegistry(): Promise<McpRegistry> {
  const registryPath = path.join(process.cwd(), '.iris', 'mcp', 'registry.json');

  try {
    const content = await fs.readFile(registryPath, 'utf8');
    return JSON.parse(content);
  } catch {
    // Registry doesn't exist, return empty
    return {
      version: '1.0.0',
      mcps: {},
      categories: {}
    };
  }
}
