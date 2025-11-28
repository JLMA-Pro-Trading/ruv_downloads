#!/usr/bin/env node

/**
 * List Command
 * List all running strategies
 */

const StrategyMonitor = require('../../lib/strategy-monitor');

async function listCommand(options = {}) {
  console.log('🔍 Running Strategies:\n');

  // In a real implementation, this would connect to a service
  // that tracks all running strategies. For now, we'll show a demo.

  const demoStrategies = [
    {
      id: 'momentum-1',
      name: 'Momentum Strategy',
      type: 'momentum',
      status: 'running',
      uptime: '2h 34m',
      pnl: '+$1,234.56'
    },
    {
      id: 'pairs-trading-1',
      name: 'Pairs Trading',
      type: 'pairs-trading',
      status: 'running',
      uptime: '1h 15m',
      pnl: '-$234.12'
    },
    {
      id: 'mean-reversion-1',
      name: 'Mean Reversion',
      type: 'mean-reversion',
      status: 'stopped',
      uptime: '0h 0m',
      pnl: '$0.00'
    }
  ];

  if (demoStrategies.length === 0) {
    console.log('No running strategies found.');
    console.log('Start a strategy with: neural-trader run <strategy>');
    return;
  }

  // Print header
  console.log(
    'ID'.padEnd(20) +
    'Name'.padEnd(25) +
    'Status'.padEnd(12) +
    'Uptime'.padEnd(12) +
    'P&L'
  );
  console.log('-'.repeat(80));

  // Print strategies
  demoStrategies.forEach(strategy => {
    const statusColor = strategy.status === 'running' ? '\x1b[32m' : '\x1b[33m';
    const pnlColor = strategy.pnl.startsWith('+') ? '\x1b[32m' : strategy.pnl.startsWith('-') ? '\x1b[31m' : '\x1b[0m';

    console.log(
      strategy.id.padEnd(20) +
      strategy.name.padEnd(25) +
      `${statusColor}${strategy.status.padEnd(12)}\x1b[0m` +
      strategy.uptime.padEnd(12) +
      `${pnlColor}${strategy.pnl}\x1b[0m`
    );
  });

  console.log('');
  console.log('Use "neural-trader monitor <id>" to view details');
}

module.exports = listCommand;

// CLI entry point
if (require.main === module) {
  listCommand().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
