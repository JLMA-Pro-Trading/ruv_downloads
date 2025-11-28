/**
 * Version Command
 * Displays version information and system status
 */

const path = require('path');
const { createNeuralTraderBanner, createKeyValueTable, colors, formatStatus } = require('../ui');
const { getNAPIStatus } = require('../lib/napi-loader');

/**
 * Version command handler
 * @param {Object} options - Command options
 */
async function versionCommand(options = {}) {
  const pkg = require(path.join(__dirname, '../../../package.json'));
  const napiStatus = getNAPIStatus();

  // JSON output
  if (options.json) {
    const data = {
      version: pkg.version,
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      napi: {
        available: napiStatus.available,
        functions: napiStatus.functionCount,
        mode: napiStatus.mode
      }
    };
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Pretty output
  console.log(createNeuralTraderBanner());
  console.log(colors.heading('  System Information'));
  console.log('');

  // Version info
  console.log(`  Version: ${colors.bold(pkg.version)}`);
  console.log(`  Node: ${colors.dim(process.version)}`);
  console.log(`  Platform: ${colors.dim(process.platform + '-' + process.arch)}`);
  console.log('');

  // NAPI status
  if (napiStatus.available) {
    console.log(formatStatus('success', `NAPI Bindings: ${colors.bold('Available')} (${napiStatus.functionCount} functions)`));
  } else {
    console.log(formatStatus('warning', `NAPI Bindings: ${colors.dim('Not loaded (CLI-only mode)')}`));
  }
  console.log('');

  // Package stats
  const { getAllPackages, getCategories } = require('../data/packages');
  const allPackages = getAllPackages();
  const totalPackages = Object.keys(allPackages).length;
  const categories = getCategories();

  // Calculate category stats manually
  const categoryStats = {};
  Object.values(allPackages).forEach(pkg => {
    categoryStats[pkg.category] = (categoryStats[pkg.category] || 0) + 1;
  });

  console.log(colors.heading('  Available Packages'));
  console.log('');
  console.log(`  Total: ${colors.bold(totalPackages.toString())} packages`);
  console.log('');
  console.log(colors.subheading('  Categories:'));
  Object.entries(categoryStats).forEach(([cat, count]) => {
    console.log(`    ${colors.dim('•')} ${cat}: ${colors.bold(count.toString())} package${count > 1 ? 's' : ''}`);
  });
  console.log('');

  // Links
  console.log(colors.dim('  Documentation: ') + colors.link('https://github.com/ruvnet/neural-trader'));
  console.log(colors.dim('  Issues: ') + colors.link('https://github.com/ruvnet/neural-trader/issues'));
  console.log('');
}

module.exports = versionCommand;
