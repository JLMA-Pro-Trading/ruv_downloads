const React = require('react');
const { Box, Text } = require('ink');

/**
 * Recent Trades Panel
 * Displays recent trade executions
 */
const TradesPanel = ({ trades = [] }) => {
  if (trades.length === 0) {
    return (
      <Box borderStyle="round" borderColor="gray" padding={1}>
        <Text color="gray">No recent trades</Text>
      </Box>
    );
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column">
      <Text bold color="blue">
        🔄 Recent Trades
      </Text>
      <Box marginTop={1} flexDirection="column">
        {/* Header */}
        <Box>
          <Text bold>
            {'Time'.padEnd(12)}
            {'Symbol'.padEnd(8)}
            {'Side'.padEnd(6)}
            {'Qty'.padStart(6)}
            {'Price'.padStart(10)}
            {'P&L'.padStart(10)}
          </Text>
        </Box>
        {/* Trades */}
        {trades.slice(0, 5).map((trade, idx) => {
          const sideColor = trade.side === 'BUY' ? 'green' : 'red';
          const pnl = trade.pnl || 0;
          const pnlColor = pnl >= 0 ? 'green' : 'red';
          const pnlSign = pnl >= 0 ? '+' : '';

          return (
            <Box key={idx}>
              <Text color="gray">{formatTime(trade.timestamp).padEnd(12)}</Text>
              <Text>{trade.symbol.padEnd(8)}</Text>
              <Text color={sideColor}>{trade.side.padEnd(6)}</Text>
              <Text>{String(trade.quantity).padStart(6)}</Text>
              <Text>{'$' + trade.price.toFixed(2).padStart(9)}</Text>
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

module.exports = TradesPanel;
