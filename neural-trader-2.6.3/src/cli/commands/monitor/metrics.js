#!/usr/bin/env node

/**
 * Metrics Command
 * Show performance metrics for a strategy
 */

const MetricsCollector = require('../../lib/metrics-collector');

async function metricsCommand(strategyId, options = {}) {
  if (!strategyId) {
    console.error('❌ Strategy ID required');
    console.error('Usage: neural-trader monitor metrics <strategy-id>');
    process.exit(1);
  }

  console.log(`📊 Performance Metrics for: ${strategyId}\n`);

  // Demo metrics data
  const metrics = {
    totalPnL: 5432.18,
    todayPnL: 1234.56,
    totalTrades: 147,
    winningTrades: 89,
    losingTrades: 58,
    winRate: 0.605,
    avgWin: 156.78,
    avgLoss: -89.45,
    largestWin: 890.50,
    largestLoss: -345.20,
    sharpeRatio: 1.85,
    sortinoRatio: 2.34,
    maxDrawdown: -0.125,
    currentDrawdown: -0.032,
    profitFactor: 1.95,
    expectancy: 36.95,
    avgTradeDuration: '2h 15m',
    avgDailyPnL: 215.67
  };

  // Performance Summary
  console.log('\x1b[1m\x1b[36m=== Performance Summary ===\x1b[0m\n');

  console.log('Profitability:');
  const pnlColor = metrics.totalPnL >= 0 ? '\x1b[32m' : '\x1b[31m';
  console.log(`  Total P&L:           ${pnlColor}$${metrics.totalPnL.toFixed(2)}\x1b[0m`);
  console.log(`  Today P&L:           ${pnlColor}$${metrics.todayPnL.toFixed(2)}\x1b[0m`);
  console.log(`  Avg Daily P&L:       $${metrics.avgDailyPnL.toFixed(2)}`);
  console.log('');

  // Trade Statistics
  console.log('Trade Statistics:');
  console.log(`  Total Trades:        ${metrics.totalTrades}`);
  console.log(`  Winning Trades:      \x1b[32m${metrics.winningTrades}\x1b[0m`);
  console.log(`  Losing Trades:       \x1b[31m${metrics.losingTrades}\x1b[0m`);
  console.log(`  Win Rate:            \x1b[36m${(metrics.winRate * 100).toFixed(1)}%\x1b[0m`);
  console.log(`  Average Win:         \x1b[32m$${metrics.avgWin.toFixed(2)}\x1b[0m`);
  console.log(`  Average Loss:        \x1b[31m$${metrics.avgLoss.toFixed(2)}\x1b[0m`);
  console.log(`  Largest Win:         \x1b[32m$${metrics.largestWin.toFixed(2)}\x1b[0m`);
  console.log(`  Largest Loss:        \x1b[31m$${metrics.largestLoss.toFixed(2)}\x1b[0m`);
  console.log(`  Avg Trade Duration:  ${metrics.avgTradeDuration}`);
  console.log('');

  // Risk Metrics
  console.log('Risk Metrics:');
  const sharpeColor = metrics.sharpeRatio >= 1.5 ? '\x1b[32m' : metrics.sharpeRatio >= 1 ? '\x1b[33m' : '\x1b[31m';
  console.log(`  Sharpe Ratio:        ${sharpeColor}${metrics.sharpeRatio.toFixed(2)}\x1b[0m`);
  console.log(`  Sortino Ratio:       ${sharpeColor}${metrics.sortinoRatio.toFixed(2)}\x1b[0m`);
  console.log(`  Max Drawdown:        \x1b[31m${(metrics.maxDrawdown * 100).toFixed(2)}%\x1b[0m`);
  console.log(`  Current Drawdown:    \x1b[31m${(metrics.currentDrawdown * 100).toFixed(2)}%\x1b[0m`);
  console.log(`  Profit Factor:       ${metrics.profitFactor.toFixed(2)}`);
  console.log(`  Expectancy:          $${metrics.expectancy.toFixed(2)}`);
  console.log('');

  // Rating
  const rating = getRating(metrics);
  const ratingColor = rating.color;
  console.log(`\x1b[1mOverall Rating: ${ratingColor}${rating.stars}\x1b[0m ${rating.text}`);
  console.log('');
}

function getRating(metrics) {
  let score = 0;

  // Profitability (0-25 points)
  if (metrics.totalPnL > 10000) score += 25;
  else if (metrics.totalPnL > 5000) score += 20;
  else if (metrics.totalPnL > 1000) score += 15;
  else if (metrics.totalPnL > 0) score += 10;

  // Win Rate (0-25 points)
  if (metrics.winRate >= 0.6) score += 25;
  else if (metrics.winRate >= 0.55) score += 20;
  else if (metrics.winRate >= 0.5) score += 15;
  else if (metrics.winRate >= 0.45) score += 10;

  // Sharpe Ratio (0-25 points)
  if (metrics.sharpeRatio >= 2) score += 25;
  else if (metrics.sharpeRatio >= 1.5) score += 20;
  else if (metrics.sharpeRatio >= 1) score += 15;
  else if (metrics.sharpeRatio >= 0.5) score += 10;

  // Drawdown (0-25 points)
  if (metrics.maxDrawdown > -0.05) score += 25;
  else if (metrics.maxDrawdown > -0.1) score += 20;
  else if (metrics.maxDrawdown > -0.15) score += 15;
  else if (metrics.maxDrawdown > -0.2) score += 10;

  // Convert to rating
  if (score >= 90) return { stars: '⭐⭐⭐⭐⭐', text: 'Excellent', color: '\x1b[32m' };
  if (score >= 75) return { stars: '⭐⭐⭐⭐', text: 'Very Good', color: '\x1b[32m' };
  if (score >= 60) return { stars: '⭐⭐⭐', text: 'Good', color: '\x1b[33m' };
  if (score >= 45) return { stars: '⭐⭐', text: 'Fair', color: '\x1b[33m' };
  return { stars: '⭐', text: 'Needs Improvement', color: '\x1b[31m' };
}

module.exports = metricsCommand;

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const strategyId = args[0];

  metricsCommand(strategyId).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
