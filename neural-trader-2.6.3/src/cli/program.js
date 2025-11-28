/**
 * Neural Trader CLI - Main Program
 * Commander.js-based CLI with modular command structure
 * Version: 3.0.0 (Enhanced)
 */

const { Command } = require('commander');
const path = require('path');
const { colors, formatStatus } = require('./ui');
const versionCommand = require('./commands/version');
const helpCommand = require('./commands/help');
const { mcpCommand } = require('./commands/mcp');
const { agentCommand } = require('./commands/agent');
const { createDeployCommand } = require('./commands/deploy');

/**
 * Create and configure the main CLI program
 * @returns {Command} Configured commander program
 */
function createProgram() {
  const program = new Command();
  const pkg = require(path.join(__dirname, '../../package.json'));

  // Program configuration
  program
    .name('neural-trader')
    .description('High-performance neural trading system with GPU acceleration')
    .version(pkg.version, '-v, --version', 'Show version information')
    .helpOption('-h, --help', 'Show help information');

  // Global options
  program
    .option('--debug', 'Enable debug logging')
    .option('--json', 'Output in JSON format')
    .option('--no-color', 'Disable colored output')
    .option('-q, --quiet', 'Quiet mode (minimal output)');

  // Version command
  program
    .command('version')
    .description('Show version and system information')
    .action(async (options) => {
      try {
        const opts = { ...program.opts(), ...options };
        await versionCommand(opts);
      } catch (error) {
        handleError(error, program);
      }
    });

  // Help command (enhanced)
  program
    .command('help')
    .description('Show comprehensive help information')
    .action(async (options) => {
      try {
        const opts = { ...program.opts(), ...options };
        await helpCommand(opts);
      } catch (error) {
        handleError(error, program);
      }
    });

  // MCP command
  program
    .command('mcp <subcommand> [args...]')
    .description('Manage MCP server (99+ tools)')
    .allowUnknownOption()
    .action(async (subcommand, args, options) => {
      try {
        const allArgs = [subcommand, ...args];
        await mcpCommand(allArgs);
      } catch (error) {
        handleError(error, program);
      }
    });

  // Agent command - Multi-agent coordination system
  program
    .command('agent <subcommand> [args...]')
    .description('Multi-agent coordination and swarm intelligence')
    .allowUnknownOption()
    .action(async (subcommand, args, options) => {
      try {
        const allArgs = [subcommand, ...args];
        await agentCommand(...allArgs);
      } catch (error) {
        handleError(error, program);
      }
    });

  // Deploy command - Cloud deployment to E2B and Flow Nexus
  program.addCommand(createDeployCommand());

  // Make help the default action
  program.on('--help', async () => {
    await helpCommand({});
  });

  return program;
}

/**
 * Handle command errors
 * @param {Error} error - Error object
 * @param {Command} program - Commander program
 */
function handleError(error, program) {
  const debug = program.opts().debug;

  console.error('');
  console.error(formatStatus('error', colors.error(`Error: ${error.message}`)));

  if (debug && error.stack) {
    console.error('');
    console.error(colors.dim('Stack trace:'));
    console.error(colors.dim(error.stack));
  }

  console.error('');
  console.error(colors.dim('Run ') + colors.code('neural-trader help') + colors.dim(' for usage information'));
  console.error('');

  process.exit(1);
}

/**
 * Run the CLI program
 * @param {Array<string>} argv - Command line arguments
 */
async function run(argv = process.argv) {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    handleError(error, program);
  }
}

module.exports = {
  createProgram,
  run
};
