/**
 * Agent Stop Command - Stop running agent
 */

async function stopCommand(agentId) {
  if (!agentId) {
    console.error('❌ Agent ID required');
    console.error('Usage: neural-trader agent stop <id>');
    process.exit(1);
  }

  console.log(`\n🛑 Stopping agent: ${agentId}...\n`);

  try {
    const orchestrator = global.__agentOrchestrator;

    if (!orchestrator) {
      console.error('❌ No agents running (orchestrator not initialized)\n');
      process.exit(1);
    }

    const agent = await orchestrator.agentManager.stop(agentId);

    console.log(`✅ Agent stopped successfully!`);
    console.log(`\nAgent: ${agent.name} (${agent.id})`);
    console.log(`Status: ${agent.status}`);
    console.log(`Runtime: ${formatUptime(Math.floor((agent.stopped - agent.started) / 1000))}`);
    console.log(`Tasks completed: ${agent.metrics.tasksCompleted}`);
    console.log('');

  } catch (error) {
    console.error(`\n❌ Failed to stop agent: ${error.message}\n`);
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

module.exports = { stopCommand };
