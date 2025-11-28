/**
 * MCP Restart Command
 * Restart the MCP server
 */

const { McpManager } = require('../../lib/mcp-manager');
const { McpConfig } = require('../../lib/mcp-config');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

async function restartCommand(options = {}) {
  const manager = new McpManager();
  const configManager = new McpConfig();
  const config = configManager.load();

  console.log(`${c.blue}${c.bright}Restarting Neural Trader MCP Server...${c.reset}\n`);

  try {
    const startOptions = {
      transport: options.transport || config.transport,
      port: options.port || config.port,
      stubMode: options.stubMode || false,
      daemon: options.daemon !== false
    };

    const result = await manager.restart(startOptions);

    if (result.success) {
      console.log(`${c.green}✓ MCP server restarted successfully!${c.reset}\n`);
      console.log(`${c.blue}Server Details:${c.reset}`);
      console.log(`  PID: ${c.bright}${result.pid}${c.reset}`);
      console.log(`  Transport: ${c.bright}${result.transport}${c.reset}`);
      if (result.port) {
        console.log(`  Port: ${c.bright}${result.port}${c.reset}`);
      }
      console.log('');
    }
  } catch (error) {
    console.error(`${c.red}✗ Failed to restart MCP server:${c.reset}`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

module.exports = { restartCommand };
