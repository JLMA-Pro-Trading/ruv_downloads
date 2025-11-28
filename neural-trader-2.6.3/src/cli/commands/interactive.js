/**
 * Interactive Command
 * Launches the Neural Trader interactive REPL mode
 */

const REPL = require('../lib/repl');
const ConfigManager = require('../lib/config-manager');
const chalk = require('chalk');

// Import existing CLI commands
const commands = {
  version: () => require('../../bin/cli.js').commands.version(),
  help: () => require('../../bin/cli.js').commands.help(),
  list: () => require('../../bin/cli.js').commands.list(),
  info: (pkg) => require('../../bin/cli.js').commands.info(pkg),
  doctor: () => require('../../bin/cli.js').commands.doctor(),
  test: () => require('../../bin/cli.js').commands.test()
};

/**
 * Execute interactive mode
 * @param {Object} options - Command options
 * @param {boolean} [options.noHistory] - Disable command history
 * @param {boolean} [options.noColor] - Disable colored output
 */
async function interactive(options = {}) {
  const configManager = new ConfigManager();

  // Try to load project configuration
  try {
    await configManager.loadProjectConfig();
    console.log(chalk.green('✓ Project configuration loaded'));
  } catch {
    console.log(chalk.yellow('⚠ No project configuration found (run "configure" to create one)'));
  }

  // Command executor
  const executor = async (command) => {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case 'version':
        case 'v':
          commands.version();
          break;

        case 'help':
        case 'h':
        case '?':
          if (args.length > 0) {
            showCommandHelp(args[0]);
          } else {
            commands.help();
          }
          break;

        case 'list':
        case 'ls':
          commands.list();
          break;

        case 'info':
          if (args.length === 0) {
            console.log(chalk.red('Usage: info <package>'));
          } else {
            commands.info(args[0]);
          }
          break;

        case 'doctor':
        case 'check':
          commands.doctor();
          break;

        case 'test':
          commands.test();
          break;

        case 'configure':
        case 'config':
          if (args.length === 0) {
            const ConfigWizard = require('../lib/config-wizard');
            const wizard = new ConfigWizard(configManager);
            await wizard.run();
          } else {
            await handleConfigCommand(args, configManager);
          }
          break;

        case 'init':
          if (args.length === 0) {
            console.log(chalk.red('Usage: init <type>'));
          } else {
            const cliCommands = require('../../bin/cli.js').commands;
            await cliCommands.init(args[0], args[1]);
          }
          break;

        case 'install':
          if (args.length === 0) {
            console.log(chalk.red('Usage: install <package>'));
          } else {
            const cliCommands = require('../../bin/cli.js').commands;
            await cliCommands.install(args[0]);
          }
          break;

        case 'status':
          await showStatus(configManager);
          break;

        case 'clear':
        case 'cls':
          console.clear();
          break;

        case 'pwd':
          console.log(process.cwd());
          break;

        case 'cd':
          if (args.length > 0) {
            try {
              process.chdir(args[0]);
              console.log(chalk.green(`✓ Changed directory to ${process.cwd()}`));
            } catch (error) {
              console.log(chalk.red(`✗ ${error.message}`));
            }
          } else {
            console.log(process.cwd());
          }
          break;

        case 'env':
          if (args.length === 0) {
            showEnvironment();
          } else if (args[0] === 'get' && args[1]) {
            console.log(process.env[args[1]] || chalk.dim('(not set)'));
          } else {
            console.log(chalk.red('Usage: env [get <name>]'));
          }
          break;

        default:
          console.log(chalk.red(`Unknown command: ${cmd}`));
          console.log(chalk.dim('Type "help" for available commands'));
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (process.env.DEBUG) {
        console.error(chalk.dim(error.stack));
      }
    }
  };

  // Command completion configuration
  const commandConfig = {
    version: { description: 'Show version information' },
    help: { description: 'Show help information' },
    list: { description: 'List available packages' },
    info: { description: 'Show package information', arguments: ['<package>'] },
    init: { description: 'Initialize a new project', arguments: ['<type>'] },
    install: { description: 'Install a package', arguments: ['<package>'] },
    configure: { description: 'Run configuration wizard' },
    config: { description: 'Manage configuration', arguments: [['get', 'set', 'list', 'reset', 'export', 'import']] },
    doctor: { description: 'Run health checks' },
    test: { description: 'Test NAPI bindings' },
    status: { description: 'Show current status' },
    clear: { description: 'Clear the screen' },
    pwd: { description: 'Print working directory' },
    cd: { description: 'Change directory', arguments: ['<path>'] },
    env: { description: 'Show environment variables' }
  };

  // Create and start REPL
  const repl = new REPL({
    prompt: chalk.cyan('neural-trader> '),
    executor,
    commands: commandConfig,
    useHistory: !options.noHistory,
    useAutoComplete: true,
    useSyntaxHighlight: !options.noColor
  });

  await repl.start();
}

/**
 * Handle config subcommands
 * @private
 */
async function handleConfigCommand(args, configManager) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'get':
      if (args.length < 2) {
        console.log(chalk.red('Usage: config get <key>'));
        return;
      }
      try {
        const value = configManager.get(args[1]);
        console.log(JSON.stringify(value, null, 2));
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
      break;

    case 'set':
      if (args.length < 3) {
        console.log(chalk.red('Usage: config set <key> <value>'));
        return;
      }
      try {
        let value = args.slice(2).join(' ');
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
        await configManager.set(args[1], value);
        console.log(chalk.green(`✓ Set ${args[1]} = ${JSON.stringify(value)}`));
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
      break;

    case 'list':
      try {
        const all = configManager.getAll();
        console.log(chalk.bold('\nProject Configuration:\n'));
        console.log(JSON.stringify(all.project, null, 2));
        console.log(chalk.bold('\nUser Configuration:\n'));
        console.log(JSON.stringify(all.user, null, 2));
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
      break;

    case 'reset':
      try {
        await configManager.resetProjectConfig();
        console.log(chalk.green('✓ Configuration reset to defaults'));
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
      break;

    case 'export':
      if (args.length < 2) {
        console.log(chalk.red('Usage: config export <file>'));
        return;
      }
      try {
        await configManager.exportConfig(args[1]);
        console.log(chalk.green(`✓ Configuration exported to ${args[1]}`));
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
      break;

    case 'import':
      if (args.length < 2) {
        console.log(chalk.red('Usage: config import <file>'));
        return;
      }
      try {
        await configManager.importConfig(args[1]);
        console.log(chalk.green(`✓ Configuration imported from ${args[1]}`));
      } catch (error) {
        console.log(chalk.red(`✗ ${error.message}`));
      }
      break;

    default:
      console.log(chalk.red(`Unknown config subcommand: ${subcommand}`));
      console.log(chalk.dim('Available: get, set, list, reset, export, import'));
  }
}

/**
 * Show current status
 * @private
 */
async function showStatus(configManager) {
  console.log(chalk.bold('\n📊 Neural Trader Status\n'));

  // Node.js version
  console.log(chalk.cyan('System:'));
  console.log(`  Node.js: ${process.version}`);
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Architecture: ${process.arch}`);

  // Working directory
  console.log(chalk.cyan('\nProject:'));
  console.log(`  Directory: ${process.cwd()}`);

  // Configuration
  const configPath = configManager.getConfigPath();
  if (configPath) {
    console.log(`  Config: ${configPath}`);
  } else {
    console.log(chalk.dim('  Config: Not loaded'));
  }

  // NAPI bindings
  console.log(chalk.cyan('\nBindings:'));
  try {
    const nt = require('../../../index.js');
    console.log(chalk.green('  ✓ NAPI bindings available'));
    console.log(`  Functions: ${Object.keys(nt).length}`);
  } catch {
    console.log(chalk.yellow('  ⚠ NAPI bindings not loaded'));
  }

  console.log();
}

/**
 * Show environment variables
 * @private
 */
function showEnvironment() {
  const relevantVars = [
    'NODE_ENV',
    'DEBUG',
    'HOME',
    'PATH',
    'NEURAL_TRADER_API_KEY',
    'ALPACA_API_KEY',
    'ALPACA_SECRET_KEY'
  ];

  console.log(chalk.bold('\nEnvironment Variables:\n'));

  for (const varName of relevantVars) {
    const value = process.env[varName];
    if (value) {
      // Mask sensitive values
      if (varName.includes('KEY') || varName.includes('SECRET')) {
        console.log(`  ${varName}: ${chalk.dim('***masked***')}`);
      } else {
        console.log(`  ${varName}: ${value}`);
      }
    }
  }

  console.log();
}

/**
 * Show help for specific command
 * @private
 */
function showCommandHelp(command) {
  const helpText = {
    version: 'Show version and system information',
    help: 'Show help information\nUsage: help [command]',
    list: 'List available packages\nUsage: list [--category <name>]',
    info: 'Show detailed package information\nUsage: info <package>',
    init: 'Initialize a new project\nUsage: init <type> [template]',
    install: 'Install a package\nUsage: install <package>',
    configure: 'Run interactive configuration wizard\nUsage: configure [--advanced]',
    config: 'Manage configuration\nUsage: config <get|set|list|reset|export|import> [args]',
    doctor: 'Run health checks\nUsage: doctor',
    test: 'Test NAPI bindings\nUsage: test',
    status: 'Show current status\nUsage: status',
    pwd: 'Print working directory\nUsage: pwd',
    cd: 'Change directory\nUsage: cd <path>',
    env: 'Show environment variables\nUsage: env [get <name>]'
  };

  if (helpText[command]) {
    console.log(chalk.bold(`\n${command}:\n`));
    console.log(chalk.white(helpText[command]));
    console.log();
  } else {
    console.log(chalk.red(`No help available for: ${command}`));
  }
}

module.exports = interactive;
