#!/usr/bin/env node

/**
 * Alerts Command
 * Show alerts and notifications
 */

async function alertsCommand(options = {}) {
  console.log('🔔 System Alerts\n');

  // Demo alerts data
  const alerts = [
    {
      id: 1,
      timestamp: '2024-01-15 10:45:32',
      severity: 'error',
      type: 'high_loss',
      message: 'Strategy momentum-1 has exceeded daily loss limit (-$1,500)',
      acknowledged: false
    },
    {
      id: 2,
      timestamp: '2024-01-15 10:30:15',
      severity: 'warning',
      type: 'high_drawdown',
      message: 'Strategy pairs-trading-1 current drawdown: -12.5%',
      acknowledged: false
    },
    {
      id: 3,
      timestamp: '2024-01-15 10:15:48',
      severity: 'warning',
      type: 'high_cpu',
      message: 'High CPU usage detected: 85%',
      acknowledged: true
    },
    {
      id: 4,
      timestamp: '2024-01-15 09:45:23',
      severity: 'info',
      type: 'strategy_started',
      message: 'Strategy momentum-1 started successfully',
      acknowledged: true
    }
  ];

  const severityIcons = {
    error: '❌',
    warning: '⚠️ ',
    info: 'ℹ️ '
  };

  const severityColors = {
    error: '\x1b[31m',
    warning: '\x1b[33m',
    info: '\x1b[36m'
  };

  // Filter options
  const showAcknowledged = options.all || false;
  const severityFilter = options.severity;

  let filteredAlerts = alerts;
  if (!showAcknowledged) {
    filteredAlerts = filteredAlerts.filter(a => !a.acknowledged);
  }
  if (severityFilter) {
    filteredAlerts = filteredAlerts.filter(a => a.severity === severityFilter);
  }

  if (filteredAlerts.length === 0) {
    console.log('\x1b[32m✓ No alerts to display\x1b[0m');
    console.log('');
    return;
  }

  // Display alerts
  filteredAlerts.forEach(alert => {
    const icon = severityIcons[alert.severity] || 'ℹ️';
    const color = severityColors[alert.severity] || '\x1b[0m';
    const ackStatus = alert.acknowledged ? ' \x1b[90m[Acknowledged]\x1b[0m' : '';

    console.log(`${color}${icon} [${alert.timestamp}] ${alert.message}${ackStatus}\x1b[0m`);
  });

  console.log('');
  console.log(`📊 Summary: ${filteredAlerts.length} alert(s) displayed`);

  const unacknowledged = alerts.filter(a => !a.acknowledged).length;
  if (unacknowledged > 0) {
    console.log(`⚠️  ${unacknowledged} unacknowledged alert(s)`);
  }

  console.log('');
  console.log('Options:');
  console.log('  --all         Show all alerts (including acknowledged)');
  console.log('  --severity    Filter by severity (error, warning, info)');
  console.log('');
}

module.exports = alertsCommand;

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    all: args.includes('--all'),
    severity: args.find(arg => arg.startsWith('--severity='))?.split('=')[1]
  };

  alertsCommand(options).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
