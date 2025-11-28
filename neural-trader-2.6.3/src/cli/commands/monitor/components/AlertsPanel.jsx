const React = require('react');
const { Box, Text } = require('ink');

/**
 * Alerts Panel
 * Displays alerts and notifications
 */
const AlertsPanel = ({ alerts = [] }) => {
  if (alerts.length === 0) {
    return (
      <Box borderStyle="round" borderColor="gray" padding={1}>
        <Text color="green">✓ No alerts</Text>
      </Box>
    );
  }

  const severityIcon = {
    error: '❌',
    warning: '⚠️ ',
    info: 'ℹ️ '
  };

  const severityColor = {
    error: 'red',
    warning: 'yellow',
    info: 'cyan'
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <Box borderStyle="round" borderColor="red" padding={1} flexDirection="column">
      <Text bold color="red">
        🔔 Alerts ({alerts.filter(a => !a.acknowledged).length} unacknowledged)
      </Text>
      <Box marginTop={1} flexDirection="column">
        {alerts.slice(0, 5).map((alert, idx) => {
          const icon = severityIcon[alert.severity] || 'ℹ️';
          const color = severityColor[alert.severity] || 'gray';

          return (
            <Box key={idx} marginBottom={idx < 4 ? 0 : 0}>
              <Text color="gray">[{formatTime(alert.timestamp)}] </Text>
              <Text color={color}>
                {icon} {alert.message}
              </Text>
              {alert.acknowledged && <Text color="gray"> ✓</Text>}
            </Box>
          );
        })}
        {alerts.length > 5 && (
          <Text color="gray" marginTop={1}>
            ... and {alerts.length - 5} more
          </Text>
        )}
      </Box>
    </Box>
  );
};

module.exports = AlertsPanel;
