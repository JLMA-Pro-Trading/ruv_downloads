/**
 * Config Reset Command
 * Reset configuration to defaults
 */

const chalk = require('chalk');
const inquirer = require('inquirer');

/**
 * Reset configuration
 * @param {ConfigManager} configManager - Configuration manager instance
 * @param {Array} args - Command arguments
 * @param {Object} options - Command options
 * @param {boolean} [options.user] - Reset user-level config
 * @param {boolean} [options.force] - Skip confirmation
 */
async function reset(configManager, args, options = {}) {
  const source = options.user ? 'user' : 'project';

  // Confirm reset unless --force is used
  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to reset ${source} configuration to defaults?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\nReset cancelled\n'));
      return;
    }
  }

  try {
    if (options.user) {
      configManager.resetUserConfig();
      console.log(chalk.green('\n✓ User configuration reset to defaults'));
      console.log(chalk.dim(`  Location: ${configManager.getUserConfigPath()}\n`));
    } else {
      await configManager.resetProjectConfig();
      console.log(chalk.green('\n✓ Project configuration reset to defaults'));

      const filepath = configManager.getConfigPath();
      if (filepath) {
        console.log(chalk.dim(`  Location: ${filepath}\n`));
      }
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ Failed to reset configuration: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = reset;
