/**
 * Agent Coordinate Command - Real-time coordination dashboard
 * Terminal-based UI for monitoring multi-agent coordination
 */

async function coordinateCommand(options = {}) {
  console.log('\n🎛️  Agent Coordination Dashboard\n');
  console.log('─'.repeat(80));

  try {
    const orchestrator = global.__agentOrchestrator;

    if (!orchestrator) {
      console.log('No agents running (orchestrator not initialized)\n');
      console.log('Start agents with: neural-trader agent spawn <type>');
      console.log('Or deploy a swarm: neural-trader agent swarm <strategy>\n');
      return;
    }

    // Get all agents
    const agents = orchestrator.agentManager.list();
    const swarms = orchestrator.listSwarms();
    const coordinatorStats = orchestrator.coordinator.getStats();

    // Display swarms
    if (swarms.length > 0) {
      console.log('\n📦 Active Swarms:');
      console.log('─'.repeat(80));

      for (const swarm of swarms) {
        const statusIcon = {
          running: '🟢',
          deploying: '🟡',
          stopping: '🟡',
          stopped: '🔴',
          failed: '❌'
        }[swarm.status] || '⚪';

        console.log(`\n  ${statusIcon} ${swarm.name} (${swarm.id})`);
        console.log(`     Strategy: ${swarm.strategy}`);
        console.log(`     Status: ${swarm.status}`);
        console.log(`     Agents: ${swarm.agentCount}`);
        console.log(`     Uptime: ${formatUptime(Math.floor((Date.now() - swarm.created) / 1000))}`);
      }
    }

    // Display agents
    if (agents.length > 0) {
      console.log('\n\n🤖 Active Agents:');
      console.log('─'.repeat(80));

      // Group by status
      const byStatus = agents.reduce((acc, agent) => {
        if (!acc[agent.status]) {
          acc[agent.status] = [];
        }
        acc[agent.status].push(agent);
        return acc;
      }, {});

      for (const [status, statusAgents] of Object.entries(byStatus)) {
        const statusIcon = {
          running: '🟢',
          stopped: '🔴',
          starting: '🟡',
          stopping: '🟡',
          failed: '❌'
        }[status] || '⚪';

        console.log(`\n  ${statusIcon} ${status.toUpperCase()} (${statusAgents.length})`);

        for (const agent of statusAgents.slice(0, 5)) { // Show max 5 per status
          const healthIcon = agent.health === 'healthy' ? '✓' : '✗';
          const uptime = agent.started
            ? Math.floor((Date.now() - agent.started) / 1000)
            : 0;

          console.log(`     • ${agent.type}: ${agent.id.slice(0, 20)}...`);
          console.log(`       Health: ${healthIcon} | Uptime: ${formatUptime(uptime)} | Tasks: ${agent.metrics.tasksCompleted}`);
        }

        if (statusAgents.length > 5) {
          console.log(`     ... and ${statusAgents.length - 5} more`);
        }
      }
    }

    // Display coordination stats
    console.log('\n\n📊 Coordination Statistics:');
    console.log('─'.repeat(80));
    console.log(`  Total Agents: ${coordinatorStats.agents}`);
    console.log(`  Communication Channels: ${coordinatorStats.channels}`);
    console.log(`  Total Messages: ${coordinatorStats.totalMessages}`);
    console.log(`  Active Consensus: ${coordinatorStats.activeConsensus}`);

    // Agent distribution
    const typeDistribution = agents.reduce((acc, agent) => {
      acc[agent.type] = (acc[agent.type] || 0) + 1;
      return acc;
    }, {});

    if (Object.keys(typeDistribution).length > 0) {
      console.log('\n\n📈 Agent Type Distribution:');
      console.log('─'.repeat(80));
      for (const [type, count] of Object.entries(typeDistribution)) {
        const bar = '█'.repeat(Math.min(count * 2, 40));
        console.log(`  ${type.padEnd(20)} ${bar} ${count}`);
      }
    }

    // Performance summary
    const totalTasks = agents.reduce((sum, a) => sum + a.metrics.tasksCompleted, 0);
    const totalErrors = agents.reduce((sum, a) => sum + a.metrics.tasksFailedError, 0);
    const successRate = totalTasks + totalErrors > 0
      ? ((totalTasks / (totalTasks + totalErrors)) * 100).toFixed(1)
      : 0;

    console.log('\n\n📉 Performance Summary:');
    console.log('─'.repeat(80));
    console.log(`  Total Tasks Completed: ${totalTasks}`);
    console.log(`  Total Errors: ${totalErrors}`);
    console.log(`  Success Rate: ${successRate}%`);

    // Recent activity
    const recentAgents = agents
      .filter(a => a.status === 'running')
      .sort((a, b) => b.metrics.lastActivity - a.metrics.lastActivity)
      .slice(0, 5);

    if (recentAgents.length > 0) {
      console.log('\n\n🕐 Recent Activity:');
      console.log('─'.repeat(80));
      for (const agent of recentAgents) {
        const timeSinceActivity = Date.now() - agent.metrics.lastActivity;
        console.log(`  ${agent.type} (${agent.id.slice(0, 16)}...): ${formatDuration(timeSinceActivity)} ago`);
      }
    }

    // Commands
    console.log('\n\n📝 Available Commands:');
    console.log('─'.repeat(80));
    console.log('  neural-trader agent list              - List all agents');
    console.log('  neural-trader agent status <id>       - View agent details');
    console.log('  neural-trader agent logs <id>         - View agent logs');
    console.log('  neural-trader agent stop <id>         - Stop specific agent');
    console.log('  neural-trader agent stopall --force   - Stop all agents');
    console.log('  neural-trader agent swarm <strategy>  - Deploy swarm');

    console.log('\n─'.repeat(80));
    console.log('\n💡 Tip: Run this command with --watch for live updates\n');

    // Watch mode (future enhancement)
    if (options.watch) {
      console.log('⏱️  Watch mode not yet implemented. Coming soon!\n');
    }

  } catch (error) {
    console.error(`\n❌ Error displaying dashboard: ${error.message}\n`);
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
    return `${Math.floor(seconds / 60)}m`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
}

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${Math.floor(ms / 1000)}s`;
  } else if (ms < 3600000) {
    return `${Math.floor(ms / 60000)}m`;
  } else {
    return `${Math.floor(ms / 3600000)}h`;
  }
}

module.exports = { coordinateCommand };
