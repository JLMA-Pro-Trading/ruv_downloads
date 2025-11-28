/**
 * Help Command
 * Enhanced help with categories and examples
 */

const { createNeuralTraderBanner, createSection, createDivider, colors } = require('../ui');
const { getCategories, getPackagesByCategory } = require('../data/packages');

/**
 * Help command handler
 * @param {Object} options - Command options
 */
async function helpCommand(options = {}) {
  console.log(createNeuralTraderBanner());

  // Usage
  console.log(colors.heading('Usage:'));
  console.log(`  ${colors.bold('neural-trader')} ${colors.dim('<command>')} ${colors.dim('[options]')}`);
  console.log('');

  // Core Commands
  console.log(createSection('Core Commands'));
  printCommandTable([
    { name: 'version', desc: 'Show version and system info', aliases: '-v, --version' },
    { name: 'help', desc: 'Show this help message', aliases: '-h, --help' },
    { name: 'init [type]', desc: 'Initialize a new project', aliases: '' },
    { name: 'list [category]', desc: 'List available packages', aliases: '' },
    { name: 'info <package>', desc: 'Show package details', aliases: '' },
    { name: 'install <pkg>', desc: 'Install a sub-package', aliases: '' },
    { name: 'test', desc: 'Test NAPI bindings', aliases: '' },
    { name: 'doctor', desc: 'Run health checks', aliases: '' }
  ]);

  // Init Types
  console.log(createSection('Init Types'));

  const categories = getCategories();
  categories.forEach(category => {
    const packages = getPackagesByCategory(category);
    if (packages.length > 0) {
      console.log(colors.subheading(`  ${category}:`));
      packages.slice(0, 3).forEach(pkg => {
        console.log(`    ${colors.dim('•')} ${colors.bold(pkg.id)} - ${colors.dim(pkg.description.substring(0, 60))}...`);
      });
      if (packages.length > 3) {
        console.log(`    ${colors.dim('... and ' + (packages.length - 3) + ' more')}`);
      }
      console.log('');
    }
  });

  // Quick Start
  console.log(createSection('Quick Start'));
  console.log(colors.dim('  # Create a trading project'));
  console.log(`  ${colors.code('neural-trader init trading')}`);
  console.log('');
  console.log(colors.dim('  # Create an example project'));
  console.log(`  ${colors.code('neural-trader init example:portfolio-optimization')}`);
  console.log('');
  console.log(colors.dim('  # See all packages'));
  console.log(`  ${colors.code('neural-trader list')}`);
  console.log('');

  // Examples
  console.log(createSection('Examples'));
  console.log(`  ${colors.code('neural-trader version')}          ${colors.dim('# Show version info')}`);
  console.log(`  ${colors.code('neural-trader list trading')}     ${colors.dim('# List trading packages')}`);
  console.log(`  ${colors.code('neural-trader info backtesting')} ${colors.dim('# Show backtesting details')}`);
  console.log(`  ${colors.code('neural-trader init trading')}     ${colors.dim('# Create trading project')}`);
  console.log(`  ${colors.code('neural-trader doctor')}           ${colors.dim('# Check system health')}`);
  console.log('');

  // Global Options
  console.log(createSection('Global Options'));
  printOptionsTable([
    { flag: '--debug', desc: 'Enable debug logging' },
    { flag: '--json', desc: 'Output in JSON format' },
    { flag: '--no-color', desc: 'Disable colored output' },
    { flag: '-q, --quiet', desc: 'Quiet mode (minimal output)' },
    { flag: '--version, -v', desc: 'Show version' },
    { flag: '--help, -h', desc: 'Show help' }
  ]);

  // Links
  console.log(createDivider());
  console.log(colors.dim('  Documentation: ') + colors.link('https://github.com/ruvnet/neural-trader'));
  console.log(colors.dim('  Report issues: ') + colors.link('https://github.com/ruvnet/neural-trader/issues'));
  console.log('');
}

/**
 * Print command table
 * @param {Array} commands - Array of command objects
 */
function printCommandTable(commands) {
  commands.forEach(cmd => {
    const name = colors.bold(cmd.name.padEnd(25));
    const desc = cmd.desc;
    const aliases = cmd.aliases ? colors.dim(` (${cmd.aliases})`) : '';
    console.log(`  ${name} ${desc}${aliases}`);
  });
  console.log('');
}

/**
 * Print options table
 * @param {Array} options - Array of option objects
 */
function printOptionsTable(options) {
  options.forEach(opt => {
    const flag = colors.code(opt.flag.padEnd(20));
    const desc = colors.dim(opt.desc);
    console.log(`  ${flag} ${desc}`);
  });
  console.log('');
}

module.exports = helpCommand;
