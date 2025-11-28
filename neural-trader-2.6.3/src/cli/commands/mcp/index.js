/**
 * MCP Commands Index
 * Main entry point for all MCP commands
 */

const { startCommand } = require('./start');
const { stopCommand } = require('./stop');
const { restartCommand } = require('./restart');
const { statusCommand } = require('./status');
const { toolsCommand } = require('./tools');
const { testCommand } = require('./test');
const { configureCommand } = require('./configure');
const { claudeSetupCommand } = require('./claude-setup');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m'
};

/**
 * Parse command line arguments
 * @param {Array} args - Command line arguments
 * @returns {Object}
 */
function parseArgs(args) {
  const parsed = {
    _: [],
    flags: {}
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      // Long flag
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('-')) {
        // Flag with value
        parsed.flags[key] = nextArg;
        i++;
      } else {
        // Boolean flag
        parsed.flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      // Short flag
      const key = arg.slice(1);
      parsed.flags[key] = true;
    } else {
      // Positional argument
      parsed._.push(arg);
    }
  }

  return parsed;
}

/**
 * Main MCP command handler
 * @param {Array} args - Command line arguments
 */
async function mcpCommand(args = []) {
  const parsed = parseArgs(args);
  const subcommand = parsed._[0] || 'help';
  const subcommandArgs = parsed._.slice(1);
  const options = parsed.flags;

  try {
    switch (subcommand) {
      case 'start':
        await startCommand(options);
        break;

      case 'stop':
        await stopCommand();
        break;

      case 'restart':
        await restartCommand(options);
        break;

      case 'status':
        await statusCommand(options);
        break;

      case 'tools':
        await toolsCommand(options);
        break;

      case 'test':
        await testCommand(subcommandArgs[0], options);
        break;

      case 'configure':
        await configureCommand(options);
        break;

      case 'claude-setup':
        await claudeSetupCommand(options);
        break;

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error(`\n${c.bright}Error:${c.reset} ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Show MCP command help
 */
function showHelp() {
  console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bright}     Neural Trader MCP Server Management${c.reset}`);
  console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}\n`);

  console.log(`${c.blue}${c.bright}Usage:${c.reset} neural-trader mcp <command> [options]\n`);

  console.log(`${c.blue}${c.bright}Server Management:${c.reset}`);
  console.log(`  ${c.bright}start${c.reset}              Start the MCP server`);
  console.log(`    ${c.dim}--transport <type>   Transport type: stdio (default) or http${c.reset}`);
  console.log(`    ${c.dim}--port <number>      Port for HTTP transport (default: 3000)${c.reset}`);
  console.log(`    ${c.dim}--stub-mode          Enable stub mode for testing${c.reset}`);
  console.log(`    ${c.dim}--no-daemon          Run in foreground (not as daemon)${c.reset}`);
  console.log('');
  console.log(`  ${c.bright}stop${c.reset}               Stop the MCP server`);
  console.log(`  ${c.bright}restart${c.reset}            Restart the MCP server`);
  console.log(`  ${c.bright}status${c.reset}             Show server status`);
  console.log(`    ${c.dim}--watch              Watch status with live updates${c.reset}`);
  console.log(`    ${c.dim}--interval <ms>      Update interval for watch mode${c.reset}`);
  console.log('');

  console.log(`${c.blue}${c.bright}Tools:${c.reset}`);
  console.log(`  ${c.bright}tools${c.reset}              List available MCP tools (99+)`);
  console.log(`    ${c.dim}--category <cat>     Filter by category${c.reset}`);
  console.log(`    ${c.dim}--search <query>     Search tools${c.reset}`);
  console.log(`    ${c.dim}--format <format>    Output format: table (default), list, json, categories${c.reset}`);
  console.log('');
  console.log(`  ${c.bright}test <tool>${c.reset}        Test an MCP tool`);
  console.log(`    ${c.dim}<args>               Tool arguments as JSON${c.reset}`);
  console.log('');

  console.log(`${c.blue}${c.bright}Configuration:${c.reset}`);
  console.log(`  ${c.bright}configure${c.reset}          Interactive configuration wizard`);
  console.log(`    ${c.dim}--show               Show current configuration${c.reset}`);
  console.log(`    ${c.dim}--reset              Reset to defaults${c.reset}`);
  console.log(`    ${c.dim}--get <key>          Get configuration value${c.reset}`);
  console.log(`    ${c.dim}--set <key>=<value>  Set configuration value${c.reset}`);
  console.log(`    ${c.dim}--export             Export configuration${c.reset}`);
  console.log(`    ${c.dim}--import <file>      Import configuration${c.reset}`);
  console.log('');

  console.log(`${c.blue}${c.bright}Claude Desktop Integration:${c.reset}`);
  console.log(`  ${c.bright}claude-setup${c.reset}       Auto-configure Claude Desktop`);
  console.log(`    ${c.dim}--status             Show Claude Desktop status${c.reset}`);
  console.log(`    ${c.dim}--list               List all configured MCP servers${c.reset}`);
  console.log(`    ${c.dim}--remove             Remove Neural Trader MCP${c.reset}`);
  console.log(`    ${c.dim}--test               Test configuration${c.reset}`);
  console.log(`    ${c.dim}--instructions       Show manual setup instructions${c.reset}`);
  console.log('');

  console.log(`${c.blue}${c.bright}Examples:${c.reset}`);
  console.log(`  ${c.dim}# Start the MCP server${c.reset}`);
  console.log(`  ${c.bright}neural-trader mcp start${c.reset}\n`);
  console.log(`  ${c.dim}# List all available tools${c.reset}`);
  console.log(`  ${c.bright}neural-trader mcp tools${c.reset}\n`);
  console.log(`  ${c.dim}# Search for trading tools${c.reset}`);
  console.log(`  ${c.bright}neural-trader mcp tools --search trading${c.reset}\n`);
  console.log(`  ${c.dim}# Configure Claude Desktop${c.reset}`);
  console.log(`  ${c.bright}neural-trader mcp claude-setup${c.reset}\n`);
  console.log(`  ${c.dim}# Watch server status${c.reset}`);
  console.log(`  ${c.bright}neural-trader mcp status --watch${c.reset}\n`);

  console.log(`${c.blue}For more information: https://github.com/ruvnet/neural-trader${c.reset}\n`);
}

module.exports = { mcpCommand, showHelp };
