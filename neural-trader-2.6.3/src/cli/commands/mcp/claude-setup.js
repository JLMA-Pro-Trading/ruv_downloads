/**
 * MCP Claude Setup Command
 * Auto-configure Claude Desktop integration
 */

const { ClaudeDesktop } = require('../../lib/claude-desktop');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m'
};

async function claudeSetupCommand(options = {}) {
  const claude = new ClaudeDesktop();

  console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bright}     Claude Desktop Integration Setup${c.reset}`);
  console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}\n`);

  // Check if Claude Desktop is installed
  if (!claude.isInstalled()) {
    console.log(`${c.yellow}⚠ Claude Desktop not found${c.reset}\n`);
    console.log(`${c.blue}Claude Desktop config directory:${c.reset}`);
    console.log(`  ${c.dim}${claude.configPath}${c.reset}\n`);
    console.log(`${c.blue}Installation:${c.reset}`);
    console.log(`  1. Download Claude Desktop from https://claude.ai/download`);
    console.log(`  2. Install and run Claude Desktop at least once`);
    console.log(`  3. Run this command again\n`);
    return;
  }

  if (options.remove) {
    // Remove configuration
    const result = claude.remove();
    if (result.success) {
      console.log(`${c.green}✓ ${result.message}${c.reset}\n`);
    } else {
      console.log(`${c.yellow}${result.message}${c.reset}\n`);
    }
    return;
  }

  if (options.status) {
    // Show status
    console.log(`${c.blue}Claude Desktop Status:${c.reset}\n`);
    console.log(`  Installed: ${c.green}✓${c.reset}`);
    console.log(`  Config: ${c.dim}${claude.configPath}${c.reset}`);

    const configured = claude.isConfigured();
    console.log(`  Neural Trader MCP: ${configured ? c.green + '✓ Configured' : c.yellow + '○ Not configured'}${c.reset}`);

    if (configured) {
      const config = claude.getCurrentConfig();
      console.log('');
      console.log(`${c.blue}MCP Configuration:${c.reset}`);
      console.log(`  Command: ${c.bright}${config.command}${c.reset}`);
      console.log(`  Args: ${c.dim}${config.args.join(' ')}${c.reset}`);
    }

    console.log('');
    return;
  }

  if (options.list) {
    // List all MCP servers
    const servers = claude.listServers();
    console.log(`${c.blue}Configured MCP Servers (${servers.length}):${c.reset}\n`);

    if (servers.length === 0) {
      console.log(`  ${c.dim}No MCP servers configured${c.reset}\n`);
    } else {
      servers.forEach(server => {
        console.log(`  ${c.green}•${c.reset} ${c.bright}${server.name}${c.reset}`);
        console.log(`    Command: ${c.dim}${server.command} ${server.args.join(' ')}${c.reset}`);
      });
      console.log('');
    }
    return;
  }

  if (options.test) {
    // Test configuration
    console.log(`${c.blue}Testing Claude Desktop configuration...${c.reset}\n`);
    const result = await claude.test();

    if (result.success) {
      console.log(`${c.green}✓ ${result.message}${c.reset}\n`);
    } else {
      console.log(`${c.red}✗ ${result.error}${c.reset}\n`);
    }
    return;
  }

  if (options.instructions) {
    // Show setup instructions
    const instructions = claude.getInstructions();
    console.log(instructions);
    return;
  }

  // Main setup flow
  console.log(`${c.blue}Claude Desktop detected!${c.reset}`);
  console.log(`  Config: ${c.dim}${claude.configPath}${c.reset}\n`);

  // Check if already configured
  if (claude.isConfigured()) {
    console.log(`${c.yellow}⚠ Neural Trader MCP is already configured${c.reset}\n`);

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('Overwrite existing configuration? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log(`\n${c.yellow}Setup cancelled${c.reset}\n`);
      return;
    }

    console.log('');
  }

  // Configure Claude Desktop
  try {
    console.log(`${c.blue}Configuring Claude Desktop...${c.reset}\n`);

    const result = claude.configure(options);

    if (result.success) {
      console.log(`${c.green}✓ Claude Desktop configured successfully!${c.reset}\n`);
      console.log(`${c.blue}Configuration:${c.reset}`);
      console.log(`  Config File: ${c.dim}${result.configPath}${c.reset}`);
      console.log(`  Server Name: ${c.bright}neural-trader${c.reset}`);
      console.log(`  Command: ${c.dim}${result.server.command}${c.reset}`);
      console.log(`  Args: ${c.dim}${result.server.args.join(' ')}${c.reset}`);
      console.log('');

      console.log(`${c.yellow}${c.bright}Important: Restart Claude Desktop for changes to take effect${c.reset}\n`);

      const platform = process.platform;
      if (platform === 'darwin') {
        console.log(`${c.blue}Restart command (macOS):${c.reset}`);
        console.log(`  ${c.bright}killall Claude && open -a Claude${c.reset}\n`);
      } else if (platform === 'win32') {
        console.log(`${c.blue}Restart command (Windows):${c.reset}`);
        console.log(`  ${c.bright}taskkill /F /IM Claude.exe && start Claude${c.reset}\n`);
      } else {
        console.log(`${c.blue}Restart Claude Desktop manually${c.reset}\n`);
      }

      console.log(`${c.blue}Next Steps:${c.reset}`);
      console.log(`  1. Restart Claude Desktop`);
      console.log(`  2. Look for the ${c.bright}🔌${c.reset} icon in Claude Desktop`);
      console.log(`  3. Start using Neural Trader's 99+ MCP tools!`);
      console.log('');

      console.log(`${c.blue}Available Commands:${c.reset}`);
      console.log(`  ${c.bright}neural-trader mcp claude-setup --status${c.reset}  - Check status`);
      console.log(`  ${c.bright}neural-trader mcp claude-setup --remove${c.reset}  - Remove configuration`);
      console.log(`  ${c.bright}neural-trader mcp tools${c.reset}                  - List available tools`);
      console.log('');
    }
  } catch (error) {
    console.error(`${c.red}✗ Setup failed:${c.reset}`);
    console.error(`  ${error.message}`);
    console.error('');
    process.exit(1);
  }
}

module.exports = { claudeSetupCommand };
