#!/usr/bin/env node

/**
 * Monitor Command - Main Entry Point
 * Launch real-time monitoring dashboard for trading strategies
 */

const React = require('react');
const { render } = require('ink');
const StrategyMonitor = require('../../lib/strategy-monitor');
const AlertManager = require('../../lib/alert-manager');
const Dashboard = require('./Dashboard');

async function monitorCommand(strategyId, options = {}) {
  // Parse options
  const mockMode = options.mock || !process.env.NAPI_AVAILABLE;
  const updateInterval = options.interval || 1000;

  console.log(`Starting monitoring dashboard for strategy: ${strategyId || 'default'}`);
  console.log(`Mode: ${mockMode ? 'Mock Data' : 'Real Data'}`);
  console.log('');

  // Initialize services
  const strategyMonitor = new StrategyMonitor({
    mockMode,
    updateInterval
  });

  const alertManager = new AlertManager({
    maxAlerts: 100
  });

  // Start monitoring
  let strategy;
  try {
    if (!strategyId) {
      // Create a default demo strategy
      strategyId = 'demo-strategy';
      strategy = await strategyMonitor.startMonitoring(strategyId, {
        name: 'Demo Momentum Strategy',
        type: 'momentum',
        symbols: ['AAPL', 'MSFT', 'GOOGL']
      });
    } else {
      // Monitor existing strategy
      strategy = await strategyMonitor.startMonitoring(strategyId, {
        name: strategyId,
        type: 'custom'
      });
    }
  } catch (error) {
    console.error('Error starting monitoring:', error.message);
    process.exit(1);
  }

  // Render dashboard
  const { waitUntilExit } = render(
    React.createElement(Dashboard, {
      strategyMonitor,
      alertManager,
      initialStrategy: strategy
    })
  );

  // Wait for exit and cleanup
  try {
    await waitUntilExit();
  } finally {
    strategyMonitor.destroy();
    console.log('Dashboard closed');
  }
}

module.exports = monitorCommand;

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const strategyId = args[0];
  const options = {
    mock: args.includes('--mock') || args.includes('-m'),
    interval: 1000
  };

  monitorCommand(strategyId, options).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
