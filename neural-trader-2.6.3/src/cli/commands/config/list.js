/**
 * Config List Command
 * List all configuration values
 */

const chalk = require('chalk');

/**
 * List configuration
 * @param {ConfigManager} configManager - Configuration manager instance
 * @param {Array} args - Command arguments
 * @param {Object} options - Command options
 * @param {boolean} [options.user] - Show only user-level config
 * @param {boolean} [options.project] - Show only project-level config
 * @param {boolean} [options.json] - Output as JSON
 * @param {boolean} [options.yaml] - Output as YAML
 */
async function list(configManager, args, options = {}) {
  try {
    const all = configManager.getAll();

    if (options.json) {
      // JSON output
      const output = {};
      if (!options.project) {
        output.user = all.user;
      }
      if (!options.user) {
        output.project = all.project;
      }
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Pretty output
    if (!options.project) {
      console.log(chalk.cyan.bold('\n📁 User Configuration\n'));
      const userPath = configManager.getUserConfigPath();
      console.log(chalk.dim(`Location: ${userPath}\n`));

      if (all.user && Object.keys(all.user).length > 0) {
        printConfig(all.user);
      } else {
        console.log(chalk.dim('  (empty)\n'));
      }
    }

    if (!options.user) {
      console.log(chalk.cyan.bold('\n📦 Project Configuration\n'));
      const projectPath = configManager.getConfigPath();

      if (projectPath) {
        console.log(chalk.dim(`Location: ${projectPath}\n`));
      } else {
        console.log(chalk.dim('Location: Not found\n'));
      }

      if (all.project) {
        printConfig(all.project);
      } else {
        console.log(chalk.dim('  (no project configuration loaded)\n'));
        console.log(chalk.yellow('  Run "configure" to create project configuration\n'));
      }
    }
  } catch (error) {
    console.log(chalk.red(`✗ Failed to list configuration: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Print configuration object
 * @private
 * @param {Object} config - Configuration object
 * @param {string} [prefix=''] - Key prefix
 * @param {number} [indent=0] - Indentation level
 */
function printConfig(config, prefix = '', indent = 0) {
  const spaces = '  '.repeat(indent);

  for (const [key, value] of Object.entries(config)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      console.log(`${spaces}${chalk.cyan(key)}: ${chalk.dim('null')}`);
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(`${spaces}${chalk.cyan.bold(key)}:`);
      printConfig(value, fullKey, indent + 1);
    } else if (Array.isArray(value)) {
      console.log(`${spaces}${chalk.cyan(key)}: ${chalk.white(JSON.stringify(value))}`);
    } else if (typeof value === 'boolean') {
      console.log(`${spaces}${chalk.cyan(key)}: ${value ? chalk.green(value) : chalk.red(value)}`);
    } else if (typeof value === 'number') {
      console.log(`${spaces}${chalk.cyan(key)}: ${chalk.magenta(value)}`);
    } else {
      console.log(`${spaces}${chalk.cyan(key)}: ${chalk.white(value)}`);
    }
  }
}

module.exports = list;
