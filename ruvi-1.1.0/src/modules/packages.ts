import chalk from 'chalk';
import { printSection, printDivider, printError, printSuccess, printInfo } from '../utils/ui.js';
import enquirer from 'enquirer';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';

const { prompt } = enquirer;
const execAsync = promisify(exec);

interface NpmPackage {
  name: string;
  version: string;
  description: string;
  date: string;
  links?: {
    npm?: string;
    homepage?: string;
    repository?: string;
  };
}

interface NpmSearchResponse {
  objects: Array<{
    package: NpmPackage;
  }>;
  total: number;
}

const NPM_SEARCH_API = 'https://registry.npmjs.org/-/v1/search';
const AUTHOR = 'ruvnet';

export async function listPackages(): Promise<void> {
  printSection('📦 rUv Packages');
  console.log(chalk.gray('Browse and install packages from the rUv ecosystem'));
  console.log();

  const spinner = ora('Fetching packages from npm registry...').start();

  try {
    const response = await fetch(`${NPM_SEARCH_API}?text=author:${AUTHOR}&size=250`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as NpmSearchResponse;
    const packages = data.objects || [];

    spinner.succeed(`Found ${packages.length} packages`);
    console.log();

    if (packages.length === 0) {
      printInfo('No packages found');
      return;
    }

    // Categorize packages
    const categories = categorizePackages(packages);

    // Display by category
    for (const [category, pkgs] of Object.entries(categories)) {
      if (pkgs.length > 0) {
        console.log(chalk.cyan.bold(`\n${getCategoryEmoji(category)} ${category}`));
        printDivider();

        pkgs.forEach((pkg, index) => {
          const { name, version, description } = pkg.package;
          console.log(chalk.yellow(`${index + 1}. ${name}`) + chalk.gray(` v${version}`));
          if (description) {
            console.log(chalk.white(`   ${truncate(description, 80)}`));
          }
          console.log(chalk.blue(`   npm i ${name}`));
          console.log();
        });
      }
    }

    console.log();
    console.log(chalk.gray('─'.repeat(80)));
    console.log(chalk.green(`✓ Total: ${packages.length} packages`));
    console.log();

    // Ask if user wants to install
    const { action } = await prompt<{ action: string }>({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'search', message: '🔍 Search packages' },
        { name: 'install', message: '📥 Install a package' },
        { name: 'mcp', message: '🔌 View MCP servers' },
        { name: 'back', message: '← Back to menu' },
      ],
    });

    switch (action) {
      case 'search':
        await searchPackages();
        break;
      case 'install':
        await installPackage(packages);
        break;
      case 'mcp':
        await showMCPServers(packages);
        break;
    }
  } catch (error) {
    spinner.fail('Failed to fetch packages');
    printError(error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function searchPackages(): Promise<void> {
  console.log();
  const { query } = await prompt<{ query: string }>({
    type: 'input',
    name: 'query',
    message: 'Search packages:',
    validate: (input: string) => input.trim().length > 0 || 'Please enter a search term',
  });

  const spinner = ora('Searching...').start();

  try {
    const response = await fetch(
      `${NPM_SEARCH_API}?text=author:${AUTHOR}+${encodeURIComponent(query)}&size=50`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json() as NpmSearchResponse;
    const packages = data.objects || [];

    spinner.stop();

    if (packages.length === 0) {
      printInfo(`No packages found matching "${query}"`);
      return;
    }

    console.log();
    console.log(chalk.green(`Found ${packages.length} packages matching "${query}":`));
    console.log();

    packages.forEach((pkg, index) => {
      const { name, version, description } = pkg.package;
      console.log(chalk.yellow(`${index + 1}. ${name}`) + chalk.gray(` v${version}`));
      if (description) {
        console.log(chalk.white(`   ${description}`));
      }
      console.log(chalk.blue(`   npm i ${name}`));
      console.log();
    });

    // Ask if user wants to install
    const { shouldInstall } = await prompt<{ shouldInstall: boolean }>({
      type: 'confirm',
      name: 'shouldInstall',
      message: 'Would you like to install one of these packages?',
      initial: false,
    });

    if (shouldInstall) {
      await installPackage(packages);
    }
  } catch (error) {
    spinner.fail('Search failed');
    printError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function installPackage(
  packages: Array<{ package: NpmPackage }>
): Promise<void> {
  console.log();
  const { packageName } = await prompt<{ packageName: string }>({
    type: 'autocomplete',
    name: 'packageName',
    message: 'Select package to install:',
    choices: packages.map((pkg) => ({
      name: pkg.package.name,
      message: `${pkg.package.name} - ${pkg.package.description || 'No description'}`,
    })),
  });

  const { installType } = await prompt<{ installType: string }>({
    type: 'select',
    name: 'installType',
    message: 'How would you like to install?',
    choices: [
      { name: 'global', message: '🌍 Global (npm install -g) - Available everywhere' },
      { name: 'local', message: '📁 Local project (npm install) - Add to dependencies' },
      { name: 'dev', message: '🛠️  Dev dependency (npm install --save-dev)' },
      { name: 'npx', message: '⚡ Run with npx (no install) - Try it once' },
      { name: 'npx-latest', message: '🚀 Run latest with npx (@latest)' },
      { name: 'yarn', message: '🧶 Yarn (yarn add) - Alternative package manager' },
      { name: 'yarn-global', message: '🌐 Yarn global (yarn global add)' },
      { name: 'pnpm', message: '📦 pnpm (pnpm add) - Fast, efficient' },
      { name: 'pnpm-global', message: '🌍 pnpm global (pnpm add -g)' },
      { name: 'copy', message: '📋 Copy command - Manual install' },
    ],
  });

  let command = '';
  let commandDisplay = '';

  switch (installType) {
    case 'global':
      command = `npm install -g ${packageName}`;
      commandDisplay = command;
      break;
    case 'local':
      command = `npm install ${packageName}`;
      commandDisplay = command;
      break;
    case 'dev':
      command = `npm install --save-dev ${packageName}`;
      commandDisplay = command;
      break;
    case 'npx':
      command = `npx ${packageName}`;
      commandDisplay = command;
      break;
    case 'npx-latest':
      command = `npx ${packageName}@latest`;
      commandDisplay = command;
      break;
    case 'yarn':
      command = `yarn add ${packageName}`;
      commandDisplay = command;
      break;
    case 'yarn-global':
      command = `yarn global add ${packageName}`;
      commandDisplay = command;
      break;
    case 'pnpm':
      command = `pnpm add ${packageName}`;
      commandDisplay = command;
      break;
    case 'pnpm-global':
      command = `pnpm add -g ${packageName}`;
      commandDisplay = command;
      break;
    case 'copy':
      console.log();
      console.log(chalk.cyan('📋 Available Installation Commands:'));
      console.log();
      console.log(chalk.bold('npm:'));
      console.log(chalk.white(`  npm install -g ${packageName}          # Global`));
      console.log(chalk.white(`  npm install ${packageName}             # Local`));
      console.log(chalk.white(`  npm install --save-dev ${packageName}  # Dev dependency`));
      console.log(chalk.white(`  npx ${packageName}                     # Run without install`));
      console.log();
      console.log(chalk.bold('yarn:'));
      console.log(chalk.white(`  yarn global add ${packageName}         # Global`));
      console.log(chalk.white(`  yarn add ${packageName}                # Local`));
      console.log(chalk.white(`  yarn add -D ${packageName}             # Dev dependency`));
      console.log();
      console.log(chalk.bold('pnpm:'));
      console.log(chalk.white(`  pnpm add -g ${packageName}             # Global`));
      console.log(chalk.white(`  pnpm add ${packageName}                # Local`));
      console.log(chalk.white(`  pnpm add -D ${packageName}             # Dev dependency`));
      console.log();
      return;
  }

  const spinner = ora(`Running: ${commandDisplay}`).start();

  try {
    const { stdout, stderr } = await execAsync(command);

    if (stderr && !stderr.includes('npm WARN') && !stderr.includes('warning')) {
      spinner.warn('Completed with warnings');
      console.log(chalk.yellow(stderr));
    } else {
      spinner.succeed('Installation complete!');
    }

    if (stdout) {
      console.log(chalk.gray(stdout));
    }

    console.log();
    printSuccess(`${packageName} is ready to use!`);

    // Show usage hint based on install type
    console.log();
    if (installType === 'global' || installType === 'yarn-global' || installType === 'pnpm-global') {
      console.log(chalk.cyan('💡 Usage:'));
      console.log(chalk.white(`   ${packageName} --help`));
    } else if (installType === 'npx' || installType === 'npx-latest') {
      console.log(chalk.cyan('💡 To run again:'));
      console.log(chalk.white(`   ${command}`));
    } else if (installType === 'local' || installType === 'yarn' || installType === 'pnpm') {
      console.log(chalk.cyan('💡 Usage in your project:'));
      console.log(chalk.white(`   import ${packageName.replace(/-/g, '')} from '${packageName}'`));
    } else if (installType === 'dev') {
      console.log(chalk.cyan('💡 Available in dev dependencies'));
      console.log(chalk.white(`   Check package.json devDependencies`));
    }
  } catch (error) {
    spinner.fail('Installation failed');
    console.log();
    printError(error instanceof Error ? error.message : 'Unknown error');

    // Suggest alternatives
    console.log();
    console.log(chalk.yellow('💡 Try these alternatives:'));
    if (command.includes('npm')) {
      console.log(chalk.white(`   yarn add ${packageName}    # Using Yarn`));
      console.log(chalk.white(`   pnpm add ${packageName}    # Using pnpm`));
      console.log(chalk.white(`   npx ${packageName}         # Run without install`));
    }
  }
}

async function showMCPServers(
  packages: Array<{ package: NpmPackage }>
): Promise<void> {
  console.log();
  printSection('🔌 MCP Servers');
  console.log(chalk.gray('Model Context Protocol servers for AI assistants'));
  console.log();

  // Filter packages that are likely MCP servers
  const mcpPackages = packages.filter((pkg) => {
    const name = pkg.package.name.toLowerCase();
    const desc = (pkg.package.description || '').toLowerCase();
    return (
      name.includes('mcp') ||
      desc.includes('mcp') ||
      desc.includes('model context protocol') ||
      name === 'claude-flow' ||
      name === 'agentic-flow' ||
      name === 'flow-nexus' ||
      name === 'ruv-swarm'
    );
  });

  if (mcpPackages.length === 0) {
    printInfo('No MCP servers found');
    return;
  }

  console.log(chalk.green(`Found ${mcpPackages.length} MCP servers:\n`));

  mcpPackages.forEach((pkg, index) => {
    const { name, version, description } = pkg.package;
    console.log(chalk.yellow(`${index + 1}. ${name}`) + chalk.gray(` v${version}`));
    if (description) {
      console.log(chalk.white(`   ${truncate(description, 80)}`));
    }
    console.log();
    console.log(chalk.cyan('   Configuration for Claude Desktop:'));
    console.log(chalk.gray('   {'));
    console.log(chalk.gray('     "mcpServers": {'));
    console.log(chalk.white(`       "${name}": {`));
    console.log(chalk.white('         "command": "npx",'));
    console.log(chalk.white(`         "args": ["-y", "${name}@latest", "mcp"]`));
    console.log(chalk.white('       }'));
    console.log(chalk.gray('     }'));
    console.log(chalk.gray('   }'));
    console.log();
  });

  const { copyConfig } = await prompt<{ copyConfig: boolean }>({
    type: 'confirm',
    name: 'copyConfig',
    message: 'Would you like help setting up an MCP server?',
    initial: true,
  });

  if (copyConfig) {
    await setupMCPServer(mcpPackages);
  }
}

async function setupMCPServer(
  mcpPackages: Array<{ package: NpmPackage }>
): Promise<void> {
  console.log();
  const { packageName } = await prompt<{ packageName: string }>({
    type: 'select',
    name: 'packageName',
    message: 'Select MCP server to set up:',
    choices: mcpPackages.map((pkg) => ({
      name: pkg.package.name,
      message: pkg.package.name,
    })),
  });

  console.log();
  printSection(`🔧 Setup: ${packageName}`);
  console.log();

  console.log(chalk.cyan('1. Find your Claude Desktop config file:'));
  console.log(chalk.gray('   macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json'));
  console.log(chalk.gray('   Windows: %APPDATA%\\Claude\\claude_desktop_config.json'));
  console.log(chalk.gray('   Linux:   ~/.config/Claude/claude_desktop_config.json'));
  console.log();

  console.log(chalk.cyan('2. Add this configuration:'));
  console.log();

  const config = {
    mcpServers: {
      [packageName]: {
        command: 'npx',
        args: ['-y', `${packageName}@latest`, 'mcp'],
      },
    },
  };

  console.log(chalk.white(JSON.stringify(config, null, 2)));
  console.log();

  console.log(chalk.cyan('3. Restart Claude Desktop'));
  console.log();

  console.log(chalk.cyan('4. Look for the 🔌 icon to confirm connection'));
  console.log();

  printSuccess('Setup instructions displayed!');
}

function categorizePackages(
  packages: Array<{ package: NpmPackage }>
): Record<string, Array<{ package: NpmPackage }>> {
  const categories: Record<string, Array<{ package: NpmPackage }>> = {
    'AI Orchestration': [],
    'Agent Frameworks': [],
    'MCP Servers': [],
    'Databases & Storage': [],
    'Security & Defense': [],
    'Research Tools': [],
    'Development Tools': [],
    'Other': [],
  };

  packages.forEach((pkg) => {
    const name = pkg.package.name.toLowerCase();
    const desc = (pkg.package.description || '').toLowerCase();

    if (
      name.includes('flow') ||
      desc.includes('orchestration') ||
      desc.includes('swarm')
    ) {
      categories['AI Orchestration'].push(pkg);
    } else if (
      name.includes('agent') ||
      desc.includes('agent') ||
      desc.includes('autonomous')
    ) {
      categories['Agent Frameworks'].push(pkg);
    } else if (name.includes('mcp') || desc.includes('mcp')) {
      categories['MCP Servers'].push(pkg);
    } else if (name.includes('db') || desc.includes('database') || desc.includes('vector')) {
      categories['Databases & Storage'].push(pkg);
    } else if (
      name.includes('defense') ||
      name.includes('defence') ||
      desc.includes('security') ||
      desc.includes('adversarial')
    ) {
      categories['Security & Defense'].push(pkg);
    } else if (
      name.includes('research') ||
      desc.includes('research') ||
      name.includes('goalie')
    ) {
      categories['Research Tools'].push(pkg);
    } else if (
      desc.includes('development') ||
      desc.includes('toolkit') ||
      desc.includes('solver')
    ) {
      categories['Development Tools'].push(pkg);
    } else {
      categories['Other'].push(pkg);
    }
  });

  return categories;
}

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'AI Orchestration': '🤖',
    'Agent Frameworks': '🧠',
    'MCP Servers': '🔌',
    'Databases & Storage': '💾',
    'Security & Defense': '🛡️',
    'Research Tools': '🔬',
    'Development Tools': '🛠️',
    'Other': '📦',
  };
  return emojiMap[category] || '📦';
}

function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}
