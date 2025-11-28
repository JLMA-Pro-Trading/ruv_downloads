const React = require('react');
const { Box, Text } = require('ink');

/**
 * Strategy Status Panel
 * Displays current status of a trading strategy
 */
const StrategyPanel = ({ strategy }) => {
  if (!strategy) {
    return (
      <Box borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">No strategy selected</Text>
      </Box>
    );
  }

  const statusColor = {
    running: 'green',
    stopped: 'yellow',
    error: 'red'
  }[strategy.status] || 'gray';

  const runtime = Math.floor((Date.now() - strategy.startTime) / 1000);
  const hours = Math.floor(runtime / 3600);
  const minutes = Math.floor((runtime % 3600) / 60);
  const seconds = runtime % 60;

  return (
    <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
      <Text bold color="cyan">
        📊 Strategy Status
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text>Name: </Text>
          <Text bold color="white">{strategy.name}</Text>
        </Box>
        <Box>
          <Text>Type: </Text>
          <Text color="gray">{strategy.type}</Text>
        </Box>
        <Box>
          <Text>Status: </Text>
          <Text bold color={statusColor}>
            {strategy.status.toUpperCase()}
          </Text>
        </Box>
        <Box>
          <Text>Runtime: </Text>
          <Text color="yellow">
            {hours}h {minutes}m {seconds}s
          </Text>
        </Box>
        {strategy.error && (
          <Box marginTop={1}>
            <Text color="red">⚠️  Error: {strategy.error}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};

module.exports = StrategyPanel;
