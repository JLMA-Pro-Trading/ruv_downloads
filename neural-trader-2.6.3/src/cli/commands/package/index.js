/**
 * Package Command - Main entry point for package management
 * Provides subcommands for listing, installing, updating, removing packages
 * @module cli/commands/package
 */

const chalk = require('chalk');
const listCommand = require('./list');
const infoCommand = require('./info');
const installCommand = require('./install');
const updateCommand = require('./update');
const removeCommand = require('./remove');
const searchCommand = require('./search');

/**
 * Package command handler
 * Routes to appropriate subcommand
 * @param {string[]} args - Command arguments
 * @param {Object} options - Command options
 */
async function packageCommand(args = [], options = {}) {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  // No subcommand - show help
  if (!subcommand || subcommand === 'help') {
    showHelp();
    return;
  }

  // Route to subcommands
  try {
    switch (subcommand) {
      case 'list':
      case 'ls':
        await listCommand(subArgs[0], options);
        break;

      case 'info':
      case 'show':
        await infoCommand(subArgs[0], options);
        break;

      case 'install':
      case 'add':
      case 'i':
        await installCommand(subArgs[0], options);
        break;

      case 'update':
      case 'upgrade':
      case 'up':
        await updateCommand(subArgs[0], options);
        break;

      case 'remove':
      case 'uninstall':
      case 'rm':
        await removeCommand(subArgs[0], options);
        break;

      case 'search':
      case 'find':
        await searchCommand(subArgs[0], options);
        break;

      default:
        console.error(chalk.red(`Unknown subcommand: ${subcommand}`));
        console.log(chalk.dim('Run "neural-trader package help" for usage information'));
        process.exit(1);
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log();
  console.log(chalk.bold.cyan('📦 Neural Trader Package Manager'));
  console.log();
  console.log(chalk.bold('Usage:'));
  console.log('  neural-trader package <command> [options]');
  console.log();
  console.log(chalk.bold('Commands:'));
  console.log();

  const commands = [
    {
      name: 'list [category]',
      alias: 'ls',
      description: 'List available packages (optionally filtered by category)'
    },
    {
      name: 'info <name>',
      alias: 'show',
      description: 'Show detailed information about a package'
    },
    {
      name: 'install <name>',
      alias: 'add, i',
      description: 'Install a package and its dependencies'
    },
    {
      name: 'update [name]',
      alias: 'upgrade, up',
      description: 'Update packages to latest versions'
    },
    {
      name: 'remove <name>',
      alias: 'uninstall, rm',
      description: 'Remove an installed package'
    },
    {
      name: 'search <query>',
      alias: 'find',
      description: 'Search for packages by keyword'
    },
    {
      name: 'help',
      alias: '',
      description: 'Show this help message'
    }
  ];

  commands.forEach(cmd => {
    const aliases = cmd.alias ? chalk.dim(`(${cmd.alias})`) : '';
    console.log(`  ${chalk.cyan(cmd.name.padEnd(25))} ${aliases}`);
    console.log(chalk.dim(`    ${cmd.description}`));
    console.log();
  });

  console.log(chalk.bold('List Options:'));
  console.log('  --table              Display as table');
  console.log('  --installed          Show only installed packages');
  console.log('  --not-installed      Show only not installed packages');
  console.log('  --examples           Show only example packages');
  console.log('  --verbose, -v        Show detailed information');
  console.log();

  console.log(chalk.bold('Install Options:'));
  console.log('  --force, -f          Force reinstallation');
  console.log('  --dry-run            Show what would be installed without installing');
  console.log('  --yes, -y            Skip confirmation prompts');
  console.log('  --save-dev           Install as dev dependency');
  console.log('  --continue-on-error  Continue even if some packages fail');
  console.log();

  console.log(chalk.bold('Update Options:'));
  console.log('  --force, -f          Force update even if already up to date');
  console.log('  --dry-run            Show what would be updated without updating');
  console.log('  --yes, -y            Skip confirmation prompts');
  console.log('  --show-changes       Show what changed after update');
  console.log('  --continue-on-error  Continue even if some packages fail');
  console.log();

  console.log(chalk.bold('Remove Options:'));
  console.log('  --force, -f          Force removal even if other packages depend on it');
  console.log('  --dry-run            Show what would be removed without removing');
  console.log('  --yes, -y            Skip confirmation prompts');
  console.log();

  console.log(chalk.bold('General Options:'));
  console.log('  --no-cache           Disable cache for operations');
  console.log('  --debug              Show debug information');
  console.log();

  console.log(chalk.bold('Examples:'));
  console.log(chalk.cyan('  # List all packages'));
  console.log('  neural-trader package list');
  console.log();
  console.log(chalk.cyan('  # List packages in trading category'));
  console.log('  neural-trader package list trading');
  console.log();
  console.log(chalk.cyan('  # Show package info'));
  console.log('  neural-trader package info trading');
  console.log();
  console.log(chalk.cyan('  # Install a package'));
  console.log('  neural-trader package install trading');
  console.log();
  console.log(chalk.cyan('  # Update all packages'));
  console.log('  neural-trader package update');
  console.log();
  console.log(chalk.cyan('  # Search for packages'));
  console.log('  neural-trader package search portfolio');
  console.log();
  console.log(chalk.cyan('  # Remove a package'));
  console.log('  neural-trader package remove trading');
  console.log();

  console.log(chalk.bold('Package Categories:'));
  console.log('  trading, betting, markets, accounting, prediction, data, example');
  console.log();
}

// Export both the main handler and subcommands
module.exports = packageCommand;
module.exports.list = listCommand;
module.exports.info = infoCommand;
module.exports.install = installCommand;
module.exports.update = updateCommand;
module.exports.remove = removeCommand;
module.exports.search = searchCommand;
module.exports.help = showHelp;
