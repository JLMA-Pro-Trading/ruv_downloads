/**
 * Agent List Command - List all running agents
 */

async function listCommand(options = {}) {
  console.log(`\n📋 Running Agents:\n`);

  try {
    const orchestrator = global.__agentOrchestrator;

    if (!orchestrator) {
      console.log('No agents running (orchestrator not initialized)\n');
      return;
    }

    // Get filter
    const filter = {};
    if (options.type) {
      filter.type = options.type;
    }
    if (options.status) {
      filter.status = options.status;
    }

    const agents = orchestrator.agentManager.list(filter);

    if (agents.length === 0) {
      console.log('No agents found\n');
      return;
    }

    // Group by type
    const byType = agents.reduce((acc, agent) => {
      if (!acc[agent.type]) {
        acc[agent.type] = [];
      }
      acc[agent.type].push(agent);
      return acc;
    }, {});

    // Display
    for (const [type, typeAgents] of Object.entries(byType)) {
      console.log(`\n${type.toUpperCase()} (${typeAgents.length}):`);
      console.log('─'.repeat(60));

      for (const agent of typeAgents) {
        const uptime = agent.started
          ? Math.floor((Date.now() - agent.started) / 1000)
          : 0;

        const statusIcon = {
          running: '🟢',
          stopped: '🔴',
          starting: '🟡',
          stopping: '🟡',
          failed: '❌'
        }[agent.status] || '⚪';

        const healthIcon = {
          healthy: '✓',
          unhealthy: '✗'
        }[agent.health] || '?';

        console.log(`  ${statusIcon} ${agent.id.slice(0, 24)}`);
        console.log(`     Name: ${agent.name}`);
        console.log(`     Status: ${agent.status} | Health: ${healthIcon} ${agent.health}`);
        console.log(`     Uptime: ${formatUptime(uptime)} | Restarts: ${agent.restarts}`);
        console.log(`     Tasks: ${agent.metrics.tasksCompleted} completed, ${agent.metrics.tasksFailedError} failed`);
        console.log('');
      }
    }

    // Summary
    console.log('─'.repeat(60));
    console.log(`Total: ${agents.length} agents`);
    console.log('');

    // Display by status
    const statusCounts = agents.reduce((acc, agent) => {
      acc[agent.status] = (acc[agent.status] || 0) + 1;
      return acc;
    }, {});

    console.log('Status Distribution:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`  ${status}: ${count}`);
    }
    console.log('');

  } catch (error) {
    console.error(`\n❌ Failed to list agents: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function formatUptime(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

module.exports = { listCommand };
