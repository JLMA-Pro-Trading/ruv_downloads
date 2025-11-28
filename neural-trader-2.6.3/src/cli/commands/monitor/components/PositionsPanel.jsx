const React = require('react');
const { Box, Text } = require('ink');

/**
 * Positions Panel
 * Displays current positions
 */
const PositionsPanel = ({ positions = [] }) => {
  if (positions.length === 0) {
    return (
      <Box borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">No open positions</Text>
      </Box>
    );
  }

  return (
    <Box borderStyle="round" borderColor="magenta" padding={1} flexDirection="column">
      <Text bold color="magenta">
        📈 Current Positions
      </Text>
      <Box marginTop={1} flexDirection="column">
        {/* Header */}
        <Box>
          <Text bold>
            {'Symbol'.padEnd(8)}
            {'Qty'.padStart(6)}
            {'Entry'.padStart(10)}
            {'Current'.padStart(10)}
            {'P&L'.padStart(10)}
          </Text>
        </Box>
        {/* Positions */}
        {positions.map((pos, idx) => {
          const pnl = pos.unrealizedPnL || 0;
          const pnlColor = pnl >= 0 ? 'green' : 'red';
          const pnlSign = pnl >= 0 ? '+' : '';

          return (
            <Box key={idx}>
              <Text>
                {pos.symbol.padEnd(8)}
                {String(pos.quantity).padStart(6)}
                {'$' + pos.entryPrice.toFixed(2).padStart(9)}
                {'$' + pos.currentPrice.toFixed(2).padStart(9)}
              </Text>
              <Text color={pnlColor}>
                {' ' + pnlSign + pnl.toFixed(2).padStart(9)}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

module.exports = PositionsPanel;
