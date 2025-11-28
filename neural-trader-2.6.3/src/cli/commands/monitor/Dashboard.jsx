const React = require('react');
const { Box, Text, useInput, useApp } = require('ink');

const StrategyPanel = require('./components/StrategyPanel');
const PositionsPanel = require('./components/PositionsPanel');
const PnLPanel = require('./components/PnLPanel');
const TradesPanel = require('./components/TradesPanel');
const MetricsPanel = require('./components/MetricsPanel');
const SystemPanel = require('./components/SystemPanel');
const AlertsPanel = require('./components/AlertsPanel');

/**
 * Main Monitoring Dashboard Component
 * Real-time monitoring dashboard for trading strategies
 */
const Dashboard = ({ strategyMonitor, alertManager, initialStrategy }) => {
  const { exit } = useApp();
  const [strategy, setStrategy] = React.useState(initialStrategy);
  const [alerts, setAlerts] = React.useState([]);
  const [lastUpdate, setLastUpdate] = React.useState(Date.now());
  const [showHelp, setShowHelp] = React.useState(false);

  // Setup event listeners
  React.useEffect(() => {
    const updateHandler = (updatedStrategy) => {
      if (!initialStrategy || updatedStrategy.id === initialStrategy.id) {
        setStrategy(updatedStrategy);
        setLastUpdate(Date.now());

        // Check alert rules
        const newAlerts = alertManager.checkRules(updatedStrategy);
        if (newAlerts.length > 0) {
          setAlerts(alertManager.getAlerts());
        }
      }
    };

    const alertHandler = () => {
      setAlerts(alertManager.getAlerts());
    };

    strategyMonitor.on('strategyUpdated', updateHandler);
    alertManager.on('alert', alertHandler);

    // Setup default alert rules
    alertManager.setupDefaultRules();

    return () => {
      strategyMonitor.off('strategyUpdated', updateHandler);
      alertManager.off('alert', alertHandler);
    };
  }, [strategyMonitor, alertManager, initialStrategy]);

  // Keyboard shortcuts
  useInput((input, key) => {
    if (input === 'q') {
      exit();
    } else if (input === 'h') {
      setShowHelp(!showHelp);
    } else if (input === 'r') {
      // Force refresh
      if (strategy) {
        strategyMonitor.updateStrategy(strategy.id);
      }
    } else if (input === 'c') {
      // Clear acknowledged alerts
      alertManager.clearAcknowledged();
      setAlerts(alertManager.getAlerts());
    }
  });

  if (showHelp) {
    return (
      <Box padding={1} flexDirection="column">
        <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
          <Text bold color="cyan">
            📖 Keyboard Shortcuts
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text color="yellow">q</Text> - Quit dashboard
            </Text>
            <Text>
              <Text color="yellow">h</Text> - Toggle help
            </Text>
            <Text>
              <Text color="yellow">r</Text> - Force refresh
            </Text>
            <Text>
              <Text color="yellow">c</Text> - Clear acknowledged alerts
            </Text>
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Press 'h' to return to dashboard</Text>
        </Box>
      </Box>
    );
  }

  if (!strategy) {
    return (
      <Box padding={1} flexDirection="column">
        <Text bold color="red">
          No strategy found
        </Text>
        <Text color="gray">Press 'q' to quit</Text>
      </Box>
    );
  }

  return (
    <Box padding={1} flexDirection="column">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ⚡ Neural Trader - Real-Time Monitoring Dashboard
        </Text>
      </Box>

      {/* Top row: Strategy Status and P&L */}
      <Box marginBottom={1}>
        <Box width="50%" marginRight={1}>
          <StrategyPanel strategy={strategy} />
        </Box>
        <Box width="50%">
          <PnLPanel metrics={strategy.metrics} />
        </Box>
      </Box>

      {/* Middle row: Positions and Trades */}
      <Box marginBottom={1}>
        <Box width="50%" marginRight={1}>
          <PositionsPanel positions={strategy.positions} />
        </Box>
        <Box width="50%">
          <TradesPanel trades={strategy.recentTrades} />
        </Box>
      </Box>

      {/* Bottom row: Metrics and System */}
      <Box marginBottom={1}>
        <Box width="50%" marginRight={1}>
          <MetricsPanel metrics={strategy.metrics} />
        </Box>
        <Box width="50%">
          <SystemPanel systemMetrics={strategy.systemMetrics} />
        </Box>
      </Box>

      {/* Alerts Panel */}
      <Box marginBottom={1}>
        <AlertsPanel alerts={alerts} />
      </Box>

      {/* Footer */}
      <Box justifyContent="space-between">
        <Text color="gray">
          Last updated: {new Date(lastUpdate).toLocaleTimeString()}
        </Text>
        <Text color="gray">Press 'h' for help, 'q' to quit</Text>
      </Box>
    </Box>
  );
};

module.exports = Dashboard;
