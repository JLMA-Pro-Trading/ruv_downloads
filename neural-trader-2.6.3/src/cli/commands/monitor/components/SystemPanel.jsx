const React = require('react');
const { Box, Text } = require('ink');

/**
 * System Resources Panel
 * Displays CPU, memory, and network metrics
 */
const SystemPanel = ({ systemMetrics = {} }) => {
  const cpu = systemMetrics.cpu || 0;
  const memory = systemMetrics.memory || 0;
  const networkLatency = systemMetrics.networkLatency || 0;

  const cpuColor = cpu > 80 ? 'red' : cpu > 60 ? 'yellow' : 'green';
  const memColor = memory > 80 ? 'red' : memory > 60 ? 'yellow' : 'green';
  const netColor = networkLatency > 50 ? 'red' : networkLatency > 30 ? 'yellow' : 'green';

  const getBar = (value, maxValue = 100) => {
    const barLength = 20;
    const filled = Math.floor((value / maxValue) * barLength);
    return '█'.repeat(filled) + '░'.repeat(barLength - filled);
  };

  return (
    <Box borderStyle="round" borderColor="cyan" padding={1} flexDirection="column">
      <Text bold color="cyan">
        💻 System Resources
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Box flexDirection="column">
          <Box>
            <Text>CPU: </Text>
            <Text color={cpuColor}>{cpu.toFixed(1)}%</Text>
          </Box>
          <Box>
            <Text color={cpuColor}>{getBar(cpu)}</Text>
          </Box>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text>Memory: </Text>
            <Text color={memColor}>{memory.toFixed(1)}%</Text>
          </Box>
          <Box>
            <Text color={memColor}>{getBar(memory)}</Text>
          </Box>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text>Network Latency: </Text>
            <Text color={netColor}>{networkLatency.toFixed(1)}ms</Text>
          </Box>
          <Box>
            <Text color={netColor}>{getBar(networkLatency, 100)}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

module.exports = SystemPanel;
