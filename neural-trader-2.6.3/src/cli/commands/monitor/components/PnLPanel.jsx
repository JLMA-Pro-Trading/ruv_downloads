const React = require('react');
const { Box, Text } = require('ink');

/**
 * P&L Panel
 * Displays profit and loss metrics
 */
const PnLPanel = ({ metrics = {} }) => {
  const todayPnL = metrics.todayPnL || 0;
  const totalPnL = metrics.totalPnL || 0;
  const todayColor = todayPnL >= 0 ? 'green' : 'red';
  const totalColor = totalPnL >= 0 ? 'green' : 'red';
  const todaySign = todayPnL >= 0 ? '+' : '';
  const totalSign = totalPnL >= 0 ? '+' : '';

  return (
    <Box borderStyle="round" borderColor="yellow" padding={1} flexDirection="column">
      <Text bold color="yellow">
        💰 Profit & Loss
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box justifyContent="space-between" width={40}>
          <Text>Today P&L:</Text>
          <Text bold color={todayColor}>
            {todaySign}${todayPnL.toFixed(2)}
          </Text>
        </Box>
        <Box justifyContent="space-between" width={40}>
          <Text>Total P&L:</Text>
          <Text bold color={totalColor}>
            {totalSign}${totalPnL.toFixed(2)}
          </Text>
        </Box>
        <Box justifyContent="space-between" width={40} marginTop={1}>
          <Text>Total Trades:</Text>
          <Text color="white">{metrics.totalTrades || 0}</Text>
        </Box>
        <Box justifyContent="space-between" width={40}>
          <Text>Win Rate:</Text>
          <Text color="cyan">
            {((metrics.winRate || 0) * 100).toFixed(1)}%
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

module.exports = PnLPanel;
