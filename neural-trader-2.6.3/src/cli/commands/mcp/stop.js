/**
 * MCP Stop Command
 * Stop the MCP server
 */

const { McpManager } = require('../../lib/mcp-manager');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

async function stopCommand() {
  const manager = new McpManager();

  console.log(`${c.blue}${c.bright}Stopping Neural Trader MCP Server...${c.reset}\n`);

  try {
    const result = await manager.stop();

    if (result.success) {
      console.log(`${c.green}✓ ${result.message}${c.reset}\n`);
    }
  } catch (error) {
    console.error(`${c.red}✗ Failed to stop MCP server:${c.reset}`);
    console.error(`  ${error.message}`);
    console.error('');

    if (error.message.includes('not running')) {
      console.log(`${c.yellow}Tip: Use 'neural-trader mcp status' to check server status${c.reset}`);
    }

    process.exit(1);
  }
}

module.exports = { stopCommand };
