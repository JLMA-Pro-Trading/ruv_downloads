#!/usr/bin/env node

/**
 * Neural Trader CLI - Entry Point
 * Enhanced with Commander.js foundation (v3.0.0)
 * Maintains backward compatibility with existing commands
 */

const args = process.argv.slice(2);
const command = args[0];

// Commands migrated to new structure
const migratedCommands = ['version', 'help', 'mcp', 'agent', '-v', '--version', '-h', '--help', 'deploy'];

// New interactive and config commands
const newCommands = ['interactive', 'i', 'configure', 'config'];

// Handle new commands
if (newCommands.includes(command)) {
  handleNewCommands(command, args.slice(1)).catch(error => {
    console.error('Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  });
} else if (!command || migratedCommands.includes(command)) {
  // If command is migrated, use new modular structure
  const { run } = require('../src/cli/program');
  run(process.argv).catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
} else {
  // Fall back to legacy implementation for commands not yet migrated
  runLegacyCommand(command, args.slice(1));
}

/**
 * Handle new interactive and config commands
 */
async function handleNewCommands(command, commandArgs) {
  // Handle interactive command
  if (command === 'interactive' || command === 'i') {
    const interactive = require('../src/cli/commands/interactive');
    const options = {
      noHistory: commandArgs.includes('--no-history'),
      noColor: commandArgs.includes('--no-color')
    };
    await interactive(options);
    return;
  }

  // Handle configure command
  if (command === 'configure') {
    const configure = require('../src/cli/commands/configure');
    const options = {
      reset: commandArgs.includes('--reset'),
      advanced: commandArgs.includes('--advanced'),
      update: commandArgs.includes('--update')
    };
    await configure(options);
    return;
  }

  // Handle config command
  if (command === 'config') {
    const config = require('../src/cli/commands/config');
    const subcommand = commandArgs[0];
    const subArgs = commandArgs.slice(1);
    const options = {
      user: commandArgs.includes('--user'),
      project: commandArgs.includes('--project'),
      json: commandArgs.includes('--json'),
      yaml: commandArgs.includes('--yaml'),
      force: commandArgs.includes('--force')
    };
    await config(subcommand, subArgs, options);
    return;
  }
}

/**
 * Legacy command implementation (to be migrated incrementally)
 */
function runLegacyCommand(command, commandArgs) {
  const fs = require('fs');
  const path = require('path');
  const { spawn } = require('child_process');

  // ANSI Color Codes
  const c = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
  };

  // Load package registry from new modular location
  const { PACKAGES } = require('../src/cli/data/packages');

  // Helper functions
  const print = (msg, color = 'reset') => console.log(`${c[color]}${msg}${c.reset}`);

  // Legacy commands implementation
  const commands = {
    init: async (type = 'trading', template) => {
      type = type.toLowerCase();

      // Handle example: prefix
      if (type.startsWith('example:')) {
        const exampleName = type.split(':')[1];
        return commands.initExample(exampleName);
      }

      console.log(`🚀 Initializing ${PACKAGES[type]?.name || 'Trading'} project...`);
      console.log('');

      // Create base structure
      const dirs = ['src', 'data', 'config'];
      if (type === 'trading') {
        dirs.push('strategies', 'backtest-results');
      } else if (type === 'accounting') {
        dirs.push('reports', 'tax-lots');
      } else if (type === 'predictor') {
        dirs.push('models', 'predictions');
      }

      dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✓ Created ${dir}/`);
        }
      });

      // Create type-specific config
      const config = getConfigTemplate(type, template);
      fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
      console.log('✓ Created config.json');

      // Create package.json
      const pkgJson = {
        name: `my-${type}-project`,
        version: '1.0.0',
        private: true,
        dependencies: getPackageDependencies(type)
      };
      fs.writeFileSync('package.json', JSON.stringify(pkgJson, null, 2));
      console.log('✓ Created package.json');

      // Create example file
      const example = getExampleCode(type, template);
      fs.writeFileSync(`src/main.js`, example);
      console.log('✓ Created src/main.js');

      // Create README
      const readme = getReadmeTemplate(type);
      fs.writeFileSync('README.md', readme);
      console.log('✓ Created README.md');

      console.log('');
      console.log('✅ Project initialized!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. npm install');
      console.log('  2. Edit config.json with your settings');
      console.log('  3. node src/main.js');
      console.log('');
    },

    initExample: async (exampleName) => {
      const fullKey = `example:${exampleName}`;
      if (!PACKAGES[fullKey]) {
        console.error(`❌ Unknown example: ${exampleName}`);
        const availableExamples = Object.keys(PACKAGES)
          .filter(k => k.startsWith('example:'))
          .map(k => k.replace('example:', ''));
        console.error('Available examples:', availableExamples.join(', '));
        process.exit(1);
      }

      console.log(`🚀 Initializing example: ${exampleName}...`);
      console.log('');

      const dirs = ['src', 'data', 'output'];
      dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`✓ Created ${dir}/`);
        }
      });

      const pkgJson = {
        name: `example-${exampleName}`,
        version: '1.0.0',
        private: true,
        dependencies: {
          'neural-trader': '^2.3.15'
        }
      };
      fs.writeFileSync('package.json', JSON.stringify(pkgJson, null, 2));
      console.log(`✓ Created package.json for ${exampleName}`);

      console.log('');
      console.log('✅ Example initialized!');
      console.log('Run: npm install && node src/main.js');
      console.log('');
    },

    list: (category) => {
      console.log('');
      console.log('📦 Available Neural Trader Packages:');
      console.log('');

      const packagesToShow = category
        ? Object.entries(PACKAGES).filter(([_, pkg]) => pkg.category === category)
        : Object.entries(PACKAGES);

      packagesToShow.forEach(([key, pkg]) => {
        console.log(`  ${key.padEnd(35)} ${pkg.name}`);
        console.log(`  ${' '.repeat(35)} ${pkg.description}`);
        if (pkg.packages) {
          console.log(`  ${' '.repeat(35)} Packages: ${pkg.packages.join(', ')}`);
        }
        console.log('');
      });

      console.log('Use "neural-trader init <type>" to create a project');
      console.log('');
    },

    info: (packageName) => {
      if (!packageName) {
        console.error('❌ Package name required');
        console.error('Usage: neural-trader info <package>');
        console.error('Example: neural-trader info backtesting');
        process.exit(1);
      }

      const pkg = PACKAGES[packageName];
      if (!pkg) {
        console.error(`❌ Unknown package: ${packageName}`);
        console.error('Run "neural-trader list" to see all packages');
        process.exit(1);
      }

      console.log('');
      console.log(`${c.cyan}${c.bright}${pkg.name}${c.reset}`);
      console.log(`${c.dim}Category: ${pkg.category}${c.reset}`);
      console.log('');
      console.log(`${c.bright}Description:${c.reset}`);
      console.log(`  ${pkg.description}`);
      console.log('');

      if (pkg.features && pkg.features.length > 0) {
        console.log(`${c.bright}Features:${c.reset}`);
        pkg.features.forEach(feature => {
          console.log(`  ${c.green}•${c.reset} ${feature}`);
        });
        console.log('');
      }

      if (pkg.packages && pkg.packages.length > 0) {
        console.log(`${c.bright}NPM Packages:${c.reset}`);
        pkg.packages.forEach(p => {
          console.log(`  ${c.dim}•${c.reset} ${p}`);
        });
        console.log('');
      }

      if (pkg.isExample) {
        console.log(`${c.yellow}⚡ This is an example package${c.reset}`);
        console.log('');
      }

      console.log(`${c.bright}Initialize:${c.reset}`);
      console.log(`  ${c.cyan}neural-trader init ${packageName}${c.reset}`);
      console.log('');
    },

    install: async (packageName) => {
      if (!packageName) {
        console.error('❌ Package name required');
        console.error('Usage: neural-trader install <package>');
        process.exit(1);
      }

      console.log(`📦 Installing ${packageName}...`);
      console.log('');

      if (!fs.existsSync('package.json')) {
        console.error('❌ No package.json found. Run "neural-trader init" first.');
        process.exit(1);
      }

      const npm = spawn('npm', ['install', packageName], {
        stdio: 'inherit',
        shell: true
      });

      npm.on('exit', (code) => {
        if (code === 0) {
          console.log('');
          console.log(`✅ ${packageName} installed successfully!`);
        } else {
          process.exit(code);
        }
      });
    },

    test: async () => {
      const { getNAPIStatus } = require('../src/cli/lib/napi-loader');

      console.log('Testing Neural Trader components...');
      console.log('');

      const napiStatus = getNAPIStatus();

      if (napiStatus.available) {
        console.log('✅ NAPI Bindings:');
        const functions = ['fetchMarketData', 'runStrategy', 'backtest', 'trainModel', 'predict'];

        const napi = require('../src/cli/lib/napi-loader').loadNAPI();
        functions.forEach(fn => {
          if (typeof napi[fn] === 'function') {
            console.log(`  ✓ ${fn}`);
          } else {
            console.log(`  ✗ ${fn} (missing)`);
          }
        });
      } else {
        console.log('⚠️  NAPI bindings not loaded (CLI-only mode)');
      }

      console.log('');
      console.log('📦 Installed Packages:');
      const pkgJsonPath = 'package.json';
      if (fs.existsSync(pkgJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const neuralPackages = Object.keys(deps).filter(d =>
          d.includes('neural-trader') || d.includes('@neural-trader')
        );

        if (neuralPackages.length > 0) {
          neuralPackages.forEach(p => console.log(`  ✓ ${p}`));
        } else {
          console.log('  (none found)');
        }
      } else {
        console.log('  No package.json in current directory');
      }

      console.log('');
      console.log('✅ Tests complete!');
      console.log('');
    },

    doctor: async () => {
      // Use enhanced doctor command
      const doctorCommand = require('../src/cli/commands/doctor');
      const options = {
        verbose: args.includes('--verbose') || args.includes('-v'),
        json: args.includes('--json')
      };
      await doctorCommand(options);
    },

    benchmark: async () => {
      // Use benchmark command
      const benchmarkCommand = require('../src/cli/commands/benchmark');
      const subArgs = commandArgs;
      const options = {
        json: args.includes('--json'),
        verbose: args.includes('--verbose') || args.includes('-v'),
        iterations: parseInt(args.find((a, i) => args[i - 1] === '--iterations') || '1')
      };
      await benchmarkCommand(subArgs, options);
    },

    monitor: async (subcommand, ...args) => {
      const monitorPath = path.join(__dirname, '../src/cli/commands/monitor');

      if (!subcommand) {
        // Launch default monitoring dashboard
        const monitorCmd = require(path.join(monitorPath, 'index.js'));
        return monitorCmd();
      }

      // Handle subcommands
      switch (subcommand) {
        case 'list':
          const listCmd = require(path.join(monitorPath, 'list.js'));
          return listCmd();

        case 'logs':
          const logsCmd = require(path.join(monitorPath, 'logs.js'));
          return logsCmd(args[0], { follow: args.includes('--follow') || args.includes('-f') });

        case 'metrics':
          const metricsCmd = require(path.join(monitorPath, 'metrics.js'));
          return metricsCmd(args[0]);

        case 'alerts':
          const alertsCmd = require(path.join(monitorPath, 'alerts.js'));
          return alertsCmd({
            all: args.includes('--all'),
            severity: args.find(arg => arg.startsWith('--severity='))?.split('=')[1]
          });

        default:
          // Assume it's a strategy ID
          const monitorCmd = require(path.join(monitorPath, 'index.js'));
          return monitorCmd(subcommand, {
            mock: args.includes('--mock') || args.includes('-m')
          });
      }
    }
  };

  // Helper functions for templates
  function getConfigTemplate(type, template) {
    if (type === 'trading') {
      return {
        trading: {
          provider: "alpaca",
          symbols: template === 'pairs-trading' ? ["AAPL-MSFT", "SPY-QQQ"] : ["AAPL", "MSFT", "GOOGL"],
          strategy: template || "momentum",
          parameters: { threshold: 0.02, lookback: 20, stop_loss: 0.05 }
        },
        risk: { max_position_size: 10000, max_portfolio_risk: 0.02, stop_loss_pct: 0.05 }
      };
    } else if (type === 'accounting') {
      return {
        accounting: {
          method: "HIFO",
          currency: "USD",
          tax_lots: { enabled: true, tracking: "automated" }
        },
        reporting: { frequency: "monthly", tax_year: new Date().getFullYear() }
      };
    } else if (type === 'predictor') {
      return {
        predictor: { method: "conformal", confidence: 0.95, backend: "wasm" },
        training: { window_size: 100, update_frequency: "daily" }
      };
    }
    return {};
  }

  function getPackageDependencies(type) {
    const base = { 'neural-trader': '^2.3.15' };
    if (type === 'accounting') {
      return { ...base, '@neural-trader/agentic-accounting-core': '^0.1.0' };
    } else if (type === 'predictor') {
      return { ...base, '@neural-trader/predictor': '^0.1.0' };
    }
    return base;
  }

  function getExampleCode(type, template) {
    if (type === 'trading') {
      return `const nt = require('neural-trader');
const config = require('../config.json');

async function main() {
  console.log('Starting ${template || 'momentum'} trading strategy...');

  // Fetch market data
  const data = await nt.fetchMarketData(
    config.trading.symbols[0],
    '2024-01-01',
    '2024-12-31',
    config.trading.provider
  );

  console.log(\`Fetched \${data.length} data points\`);

  // Run strategy
  const result = await nt.runStrategy(
    config.trading.strategy,
    config.trading.parameters
  );

  console.log('Strategy result:', result);
}

main().catch(console.error);
`;
    }
    return `console.log('Hello from Neural Trader!');`;
  }

  function getReadmeTemplate(type) {
    return `# Neural Trader ${PACKAGES[type]?.name || 'Project'}

${PACKAGES[type]?.description || 'High-performance trading and analytics system'}

## Getting Started

\`\`\`bash
npm install
node src/main.js
\`\`\`

## Configuration

Edit \`config.json\` to customize your ${type} settings.

## Documentation

- [Neural Trader Documentation](https://github.com/ruvnet/neural-trader)
- [API Reference](https://github.com/ruvnet/neural-trader/wiki)

## Support

- Issues: https://github.com/ruvnet/neural-trader/issues
`;
  }

  // Execute legacy command
  if (commands[command]) {
    try {
      const result = commands[command](...commandArgs);
      // Handle both sync and async commands
      if (result && typeof result.catch === 'function') {
        result.catch(error => {
          console.error('Error:', error.message);
          if (process.env.DEBUG) {
            console.error(error.stack);
          }
          process.exit(1);
        });
      }
    } catch (error) {
      console.error('Error:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "neural-trader help" for usage information');
    process.exit(1);
  }
}
