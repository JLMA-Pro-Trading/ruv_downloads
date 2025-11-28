/**
 * Config Set Command
 * Set configuration values
 */

const chalk = require('chalk');

/**
 * Set configuration value
 * @param {ConfigManager} configManager - Configuration manager instance
 * @param {Array} args - Command arguments [key, ...values]
 * @param {Object} options - Command options
 * @param {boolean} [options.user] - Use user-level config
 * @param {boolean} [options.json] - Parse value as JSON
 */
async function set(configManager, args, options = {}) {
  if (args.length < 2) {
    console.log(chalk.red('✗ Key and value required'));
    console.log(chalk.dim('Usage: config set <key> <value>'));
    console.log(chalk.dim('Example: config set trading.risk.maxPositionSize 20000'));
    process.exit(1);
  }

  const keyPath = args[0];
  let value = args.slice(1).join(' ');
  const source = options.user ? 'user' : 'project';

  // Try to parse value
  try {
    // First try JSON parse
    if (options.json || value.startsWith('{') || value.startsWith('[')) {
      value = JSON.parse(value);
    } else {
      // Try to infer type
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (value === 'null') {
        value = null;
      } else if (!isNaN(value) && value.trim() !== '') {
        // Try to parse as number
        const num = parseFloat(value);
        if (!isNaN(num) && num.toString() === value) {
          value = num;
        }
      }
    }
  } catch (error) {
    // Keep as string if parsing fails
  }

  try {
    await configManager.set(keyPath, value, source);

    console.log(chalk.green(`✓ Configuration updated`));
    console.log(chalk.dim(`  ${keyPath} = ${JSON.stringify(value)}`));

    if (source === 'project') {
      const filepath = configManager.getConfigPath();
      console.log(chalk.dim(`  Saved to: ${filepath}`));
    }

    console.log();
  } catch (error) {
    console.log(chalk.red(`✗ Failed to set configuration: ${error.message}`));
    process.exit(1);
  }
}

module.exports = set;
