/**
 * Config Export Command
 * Export configuration to file
 */

const chalk = require('chalk');
const path = require('path');

/**
 * Export configuration
 * @param {ConfigManager} configManager - Configuration manager instance
 * @param {Array} args - Command arguments [filepath]
 * @param {Object} options - Command options
 * @param {boolean} [options.yaml] - Export as YAML
 * @param {boolean} [options.user] - Export user-level config
 */
async function exportCmd(configManager, args, options = {}) {
  if (args.length === 0) {
    console.log(chalk.red('✗ Output file path required'));
    console.log(chalk.dim('Usage: config export <file>'));
    console.log(chalk.dim('Example: config export my-config.json'));
    process.exit(1);
  }

  const filepath = args[0];
  const format = options.yaml ? 'yaml' : 'json';

  // Validate file extension matches format
  const ext = path.extname(filepath).toLowerCase();
  if (format === 'yaml' && ext !== '.yaml' && ext !== '.yml') {
    console.log(chalk.yellow(`⚠ Warning: File extension "${ext}" doesn't match YAML format`));
  } else if (format === 'json' && ext !== '.json') {
    console.log(chalk.yellow(`⚠ Warning: File extension "${ext}" doesn't match JSON format`));
  }

  try {
    await configManager.exportConfig(filepath, format);

    console.log(chalk.green(`\n✓ Configuration exported`));
    console.log(chalk.dim(`  File: ${filepath}`));
    console.log(chalk.dim(`  Format: ${format.toUpperCase()}\n`));
  } catch (error) {
    console.log(chalk.red(`\n✗ Failed to export configuration: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = exportCmd;
