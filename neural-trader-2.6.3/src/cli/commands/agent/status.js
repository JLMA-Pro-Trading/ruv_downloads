/**
 * Agent Status Command - Get detailed agent status
 */

async function statusCommand(agentId) {
  if (!agentId) {
    console.error('❌ Agent ID required');
    console.error('Usage: neural-trader agent status <id>');
    process.exit(1);
  }

  console.log(`\n📊 Agent Status: ${agentId}\n`);

  try {
    const orchestrator = global.__agentOrchestrator;

    if (!orchestrator) {
      console.error('❌ No agents running (orchestrator not initialized)\n');
      process.exit(1);
    }

    const status = orchestrator.agentManager.getStatus(agentId);

    // Status display
    const statusIcon = {
      running: '🟢 RUNNING',
      stopped: '🔴 STOPPED',
      starting: '🟡 STARTING',
      stopping: '🟡 STOPPING',
      failed: '❌ FAILED'
    }[status.status] || '⚪ UNKNOWN';

    const healthIcon = {
      healthy: '✅',
      unhealthy: '⚠️'
    }[status.health] || '❓';

    console.log('Basic Information:');
    console.log('─'.repeat(60));
    console.log(`  ID: ${status.id}`);
    console.log(`  Name: ${status.name}`);
    console.log(`  Type: ${status.type}`);
    console.log(`  Status: ${statusIcon}`);
    console.log(`  Health: ${healthIcon} ${status.health.toUpperCase()}`);
    console.log(`  State: ${status.state}`);
    console.log('');

    // Uptime
    console.log('Runtime:');
    console.log('─'.repeat(60));
    console.log(`  Uptime: ${formatUptime(Math.floor(status.uptime / 1000))}`);
    console.log(`  Restarts: ${status.restarts}`);
    console.log('');

    // Metrics
    console.log('Performance Metrics:');
    console.log('─'.repeat(60));
    console.log(`  Tasks Completed: ${status.metrics.tasksCompleted}`);
    console.log(`  Tasks Failed: ${status.metrics.tasksFailedError}`);

    const successRate = status.metrics.tasksCompleted + status.metrics.tasksFailedError > 0
      ? ((status.metrics.tasksCompleted / (status.metrics.tasksCompleted + status.metrics.tasksFailedError)) * 100).toFixed(1)
      : 0;
    console.log(`  Success Rate: ${successRate}%`);

    console.log(`  CPU Time: ${status.metrics.cpuTime.toFixed(2)}ms`);
    console.log(`  Memory Usage: ${formatBytes(status.metrics.memoryUsage)}`);

    const timeSinceActivity = Date.now() - status.metrics.lastActivity;
    console.log(`  Last Activity: ${formatDuration(timeSinceActivity)} ago`);
    console.log('');

    // Last error
    if (status.lastError) {
      console.log('Last Error:');
      console.log('─'.repeat(60));
      console.log(`  Time: ${new Date(status.lastError.timestamp).toLocaleString()}`);
      console.log(`  Message: ${status.lastError.error}`);
      console.log('');
    }

    // Commands
    console.log('Available Commands:');
    console.log('─'.repeat(60));
    console.log(`  View logs: neural-trader agent logs ${agentId}`);
    console.log(`  Stop agent: neural-trader agent stop ${agentId}`);
    console.log('');

  } catch (error) {
    console.error(`\n❌ Failed to get agent status: ${error.message}\n`);
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

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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

module.exports = { statusCommand };
