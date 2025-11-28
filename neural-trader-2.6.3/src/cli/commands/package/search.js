/**
 * Package Search Command
 * Searches packages by keyword
 * @module cli/commands/package/search
 */

const chalk = require('chalk');
const { searchPackages } = require('../../data/packages');
const PackageManager = require('../../lib/package-manager');
const PackageCache = require('../../lib/package-cache');

/**
 * Search packages command
 * @param {string} query - Search query
 * @param {Object} options - Command options
 */
async function searchCommand(query, options = {}) {
  if (!query) {
    console.error(chalk.red('Error: Search query is required'));
    console.log(chalk.dim('Usage: neural-trader package search <query>'));
    process.exit(1);
  }

  const packageManager = new PackageManager();
  const cache = new PackageCache();

  try {
    // Search packages
    let results;
    if (!options.noCache) {
      results = cache.getSearchResults(query);
    }

    if (!results) {
      results = searchPackages(query);
      cache.cacheSearchResults(query, results);
    }

    const resultCount = Object.keys(results).length;

    console.log();
    console.log(chalk.bold.cyan(`🔍 Search results for: ${chalk.yellow(query)}`));
    console.log(chalk.dim(`Found ${resultCount} package${resultCount !== 1 ? 's' : ''}`));
    console.log();

    if (resultCount === 0) {
      console.log(chalk.yellow('No packages found matching your query'));
      console.log(chalk.dim('Try a different search term or use "neural-trader package list" to see all packages'));
      console.log();
      return;
    }

    // Display results
    Object.entries(results).forEach(([name, pkg]) => {
      const installed = packageManager.isInstalled(name);
      const status = installed ? chalk.green('✓ installed') : chalk.dim('not installed');
      const exampleBadge = pkg.isExample ? chalk.blue('[example]') : '';

      console.log(chalk.bold(name) + ' ' + status + ' ' + exampleBadge);
      console.log(chalk.dim(`  ${pkg.description}`));

      // Highlight matching features
      if (options.verbose) {
        const matchingFeatures = pkg.features.filter(f =>
          f.toLowerCase().includes(query.toLowerCase())
        );

        if (matchingFeatures.length > 0) {
          console.log(chalk.dim('  Matching features:'));
          matchingFeatures.forEach(feature => {
            const highlighted = feature.replace(
              new RegExp(query, 'gi'),
              match => chalk.yellow(match)
            );
            console.log(chalk.dim(`    • ${highlighted}`));
          });
        }
      }

      console.log();
    });

    // Show quick install command for first result if not installed
    if (resultCount > 0) {
      const [firstName, firstPkg] = Object.entries(results)[0];
      if (!packageManager.isInstalled(firstName)) {
        console.log(chalk.dim('Quick install first result:'));
        console.log(chalk.cyan(`  neural-trader package install ${firstName}`));
        console.log();
      }
    }

  } catch (error) {
    console.error(chalk.red('Error searching packages:'), error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = searchCommand;
