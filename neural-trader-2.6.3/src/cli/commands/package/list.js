/**
 * Package List Command
 * Lists available packages with filtering by category
 * @module cli/commands/package/list
 */

const chalk = require('chalk');
const Table = require('cli-table3');
const { getAllPackages, getPackagesByCategory, getCategories } = require('../../data/packages');
const PackageManager = require('../../lib/package-manager');
const PackageCache = require('../../lib/package-cache');

/**
 * List packages command
 * @param {string} category - Optional category filter
 * @param {Object} options - Command options
 */
async function listCommand(category, options = {}) {
  const packageManager = new PackageManager();
  const cache = new PackageCache();

  try {
    // Get packages
    let packages;
    const cacheKey = category || 'all';

    if (!options.noCache) {
      packages = cache.getPackageList(cacheKey);
    }

    if (!packages) {
      if (category) {
        if (category === 'all') {
          packages = getAllPackages();
        } else {
          packages = getPackagesByCategory(category);
        }
      } else {
        packages = getAllPackages();
      }
      cache.cachePackageList(cacheKey, packages);
    }

    if (Object.keys(packages).length === 0) {
      console.log(chalk.yellow(`No packages found${category ? ` in category: ${category}` : ''}`));
      return;
    }

    // Apply additional filters
    if (options.installed) {
      packages = Object.fromEntries(
        Object.entries(packages).filter(([name]) => packageManager.isInstalled(name))
      );
    }

    if (options.notInstalled) {
      packages = Object.fromEntries(
        Object.entries(packages).filter(([name]) => !packageManager.isInstalled(name))
      );
    }

    if (options.examples) {
      packages = Object.fromEntries(
        Object.entries(packages).filter(([, pkg]) => pkg.isExample)
      );
    }

    // Display header
    console.log();
    if (category && category !== 'all') {
      console.log(chalk.bold.cyan(`📦 Packages in category: ${chalk.yellow(category)}`));
    } else {
      console.log(chalk.bold.cyan('📦 Available Neural Trader Packages'));
    }
    console.log();

    // Display in table format if --table flag
    if (options.table) {
      displayTable(packages, packageManager);
    } else {
      displayList(packages, packageManager, options);
    }

    // Display summary
    console.log();
    const total = Object.keys(packages).length;
    const installed = Object.keys(packages).filter(name => packageManager.isInstalled(name)).length;
    console.log(chalk.dim(`Total: ${total} packages, ${installed} installed`));

    // Show available categories
    if (!category || category === 'all') {
      console.log();
      console.log(chalk.dim('Categories: ' + getCategories().join(', ')));
      console.log(chalk.dim('Filter by category: neural-trader package list <category>'));
    }
    console.log();

  } catch (error) {
    console.error(chalk.red('Error listing packages:'), error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Display packages as a list
 * @param {Object} packages - Packages to display
 * @param {PackageManager} packageManager - Package manager instance
 * @param {Object} options - Display options
 */
function displayList(packages, packageManager, options = {}) {
  Object.entries(packages).forEach(([name, pkg]) => {
    const installed = packageManager.isInstalled(name);
    const status = installed ? chalk.green('✓ installed') : chalk.dim('not installed');
    const exampleBadge = pkg.isExample ? chalk.blue('[example]') : '';

    console.log(chalk.bold(name) + ' ' + status + ' ' + exampleBadge);
    console.log(chalk.dim(`  ${pkg.description}`));

    if (options.verbose) {
      console.log(chalk.dim(`  Version: ${pkg.version} | Size: ${pkg.size} | Category: ${pkg.category}`));
      if (pkg.packages && pkg.packages.length > 0) {
        console.log(chalk.dim(`  Packages: ${pkg.packages.join(', ')}`));
      }
      if (pkg.dependencies && pkg.dependencies.length > 0) {
        console.log(chalk.dim(`  Dependencies: ${pkg.dependencies.join(', ')}`));
      }
    }

    console.log();
  });
}

/**
 * Display packages as a table
 * @param {Object} packages - Packages to display
 * @param {PackageManager} packageManager - Package manager instance
 */
function displayTable(packages, packageManager) {
  const table = new Table({
    head: [
      chalk.cyan('Name'),
      chalk.cyan('Version'),
      chalk.cyan('Size'),
      chalk.cyan('Category'),
      chalk.cyan('Status')
    ],
    colWidths: [30, 12, 12, 15, 15],
    wordWrap: true
  });

  Object.entries(packages).forEach(([name, pkg]) => {
    const installed = packageManager.isInstalled(name);
    const status = installed ? chalk.green('✓ Installed') : chalk.dim('Not installed');

    table.push([
      name,
      pkg.version,
      pkg.size,
      pkg.category,
      status
    ]);
  });

  console.log(table.toString());
}

/**
 * Export command handler
 */
module.exports = listCommand;
