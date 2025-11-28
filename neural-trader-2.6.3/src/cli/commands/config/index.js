/**
 * Config Command - Main Entry Point
 * Manages neural-trader configuration
 */

const chalk = require('chalk');
const ConfigManager = require('../../lib/config-manager');

// Import subcommands
const get = require('./get');
const set = require('./set');
const list = require('./list');
const reset = require('./reset');
const exportCmd = require('./export');
const importCmd = require('./import');

/**
 * Main config command router
 * @param {string} subcommand - Subcommand to execute
 * @param {Array} args - Command arguments
 * @param {Object} options - Command options
 */
async function config(subcommand, args = [], options = {}) {
  const configManager = new ConfigManager();

  // Try to load project configuration
  try {
    await configManager.loadProjectConfig();
  } catch (error) {
    // Only warn if not creating new config
    if (subcommand !== 'init' && subcommand !== 'import') {
      console.log(chalk.yellow('⚠ No project configuration found. Some commands may not work.'));
      console.log(chalk.dim('  Run "configure" to create a configuration.\n'));
    }
  }

  // Route to subcommand
  switch (subcommand) {
    case 'get':
      await get(configManager, args, options);
      break;

    case 'set':
      await set(configManager, args, options);
      break;

    case 'list':
    case 'ls':
      await list(configManager, args, options);
      break;

    case 'reset':
      await reset(configManager, args, options);
      break;

    case 'export':
      await exportCmd(configManager, args, options);
      break;

    case 'import':
      await importCmd(configManager, args, options);
      break;

    case 'path':
      showPath(configManager);
      break;

    case 'validate':
      await validate(configManager);
      break;

    default:
      showUsage();
      process.exit(1);
  }
}

/**
 * Show config file path
 * @private
 */
function showPath(configManager) {
  const projectPath = configManager.getConfigPath();
  const userPath = configManager.getUserConfigPath();

  console.log(chalk.bold('\nConfiguration Paths:\n'));

  if (projectPath) {
    console.log(chalk.cyan('Project: ') + chalk.white(projectPath));
  } else {
    console.log(chalk.cyan('Project: ') + chalk.dim('Not found'));
  }

  console.log(chalk.cyan('User:    ') + chalk.white(userPath));
  console.log();
}

/**
 * Validate configuration
 * @private
 */
async function validate(configManager) {
  try {
    const result = await configManager.loadProjectConfig();

    if (!result.config) {
      console.log(chalk.yellow('⚠ No configuration to validate'));
      return;
    }

    // Configuration is automatically validated during load
    console.log(chalk.green('✓ Configuration is valid'));
    console.log(chalk.dim(`  File: ${result.filepath}`));
  } catch (error) {
    console.log(chalk.red('✗ Configuration validation failed:'));
    console.log(chalk.red(`  ${error.message}`));
    process.exit(1);
  }
}

/**
 * Show usage information
 * @private
 */
function showUsage() {
  console.log(chalk.bold('\nUsage: neural-trader config <command> [options]\n'));

  console.log(chalk.cyan('Commands:\n'));
  console.log('  get <key>              Get configuration value');
  console.log('  set <key> <value>      Set configuration value');
  console.log('  list                   List all configuration');
  console.log('  reset                  Reset to default configuration');
  console.log('  export <file>          Export configuration to file');
  console.log('  import <file>          Import configuration from file');
  console.log('  path                   Show configuration file paths');
  console.log('  validate               Validate configuration');

  console.log(chalk.cyan('\nOptions:\n'));
  console.log('  --user                 Use user-level configuration');
  console.log('  --project              Use project-level configuration (default)');
  console.log('  --json                 Output in JSON format');
  console.log('  --yaml                 Output in YAML format');

  console.log(chalk.cyan('\nExamples:\n'));
  console.log(chalk.dim('  # Get a configuration value'));
  console.log('  neural-trader config get trading.symbols');
  console.log();
  console.log(chalk.dim('  # Set a configuration value'));
  console.log('  neural-trader config set trading.risk.maxPositionSize 20000');
  console.log();
  console.log(chalk.dim('  # List all configuration'));
  console.log('  neural-trader config list');
  console.log();
  console.log(chalk.dim('  # Export configuration'));
  console.log('  neural-trader config export my-config.json');
  console.log();
}

module.exports = config;
