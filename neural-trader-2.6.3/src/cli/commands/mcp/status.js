/**
 * MCP Status Command
 * Show MCP server status with live updates
 */

const { McpManager } = require('../../lib/mcp-manager');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

async function statusCommand(options = {}) {
  const manager = new McpManager();
  const { watch = false, interval = 5000 } = options;

  const displayStatus = async () => {
    // Clear screen if watching
    if (watch) {
      console.clear();
    }

    console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.cyan}${c.bright}     Neural Trader MCP Server Status${c.reset}`);
    console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}\n`);

    try {
      const status = await manager.getStatus();
      const health = await manager.healthCheck();

      // Server Status
      console.log(`${c.blue}${c.bright}Server Status:${c.reset}`);
      if (status.running) {
        console.log(`  Status: ${c.green}${c.bright}● RUNNING${c.reset}`);
        console.log(`  PID: ${c.bright}${status.pid}${c.reset}`);

        if (status.uptime) {
          console.log(`  Uptime: ${c.bright}${status.uptime}${c.reset}`);
        }

        console.log('');

        // Resource Usage
        console.log(`${c.blue}${c.bright}Resource Usage:${c.reset}`);
        if (status.memory !== null) {
          const memColor = status.memory > 500 ? c.yellow : c.green;
          console.log(`  Memory: ${memColor}${c.bright}${status.memory.toFixed(2)} MB${c.reset}`);
        }
        if (status.cpu !== null) {
          const cpuColor = status.cpu > 80 ? c.red : status.cpu > 50 ? c.yellow : c.green;
          console.log(`  CPU: ${cpuColor}${c.bright}${status.cpu.toFixed(1)}%${c.reset}`);
        }

        console.log('');

        // Health Check
        console.log(`${c.blue}${c.bright}Health Check:${c.reset}`);
        const healthStatus = health.healthy ? `${c.green}✓ Healthy${c.reset}` : `${c.red}✗ Unhealthy${c.reset}`;
        console.log(`  Overall: ${healthStatus}`);
        console.log(`  Process: ${health.checks.process ? c.green + '✓' : c.red + '✗'}${c.reset}`);
        console.log(`  Memory: ${health.checks.memory ? c.green + '✓' : c.yellow + '~'}${c.reset}`);
        console.log(`  Responsive: ${health.checks.responsive ? c.green + '✓' : c.red + '✗'}${c.reset}`);

      } else {
        console.log(`  Status: ${c.red}${c.bright}○ STOPPED${c.reset}`);
      }

      console.log('');

      // Log File
      if (status.logFile) {
        console.log(`${c.blue}${c.bright}Logs:${c.reset}`);
        console.log(`  File: ${c.dim}${status.logFile}${c.reset}`);
        console.log(`  View: ${c.bright}tail -f ${status.logFile}${c.reset}`);
      }

      console.log('');

      // Commands
      if (!watch) {
        console.log(`${c.blue}${c.bright}Available Commands:${c.reset}`);
        if (status.running) {
          console.log(`  ${c.bright}neural-trader mcp stop${c.reset}     - Stop the server`);
          console.log(`  ${c.bright}neural-trader mcp restart${c.reset}  - Restart the server`);
          console.log(`  ${c.bright}neural-trader mcp tools${c.reset}    - List available tools`);
        } else {
          console.log(`  ${c.bright}neural-trader mcp start${c.reset}    - Start the server`);
        }
        console.log('');
      } else {
        console.log(`${c.dim}Watching... (Ctrl+C to exit)${c.reset}`);
        console.log(`${c.dim}Updated: ${new Date().toLocaleTimeString()}${c.reset}`);
      }

    } catch (error) {
      console.error(`${c.red}✗ Error getting server status:${c.reset}`);
      console.error(`  ${error.message}`);
    }
  };

  // Initial display
  await displayStatus();

  // Watch mode
  if (watch) {
    const intervalId = setInterval(displayStatus, interval);

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      clearInterval(intervalId);
      console.log(`\n${c.yellow}Stopped watching${c.reset}\n`);
      process.exit(0);
    });
  }
}

module.exports = { statusCommand };
