/**
 * Package Update Command
 * Updates installed packages to latest versions
 * @module cli/commands/package/update
 */

const chalk = require('chalk');
const { Listr } = require('listr2');
const { getPackage, getAllPackages } = require('../../data/packages');
const PackageManager = require('../../lib/package-manager');
const PackageValidator = require('../../lib/package-validator');

/**
 * Update package command
 * @param {string} packageName - Optional specific package name to update
 * @param {Object} options - Command options
 */
async function updateCommand(packageName, options = {}) {
  const packageManager = new PackageManager();
  const validator = new PackageValidator();

  try {
    let packagesToUpdate = [];

    if (packageName) {
      // Update specific package
      const pkg = getPackage(packageName);
      if (!pkg) {
        console.error(chalk.red(`Package "${packageName}" not found`));
        process.exit(1);
      }

      if (!packageManager.isInstalled(packageName)) {
        console.error(chalk.red(`Package "${packageName}" is not installed`));
        console.log(chalk.dim('Use "neural-trader package install" to install it first'));
        process.exit(1);
      }

      packagesToUpdate.push(packageName);
    } else {
      // Update all installed packages
      const allPackages = getAllPackages();
      packagesToUpdate = Object.keys(allPackages).filter(name =>
        packageManager.isInstalled(name)
      );

      if (packagesToUpdate.length === 0) {
        console.log(chalk.yellow('No packages are currently installed'));
        console.log(chalk.dim('Use "neural-trader package list" to see available packages'));
        return;
      }
    }

    console.log();
    console.log(chalk.bold.cyan(`🔄 Checking for updates...`));
    console.log();

    // Check which packages have updates
    const updates = [];
    for (const name of packagesToUpdate) {
      const pkg = getPackage(name);
      const currentVersion = packageManager.getInstalledVersion(name);
      const latestVersion = pkg.version;

      if (currentVersion !== latestVersion || options.force) {
        updates.push({
          name,
          currentVersion,
          latestVersion,
          pkg
        });
      }
    }

    if (updates.length === 0) {
      console.log(chalk.green('✓ All packages are up to date!'));
      console.log();
      return;
    }

    // Show updates available
    console.log(chalk.bold(`Updates available for ${updates.length} package(s):`));
    console.log();

    updates.forEach(({ name, currentVersion, latestVersion, pkg }) => {
      console.log(
        `  ${chalk.bold(name)}: ${chalk.dim(currentVersion)} → ${chalk.green(latestVersion)} ` +
        chalk.dim(`(${pkg.size})`)
      );
    });
    console.log();

    // Validate updates
    for (const { name } of updates) {
      const validationResult = validator.validateUpdate(name, packageManager);

      if (validationResult.warnings.length > 0) {
        console.log(chalk.yellow(`⚠ Warnings for ${name}:`));
        validationResult.warnings.forEach(warning => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
        console.log();
      }

      if (!validationResult.valid) {
        console.error(chalk.red(`✗ Validation failed for ${name}:`));
        validationResult.errors.forEach(error => {
          console.error(chalk.red(`  • ${error}`));
        });
        console.log();

        if (!options.continueOnError) {
          process.exit(1);
        }
      }
    }

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow('🏃 Dry run mode - no packages will be updated'));
      console.log();
      console.log(chalk.dim('Packages that would be updated:'));
      updates.forEach(({ name, pkg }) => {
        pkg.packages.forEach(npmPkg => {
          console.log(chalk.dim(`  • ${npmPkg}@latest`));
        });
      });
      console.log();
      console.log(chalk.green('✓ Dry run completed successfully'));
      return;
    }

    // Confirm update
    if (!options.yes && !await confirm(`Update ${updates.length} package(s)?`)) {
      console.log(chalk.yellow('Update cancelled'));
      return;
    }

    // Update packages with listr2
    const tasks = new Listr([
      {
        title: 'Updating packages',
        task: async (ctx, task) => {
          const subTasks = updates.map(({ name, currentVersion, latestVersion }) => ({
            title: `${name} (${currentVersion} → ${latestVersion})`,
            task: async (subCtx, subTask) => {
              try {
                const result = await packageManager.update(name, {
                  force: options.force,
                  silent: true
                });

                if (result.failed.length > 0) {
                  subTask.title = `${name} ${chalk.red('(failed)')}`;
                  throw new Error(`Failed to update: ${result.failed.map(f => f.package).join(', ')}`);
                } else if (result.skipped.length > 0 && result.updated.length === 0) {
                  subTask.title = `${name} ${chalk.yellow('(skipped - already up to date)')}`;
                } else {
                  subTask.title = `${name} ${chalk.green('✓')}`;
                }
              } catch (error) {
                subTask.title = `${name} ${chalk.red('✗')}`;
                if (!options.continueOnError) {
                  throw error;
                }
              }
            }
          }));

          return task.newListr(subTasks, { concurrent: false, exitOnError: !options.continueOnError });
        }
      },
      {
        title: 'Verifying updates',
        task: async () => {
          // Reload installed packages
          packageManager.loadInstalledPackages();

          // Verify updates
          const allUpdated = updates.every(({ name, latestVersion }) => {
            const currentVersion = packageManager.getInstalledVersion(name);
            return currentVersion === latestVersion;
          });

          if (!allUpdated && !options.continueOnError) {
            throw new Error('Some packages were not updated correctly');
          }
        }
      }
    ]);

    await tasks.run();

    console.log();
    console.log(chalk.green.bold('✓ Update completed successfully!'));
    console.log();

    // Show what changed
    if (options.showChanges) {
      console.log(chalk.bold('Changes:'));
      updates.forEach(({ name, currentVersion, latestVersion }) => {
        console.log(`  • ${name}: ${currentVersion} → ${latestVersion}`);
      });
      console.log();
    }

  } catch (error) {
    console.error();
    console.error(chalk.red.bold('✗ Update failed:'), error.message);
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

module.exports = updateCommand;
