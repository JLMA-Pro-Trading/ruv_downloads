/**
 * Config Get Command
 * Retrieve configuration values
 */

const chalk = require('chalk');

/**
 * Get configuration value
 * @param {ConfigManager} configManager - Configuration manager instance
 * @param {Array} args - Command arguments [key]
 * @param {Object} options - Command options
 * @param {boolean} [options.user] - Use user-level config
 * @param {boolean} [options.json] - Output as JSON
 */
async function get(configManager, args, options = {}) {
  if (args.length === 0) {
    console.log(chalk.red('✗ Key path required'));
    console.log(chalk.dim('Usage: config get <key>'));
    console.log(chalk.dim('Example: config get trading.symbols'));
    process.exit(1);
  }

  const keyPath = args[0];
  const source = options.user ? 'user' : 'project';

  try {
    const value = configManager.get(keyPath, source);

    if (value === undefined) {
      console.log(chalk.yellow(`⚠ Key not found: ${keyPath}`));
      return;
    }

    // Output value
    if (options.json) {
      console.log(JSON.stringify({ [keyPath]: value }, null, 2));
    } else {
      console.log(chalk.bold(`\n${keyPath}:\n`));

      if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(chalk.white(value));
      }

      console.log();
    }
  } catch (error) {
    console.log(chalk.red(`✗ Failed to get configuration: ${error.message}`));
    process.exit(1);
  }
}

module.exports = get;
