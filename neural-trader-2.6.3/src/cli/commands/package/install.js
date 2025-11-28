/**
 * Package Install Command
 * Installs a package with progress indication and validation
 * @module cli/commands/package/install
 */

const chalk = require('chalk');
const { Listr } = require('listr2');
const { getPackage } = require('../../data/packages');
const PackageManager = require('../../lib/package-manager');
const PackageValidator = require('../../lib/package-validator');
const DependencyResolver = require('../../lib/dependency-resolver');

/**
 * Install package command
 * @param {string} packageName - Name of the package to install
 * @param {Object} options - Command options
 */
async function installCommand(packageName, options = {}) {
  if (!packageName) {
    console.error(chalk.red('Error: Package name is required'));
    console.log(chalk.dim('Usage: neural-trader package install <name> [options]'));
    process.exit(1);
  }

  const packageManager = new PackageManager();
  const validator = new PackageValidator();
  const resolver = new DependencyResolver();

  try {
    const pkg = getPackage(packageName);
    if (!pkg) {
      console.error(chalk.red(`Package "${packageName}" not found`));
      console.log(chalk.dim('Use "neural-trader package list" to see available packages'));
      process.exit(1);
    }

    console.log();
    console.log(chalk.bold.cyan(`📦 Installing: ${pkg.name}`));
    console.log();

    // Validation
    const validationResult = validator.validateInstall(packageName, packageManager, {
      force: options.force,
      skipDiskCheck: options.skipDiskCheck
    });

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
      process.exit(1);
    }

    // Resolve dependencies
    let installOrder;
    try {
      installOrder = resolver.resolve(packageName, packageManager);
    } catch (error) {
      console.error(chalk.red('✗ Dependency resolution failed:'), error.message);
      process.exit(1);
    }

    // Show installation plan
    if (installOrder.length > 1 && !options.yes) {
      console.log(chalk.bold('Installation plan:'));
      installOrder.forEach((name, index) => {
        const p = getPackage(name);
        console.log(`  ${index + 1}. ${name} (${p.version}) - ${p.size}`);
      });
      console.log();
    }

    // Calculate total size
    const sizeInfo = packageManager.calculateInstallSize(packageName);
    console.log(chalk.dim(`Total download size: ${sizeInfo.total}`));
    console.log();

    // Dry run mode
    if (options.dryRun) {
      console.log(chalk.yellow('🏃 Dry run mode - no packages will be installed'));
      console.log();
      console.log(chalk.dim('Packages that would be installed:'));
      installOrder.forEach(name => {
        const p = getPackage(name);
        p.packages.forEach(npmPkg => {
          console.log(chalk.dim(`  • ${npmPkg}`));
        });
      });
      console.log();
      console.log(chalk.green('✓ Dry run completed successfully'));
      return;
    }

    // Confirm installation
    if (!options.yes && !await confirm(`Install ${installOrder.length} package(s)?`)) {
      console.log(chalk.yellow('Installation cancelled'));
      return;
    }

    // Install packages with listr2
    const tasks = new Listr([
      {
        title: 'Installing dependencies',
        task: async (ctx, task) => {
          const subTasks = installOrder.map(name => ({
            title: name,
            task: async (subCtx, subTask) => {
              try {
                const result = await packageManager.install(name, {
                  force: options.force,
                  saveDev: options.saveDev,
                  silent: true
                });

                if (result.failed.length > 0) {
                  subTask.title = `${name} ${chalk.red('(failed)')}`;
                  throw new Error(`Failed to install: ${result.failed.map(f => f.package).join(', ')}`);
                } else {
                  subTask.title = `${name} ${chalk.green('✓')}`;
                }
              } catch (error) {
                subTask.title = `${name} ${chalk.red('✗')}`;
                throw error;
              }
            }
          }));

          return task.newListr(subTasks, { concurrent: false, exitOnError: !options.continueOnError });
        }
      },
      {
        title: 'Verifying installation',
        task: async () => {
          // Reload installed packages
          packageManager.loadInstalledPackages();

          // Verify all packages are installed
          const allInstalled = installOrder.every(name =>
            packageManager.isInstalled(name)
          );

          if (!allInstalled) {
            throw new Error('Some packages were not installed correctly');
          }
        }
      }
    ]);

    await tasks.run();

    console.log();
    console.log(chalk.green.bold('✓ Installation completed successfully!'));
    console.log();

    // Show next steps
    if (pkg.hasExamples) {
      console.log(chalk.bold('Next steps:'));
      console.log(chalk.cyan(`  • View package info: neural-trader package info ${packageName}`));
      console.log(chalk.cyan(`  • Create example project: neural-trader init --template ${packageName}`));
      console.log();
    }

  } catch (error) {
    console.error();
    console.error(chalk.red.bold('✗ Installation failed:'), error.message);
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
  // Simple implementation - in production, use a proper prompt library
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

module.exports = installCommand;
