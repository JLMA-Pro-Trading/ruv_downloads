/**
 * Agent Command - Multi-agent coordination system
 * Main entry point for all agent-related commands
 */

const { spawnCommand } = require('./spawn');
const { listCommand } = require('./list');
const { statusCommand } = require('./status');
const { logsCommand } = require('./logs');
const { stopCommand } = require('./stop');
const { stopAllCommand } = require('./stopall');
const { coordinateCommand } = require('./coordinate');
const { swarmCommand } = require('./swarm');

async function agentCommand(subcommand, ...args) {
  if (!subcommand) {
    showHelp();
    return;
  }

  const commands = {
    spawn: spawnCommand,
    list: listCommand,
    status: statusCommand,
    logs: logsCommand,
    stop: stopCommand,
    stopall: stopAllCommand,
    coordinate: coordinateCommand,
    swarm: swarmCommand,
    help: showHelp
  };

  const command = commands[subcommand];

  if (!command) {
    console.error(`❌ Unknown agent subcommand: ${subcommand}`);
    console.error('Run "neural-trader agent help" for usage information\n');
    process.exit(1);
  }

  try {
    await command(...args);
  } catch (error) {
    console.error(`\n❌ Command failed: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║          Neural Trader - Multi-Agent Coordination System              ║
║     Swarm Intelligence for Algorithmic Trading Strategies             ║
╚═══════════════════════════════════════════════════════════════════════╝

USAGE:
  neural-trader agent <command> [options]

COMMANDS:
  spawn <type> [options]       Spawn a new trading agent
  list [options]               List all running agents
  status <id>                  Get detailed agent status
  logs <id> [options]          View agent logs
  stop <id>                    Stop a specific agent
  stopall [--force]            Stop all running agents
  coordinate [--watch]         Launch coordination dashboard
  swarm <strategy> [options]   Deploy multi-agent swarm

AGENT TYPES:
  Trading Agents:
    momentum              Momentum trading strategy
    pairs-trading         Statistical arbitrage pairs trading
    mean-reversion        Mean reversion strategy
    news-trader           News sentiment trading
    market-maker          Market making and liquidity provision

  Portfolio & Risk:
    portfolio             Portfolio optimization agent
    risk-manager          Risk management and monitoring

SWARM STRATEGIES:
    multi-strategy        Coordinates multiple trading strategies
    adaptive-portfolio    Self-optimizing portfolio with risk mgmt
    high-frequency        Ultra-fast trading with market making
    risk-aware            Conservative trading with risk controls

EXAMPLES:
  # Spawn a single agent
  neural-trader agent spawn momentum

  # Deploy a multi-agent swarm
  neural-trader agent swarm multi-strategy

  # View all running agents
  neural-trader agent list

  # Monitor coordination in real-time
  neural-trader agent coordinate

  # View agent details
  neural-trader agent status momentum-1234567890-abc123

  # Stop specific agent
  neural-trader agent stop momentum-1234567890-abc123

  # Stop all agents
  neural-trader agent stopall --force

FEATURES:
  ✓ Inter-agent communication
  ✓ Resource allocation & load balancing
  ✓ Consensus decision making
  ✓ Performance monitoring
  ✓ Auto-scaling based on load
  ✓ Fault tolerance with auto-restart
  ✓ Health monitoring
  ✓ Real-time coordination dashboard

INTEGRATION:
  • Integrates with agentic-flow package
  • Uses AgentDB for state persistence
  • Connects to MCP tools for operations
  • Supports swarm coordination from neural-trader-rust

For more information, visit:
https://github.com/ruvnet/neural-trader
`);
}

module.exports = { agentCommand };
