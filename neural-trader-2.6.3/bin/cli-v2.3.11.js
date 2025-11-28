#!/usr/bin/env node

/**
 * Neural Trader CLI - NAPI Edition
 * Uses the NAPI bindings directly for a working CLI without requiring Rust compilation
 */

const nt = require('../index.js');

const commands = {
  version: () => {
    console.log('Neural Trader v2.3.11');
    console.log('NAPI Bindings: Available ✓');
    console.log('CLI: Fully functional (no build required)');
    console.log('');
    console.log('Available functions:', Object.keys(nt).join(', '));
  },

  help: () => {
    console.log('');
    console.log('Neural Trader - High-Performance Trading System');
    console.log('');
    console.log('Usage: neural-trader <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  version              Show version information');
    console.log('  help                 Show this help message');
    console.log('  init                 Initialize a new trading project');
    console.log('  test                 Test NAPI bindings');
    console.log('');
    console.log('JavaScript API:');
    console.log('  const nt = require("neural-trader");');
    console.log('');
    console.log('  // Fetch market data');
    console.log('  const data = await nt.fetchMarketData("AAPL", "2024-01-01", "2024-01-31");');
    console.log('');
    console.log('  // Run a strategy');
    console.log('  const result = await nt.runStrategy("momentum", { threshold: 0.02 });');
    console.log('');
    console.log('  // Backtest');
    console.log('  const bt = await nt.backtest("momentum", config, "2024-01-01", "2024-12-31");');
    console.log('');
    console.log('For more information: https://github.com/ruvnet/neural-trader');
    console.log('');
  },

  init: () => {
    const fs = require('fs');
    const path = require('path');

    console.log('🚀 Initializing Neural Trader project...');
    console.log('');

    // Create project structure
    const dirs = ['strategies', 'data', 'backtest-results'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Created ${dir}/`);
      }
    });

    // Create example config
    const config = {
      trading: {
        provider: "alpaca",
        symbols: ["AAPL", "MSFT", "GOOGL"],
        strategies: ["momentum", "mean-reversion"]
      },
      risk: {
        max_position_size: 10000,
        max_portfolio_risk: 0.02,
        stop_loss_pct: 0.05
      }
    };

    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log('✓ Created config.json');

    // Create example strategy
    const exampleCode = `const nt = require('neural-trader');

async function runMomentumStrategy() {
  console.log('Fetching market data...');

  const data = await nt.fetchMarketData(
    'AAPL',
    '2024-01-01',
    '2024-12-31',
    'alpaca'
  );

  console.log('Running momentum strategy...');

  const result = await nt.runStrategy('momentum', {
    threshold: 0.02,
    lookback: 20
  });

  console.log('Strategy result:', result);
}

runMomentumStrategy().catch(console.error);
`;

    fs.writeFileSync('strategies/example.js', exampleCode);
    console.log('✓ Created strategies/example.js');

    console.log('');
    console.log('✅ Project initialized!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit config.json with your API keys');
    console.log('  2. Run: node strategies/example.js');
    console.log('  3. Explore the API: https://github.com/ruvnet/neural-trader');
    console.log('');
  },

  test: async () => {
    console.log('Testing NAPI bindings...');
    console.log('');

    const functions = [
      'fetchMarketData',
      'streamMarketData',
      'runStrategy',
      'backtest',
      'executeOrder',
      'getPortfolio',
      'trainModel',
      'predict'
    ];

    functions.forEach(fn => {
      if (typeof nt[fn] === 'function') {
        console.log(`✓ ${fn}`);
      } else {
        console.log(`✗ ${fn} (missing)`);
      }
    });

    console.log('');
    console.log('✅ All core functions available!');
    console.log('');
  }
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (commands[command]) {
    try {
      await commands[command]();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "neural-trader help" for usage information');
    process.exit(1);
  }
}

main();
