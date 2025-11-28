/**
 * MCP Start Command
 * Start the MCP server
 */

const { McpManager } = require('../../lib/mcp-manager');
const { McpConfig } = require('../../lib/mcp-config');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

async function startCommand(options = {}) {
  const manager = new McpManager();
  const configManager = new McpConfig();
  const config = configManager.load();

  console.log(`${c.blue}${c.bright}Starting Neural Trader MCP Server...${c.reset}\n`);

  try {
    // Merge config with command-line options
    const startOptions = {
      transport: options.transport || config.transport,
      port: options.port || config.port,
      stubMode: options.stubMode || false,
      daemon: options.daemon !== false // Default to daemon mode
    };

    console.log(`${c.blue}Configuration:${c.reset}`);
    console.log(`  Transport: ${c.bright}${startOptions.transport}${c.reset}`);
    if (startOptions.transport === 'http') {
      console.log(`  Port: ${c.bright}${startOptions.port}${c.reset}`);
    }
    console.log(`  Daemon: ${c.bright}${startOptions.daemon ? 'yes' : 'no'}${c.reset}`);
    if (startOptions.stubMode) {
      console.log(`  ${c.yellow}Stub Mode: enabled${c.reset}`);
    }
    console.log('');

    const result = await manager.start(startOptions);

    if (result.success) {
      console.log(`${c.green}✓ MCP server started successfully!${c.reset}\n`);
      console.log(`${c.blue}Server Details:${c.reset}`);
      console.log(`  PID: ${c.bright}${result.pid}${c.reset}`);
      console.log(`  Transport: ${c.bright}${result.transport}${c.reset}`);
      if (result.port) {
        console.log(`  Port: ${c.bright}${result.port}${c.reset}`);
        console.log(`  URL: ${c.bright}http://localhost:${result.port}${c.reset}`);
      }
      if (result.logFile) {
        console.log(`  Logs: ${c.bright}${result.logFile}${c.reset}`);
      }
      console.log('');
      console.log(`${c.blue}Available Commands:${c.reset}`);
      console.log(`  ${c.bright}neural-trader mcp status${c.reset}  - Check server status`);
      console.log(`  ${c.bright}neural-trader mcp tools${c.reset}   - List available tools`);
      console.log(`  ${c.bright}neural-trader mcp stop${c.reset}    - Stop the server`);
      console.log('');
    }
  } catch (error) {
    console.error(`${c.red}✗ Failed to start MCP server:${c.reset}`);
    console.error(`  ${error.message}`);
    console.error('');

    if (error.message.includes('already running')) {
      console.log(`${c.yellow}Tip: Use 'neural-trader mcp status' to check server status${c.reset}`);
      console.log(`${c.yellow}     Use 'neural-trader mcp restart' to restart the server${c.reset}`);
    }

    process.exit(1);
  }
}

module.exports = { startCommand };
