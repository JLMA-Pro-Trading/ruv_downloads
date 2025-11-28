const React = require('react');
const { Box, Text } = require('ink');

/**
 * Performance Metrics Panel
 * Displays performance metrics like Sharpe ratio, drawdown, etc.
 */
const MetricsPanel = ({ metrics = {} }) => {
  const sharpeRatio = metrics.sharpeRatio || 0;
  const maxDrawdown = metrics.maxDrawdown || 0;
  const currentDrawdown = metrics.currentDrawdown || 0;

  const sharpeColor = sharpeRatio >= 1.5 ? 'green' : sharpeRatio >= 1 ? 'yellow' : 'red';
  const drawdownColor = currentDrawdown > -0.05 ? 'green' : currentDrawdown > -0.1 ? 'yellow' : 'red';

  return (
    <Box borderStyle="round" borderColor="green" padding={1} flexDirection="column">
      <Text bold color="green">
        📊 Performance Metrics
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box justifyContent="space-between" width={40}>
          <Text>Sharpe Ratio:</Text>
          <Text bold color={sharpeColor}>
            {sharpeRatio.toFixed(2)}
          </Text>
        </Box>
        <Box justifyContent="space-between" width={40}>
          <Text>Max Drawdown:</Text>
          <Text color="red">
            {(maxDrawdown * 100).toFixed(2)}%
          </Text>
        </Box>
        <Box justifyContent="space-between" width={40}>
          <Text>Current Drawdown:</Text>
          <Text color={drawdownColor}>
            {(currentDrawdown * 100).toFixed(2)}%
          </Text>
        </Box>
        <Box justifyContent="space-between" width={40} marginTop={1}>
          <Text>Win Rate:</Text>
          <Text color="cyan">
            {((metrics.winRate || 0) * 100).toFixed(1)}%
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

module.exports = MetricsPanel;
