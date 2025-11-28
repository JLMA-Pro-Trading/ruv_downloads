/**
 * Config Import Command
 * Import configuration from file
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs').promises;

/**
 * Import configuration
 * @param {ConfigManager} configManager - Configuration manager instance
 * @param {Array} args - Command arguments [filepath]
 * @param {Object} options - Command options
 * @param {boolean} [options.force] - Skip confirmation
 * @param {boolean} [options.merge] - Merge with existing config
 */
async function importCmd(configManager, args, options = {}) {
  if (args.length === 0) {
    console.log(chalk.red('✗ Input file path required'));
    console.log(chalk.dim('Usage: config import <file>'));
    console.log(chalk.dim('Example: config import my-config.json'));
    process.exit(1);
  }

  const filepath = args[0];

  // Check if file exists
  try {
    await fs.access(filepath);
  } catch {
    console.log(chalk.red(`✗ File not found: ${filepath}`));
    process.exit(1);
  }

  // Check if project config exists
  const hasExisting = configManager.getConfigPath() !== null;

  if (hasExisting && !options.force) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Project configuration already exists. What would you like to do?',
        choices: [
          { name: 'Replace existing configuration', value: 'replace' },
          { name: 'Merge with existing configuration', value: 'merge' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);

    if (action === 'cancel') {
      console.log(chalk.yellow('\nImport cancelled\n'));
      return;
    }

    options.merge = action === 'merge';
  }

  try {
    if (options.merge && hasExisting) {
      // Load and merge configurations
      const imported = JSON.parse(await fs.readFile(filepath, 'utf8'));
      const existing = configManager.getAll().project;

      const merged = deepMerge(existing, imported);
      await configManager.saveProjectConfig(merged);

      console.log(chalk.green(`\n✓ Configuration imported and merged`));
    } else {
      // Replace configuration
      await configManager.importConfig(filepath);
      console.log(chalk.green(`\n✓ Configuration imported`));
    }

    const savedPath = configManager.getConfigPath();
    console.log(chalk.dim(`  From: ${filepath}`));
    console.log(chalk.dim(`  To: ${savedPath}\n`));
  } catch (error) {
    console.log(chalk.red(`\n✗ Failed to import configuration: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * Deep merge two objects
 * @private
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };

  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }

  return output;
}

module.exports = importCmd;
