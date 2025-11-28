/**
 * Configure Command
 * Interactive configuration wizard for neural-trader
 */

const ConfigManager = require('../lib/config-manager');
const ConfigWizard = require('../lib/config-wizard');
const chalk = require('chalk');

/**
 * Run configuration wizard
 * @param {Object} options - Command options
 * @param {boolean} [options.reset] - Reset to default configuration
 * @param {boolean} [options.advanced] - Show advanced options
 * @param {boolean} [options.update] - Update existing configuration
 */
async function configure(options = {}) {
  console.log(chalk.cyan.bold('\n🔧 Neural Trader Configuration\n'));

  const configManager = new ConfigManager();

  // Handle reset option
  if (options.reset) {
    const inquirer = require('inquirer');
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset configuration to defaults?',
        default: false
      }
    ]);

    if (confirm) {
      try {
        await configManager.resetProjectConfig();
        console.log(chalk.green('✓ Configuration reset to defaults'));

        const filepath = configManager.getConfigPath();
        if (filepath) {
          console.log(chalk.dim(`  Saved to: ${filepath}`));
        }
      } catch (error) {
        console.log(chalk.red(`✗ Failed to reset configuration: ${error.message}`));
        process.exit(1);
      }
    } else {
      console.log(chalk.yellow('Reset cancelled'));
    }

    return;
  }

  // Try to load existing configuration
  let hasExisting = false;
  try {
    const result = await configManager.loadProjectConfig();
    if (result.config) {
      hasExisting = true;
      console.log(chalk.green(`✓ Found existing configuration: ${result.filepath}\n`));

      if (!options.update) {
        const inquirer = require('inquirer');
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: 'Update existing configuration', value: 'update' },
              { name: 'Create new configuration (overwrites existing)', value: 'new' },
              { name: 'Cancel', value: 'cancel' }
            ]
          }
        ]);

        if (action === 'cancel') {
          console.log(chalk.yellow('\nConfiguration cancelled'));
          return;
        }

        options.update = action === 'update';
      }
    }
  } catch (error) {
    // No existing configuration
    console.log(chalk.dim('No existing configuration found. Creating new configuration.\n'));
  }

  // Run configuration wizard
  try {
    const wizard = new ConfigWizard(configManager);
    await wizard.run({
      advanced: options.advanced,
      update: options.update
    });

    console.log(chalk.green('\n✅ Configuration complete!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.dim('  1. Review your configuration: config list'));
    console.log(chalk.dim('  2. Test your setup: doctor'));
    console.log(chalk.dim('  3. Start trading: init trading'));
    console.log();
  } catch (error) {
    console.log(chalk.red(`\n✗ Configuration failed: ${error.message}\n`));
    if (process.env.DEBUG) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Show current configuration
 * @param {Object} options - Command options
 */
async function showConfig(options = {}) {
  const configManager = new ConfigManager();

  try {
    const result = await configManager.loadProjectConfig();

    if (!result.config) {
      console.log(chalk.yellow('No configuration found. Run "configure" to create one.'));
      return;
    }

    console.log(chalk.bold(`\nConfiguration: ${result.filepath}\n`));

    if (options.json) {
      console.log(JSON.stringify(result.config, null, 2));
    } else {
      // Pretty print configuration
      printConfigSection('Project', {
        name: result.config.name,
        version: result.config.version,
        description: result.config.description
      });

      printConfigSection('Trading', {
        provider: result.config.trading.provider.name,
        sandbox: result.config.trading.provider.sandbox,
        symbols: result.config.trading.symbols.join(', '),
        strategies: result.config.trading.strategies.map(s => s.name).join(', ')
      });

      printConfigSection('Risk Management', result.config.trading.risk);

      if (result.config.neural) {
        printConfigSection('Neural Network', result.config.neural);
      }

      if (result.config.backtesting) {
        printConfigSection('Backtesting', result.config.backtesting);
      }

      if (result.config.accounting) {
        printConfigSection('Accounting', result.config.accounting);
      }

      if (result.config.swarm) {
        printConfigSection('Swarm Coordination', result.config.swarm);
      }

      printConfigSection('Logging', result.config.logging);
    }

    console.log();
  } catch (error) {
    console.log(chalk.red(`✗ Failed to load configuration: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Print configuration section
 * @private
 */
function printConfigSection(title, data) {
  console.log(chalk.cyan.bold(`${title}:`));

  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue;
    }

    const formattedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    const displayKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

    if (typeof value === 'object' && !Array.isArray(value)) {
      console.log(chalk.white(`  ${displayKey}:`));
      for (const [subKey, subValue] of Object.entries(value)) {
        console.log(chalk.dim(`    ${subKey}: ${subValue}`));
      }
    } else if (Array.isArray(value)) {
      console.log(chalk.white(`  ${displayKey}: ${chalk.dim(value.join(', '))}`));
    } else {
      console.log(chalk.white(`  ${displayKey}: ${chalk.dim(value)}`));
    }
  }

  console.log();
}

module.exports = configure;
module.exports.showConfig = showConfig;
