/**
 * Package Remove Command
 * Removes installed packages with dependency checking
 * @module cli/commands/package/remove
 */

const chalk = require('chalk');
const { Listr } = require('listr2');
const { getPackage } = require('../../data/packages');
const PackageManager = require('../../lib/package-manager');
const PackageValidator = require('../../lib/package-validator');

/**
 * Remove package command
 * @param {string} packageName - Name of the package to remove
 * @param {Object} options - Command options
 */
async function removeCommand(packageName, options = {}) {
  if (!packageName) {
    console.error(chalk.red('Error: Package name is required'));
    console.log(chalk.dim('Usage: neural-trader package remove <name> [options]'));
    process.exit(1);
  }

  const packageManager = new PackageManager();
  const validator = new PackageValidator();

  try {
    const pkg = getPackage(packageName);
    if (!pkg) {
      console.error(chalk.red(`Package "${packageName}" not found`));
      process.exit(1);
    }

    if (!packageManager.isInstalled(packageName)) {
      console.error(chalk.red(`Package "${packageName}" is not installed`));
      console.log(chalk.dim('Use "neural-trader package list --installed" to see installed packages'));
      process.exit(1);
    }

    console.log();
    console.log(chalk.bold.cyan(`🗑️  Removing: ${pkg.name}`));
    console.log();

    // Validation
    const validationResult = validator.validateRemoval(packageName, packageManager);

    // Show warnings
    if (validationResult.warnings.length > 0) {
      console.log(chalk.yellow('⚠ Warnings:'));
      validationResult.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
      console.log();
    }

    // Show errors and exit if validation failed
    if (!validationResult.valid) {
      console.error(chalk.red('✗ Validation failed:'));
      validationResult.errors.forEach(error => {
        console.error(chalk.red(`  • ${error}`));
      });
      console.log();

      if (!options.force) {
        console.log(chalk.dim('Use --force to remove anyway'));
        process.exit(1);
      }
    }

    // Check for dependents
    const dependents = packageManager.getDependents(packageName);
    if (dependents.length > 0) {
      console.log(chalk.yellow('⚠ Other packages depend on this package:'));
      dependents.forEach(dep => {
        console.log(chalk.yellow(`  • ${dep}`));
      });
      console.log();

      if (!options.force) {
        console.error(chalk.red('Cannot remove package. Remove dependent packages first or use --force'));
        process.exit(1);
      } else {
        console.log(chalk.yellow('Continuing anyway due to --force flag'));
        console.log();
      }
    }

    // Show packages to be removed
    console.log(chalk.bold('NPM packages to be removed:'));
    pkg.packages.forEach(npmPkg => {
      if (packageManager.installedPackages.has(npmPkg)) {
        console.log(`  • ${npmPkg}`);
      }
    });
    console.log();

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow('🏃 Dry run mode - no packages will be removed'));
      console.log();
      console.log(chalk.green('✓ Dry run completed successfully'));
      return;
    }

    // Confirm removal
    if (!options.yes && !await confirm(`Remove ${packageName}?`)) {
      console.log(chalk.yellow('Removal cancelled'));
      return;
    }

    // Remove package with listr2
    const tasks = new Listr([
      {
        title: `Removing ${packageName}`,
        task: async (ctx, task) => {
          try {
            const result = await packageManager.remove(packageName, {
              force: options.force,
              silent: true
            });

            if (result.failed.length > 0) {
              throw new Error(`Failed to remove: ${result.failed.map(f => f.package).join(', ')}`);
            }

            task.title = `Removing ${packageName} ${chalk.green('✓')}`;
          } catch (error) {
            task.title = `Removing ${packageName} ${chalk.red('✗')}`;
            throw error;
          }
        }
      },
      {
        title: 'Verifying removal',
        task: async () => {
          // Reload installed packages
          packageManager.loadInstalledPackages();

          // Verify package is removed
          if (packageManager.isInstalled(packageName)) {
            throw new Error('Package was not removed correctly');
          }
        }
      }
    ]);

    await tasks.run();

    console.log();
    console.log(chalk.green.bold('✓ Package removed successfully!'));
    console.log();

    // Show cleanup suggestions
    if (options.autoClean !== false) {
      console.log(chalk.dim('Tip: Run "npm prune" to remove unused dependencies'));
      console.log();
    }

  } catch (error) {
    console.error();
    console.error(chalk.red.bold('✗ Removal failed:'), error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    console.log();
    process.exit(1);
  }
}

/**
 * Prompt for confirmation
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>} User response
 */
async function confirm(message) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(chalk.yellow(`${message} (y/N) `), answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

module.exports = removeCommand;
