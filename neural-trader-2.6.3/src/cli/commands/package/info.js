/**
 * Package Info Command
 * Displays detailed information about a specific package
 * @module cli/commands/package/info
 */

const chalk = require('chalk');
const { getPackage } = require('../../data/packages');
const PackageManager = require('../../lib/package-manager');
const DependencyResolver = require('../../lib/dependency-resolver');
const PackageCache = require('../../lib/package-cache');

/**
 * Package info command
 * @param {string} packageName - Name of the package
 * @param {Object} options - Command options
 */
async function infoCommand(packageName, options = {}) {
  if (!packageName) {
    console.error(chalk.red('Error: Package name is required'));
    console.log(chalk.dim('Usage: neural-trader package info <name>'));
    process.exit(1);
  }

  const packageManager = new PackageManager();
  const resolver = new DependencyResolver();
  const cache = new PackageCache();

  try {
    // Get package info
    let pkg;
    if (!options.noCache) {
      pkg = cache.getPackageMetadata(packageName);
    }

    if (!pkg) {
      pkg = getPackage(packageName);
      if (pkg) {
        cache.cachePackageMetadata(packageName, pkg);
      }
    }

    if (!pkg) {
      console.error(chalk.red(`Package "${packageName}" not found`));
      console.log(chalk.dim('Use "neural-trader package list" to see available packages'));
      process.exit(1);
    }

    const installed = packageManager.isInstalled(packageName);
    const installedVersion = packageManager.getInstalledVersion(packageName);

    // Display package information
    console.log();
    console.log(chalk.bold.cyan('━'.repeat(60)));
    console.log(chalk.bold.cyan(`📦 ${pkg.name}`));
    console.log(chalk.bold.cyan('━'.repeat(60)));
    console.log();

    // Basic info
    console.log(chalk.bold('Name:        ') + chalk.yellow(packageName));
    console.log(chalk.bold('Description: ') + pkg.description);
    console.log(chalk.bold('Category:    ') + pkg.category);
    console.log(chalk.bold('Version:     ') + pkg.version);
    console.log(chalk.bold('Size:        ') + pkg.size);

    if (pkg.isExample) {
      console.log(chalk.bold('Type:        ') + chalk.blue('Example Package'));
    }

    console.log();

    // Installation status
    const statusColor = installed ? chalk.green : chalk.yellow;
    const statusText = installed
      ? `✓ Installed (${installedVersion})`
      : '✗ Not installed';
    console.log(chalk.bold('Status:      ') + statusColor(statusText));

    if (installed && installedVersion !== pkg.version) {
      console.log(chalk.yellow(`             ⚠ Update available: ${pkg.version}`));
    }

    console.log();

    // NPM packages
    if (pkg.packages && pkg.packages.length > 0) {
      console.log(chalk.bold('NPM Packages:'));
      pkg.packages.forEach(p => {
        const pkgInstalled = packageManager.installedPackages.has(p);
        const icon = pkgInstalled ? chalk.green('✓') : chalk.dim('○');
        console.log(`  ${icon} ${p}`);
      });
      console.log();
    }

    // Dependencies
    if (pkg.dependencies && pkg.dependencies.length > 0) {
      console.log(chalk.bold('Dependencies:'));
      const deps = resolver.getDependencies(packageName, packageManager);

      deps.direct.forEach(dep => {
        const icon = dep.installed ? chalk.green('✓') : chalk.red('✗');
        console.log(`  ${icon} ${dep.name} (${dep.version})`);
      });

      if (deps.transitive.length > 0 && options.verbose) {
        console.log(chalk.dim('  Transitive dependencies:'));
        deps.transitive.forEach(dep => {
          const icon = dep.installed ? chalk.green('✓') : chalk.red('✗');
          console.log(chalk.dim(`    ${icon} ${dep.name} (${dep.version})`));
        });
      }

      console.log();
    } else {
      console.log(chalk.dim('No dependencies'));
      console.log();
    }

    // Dependents (packages that depend on this one)
    if (installed) {
      const dependents = packageManager.getDependents(packageName);
      if (dependents.length > 0) {
        console.log(chalk.bold('Required by:'));
        dependents.forEach(dep => {
          console.log(`  • ${dep}`);
        });
        console.log();
      }
    }

    // Features
    if (pkg.features && pkg.features.length > 0) {
      console.log(chalk.bold('Features:'));
      pkg.features.forEach(feature => {
        console.log(`  • ${feature}`);
      });
      console.log();
    }

    // Installation size estimate
    if (!installed) {
      const sizeInfo = packageManager.calculateInstallSize(packageName);
      console.log(chalk.bold('Installation Size:'));
      console.log(`  Total: ${chalk.yellow(sizeInfo.total)}`);

      if (Object.keys(sizeInfo.breakdown).length > 1 && options.verbose) {
        console.log(chalk.dim('  Breakdown:'));
        Object.entries(sizeInfo.breakdown).forEach(([name, size]) => {
          console.log(chalk.dim(`    ${name}: ${size}`));
        });
      }
      console.log();
    }

    // Examples
    if (pkg.hasExamples) {
      console.log(chalk.bold('Examples:    ') + chalk.green('✓ Available'));
      console.log(chalk.dim('             Use "neural-trader init" to create a project with examples'));
      console.log();
    }

    // Installation command
    if (!installed) {
      console.log(chalk.bold('Install:'));
      console.log(chalk.cyan(`  neural-trader package install ${packageName}`));
      console.log();
    } else {
      console.log(chalk.bold('Remove:'));
      console.log(chalk.cyan(`  neural-trader package remove ${packageName}`));
      console.log();
    }

    console.log(chalk.bold.cyan('━'.repeat(60)));
    console.log();

  } catch (error) {
    console.error(chalk.red('Error getting package info:'), error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = infoCommand;
