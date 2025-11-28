/**
 * Agent Logs Command - View agent logs
 */

async function logsCommand(agentId, options = {}) {
  if (!agentId) {
    console.error('❌ Agent ID required');
    console.error('Usage: neural-trader agent logs <id> [options]');
    process.exit(1);
  }

  console.log(`\n📜 Agent Logs: ${agentId}\n`);

  try {
    const orchestrator = global.__agentOrchestrator;

    if (!orchestrator) {
      console.error('❌ No agents running (orchestrator not initialized)\n');
      process.exit(1);
    }

    // Get options
    const limit = options.limit || 50;
    const level = options.level || 'all';

    const logs = orchestrator.agentManager.getLogs(agentId, { limit, level });

    if (logs.length === 0) {
      console.log('No logs found\n');
      return;
    }

    // Display logs
    console.log(`Showing last ${logs.length} log entries:\n`);
    console.log('─'.repeat(80));

    for (const log of logs) {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const levelIcon = {
        error: '❌',
        warn: '⚠️',
        info: 'ℹ️',
        debug: '🐛'
      }[log.level] || '📝';

      console.log(`[${timestamp}] ${levelIcon} ${log.level.toUpperCase()}`);
      console.log(`  ${log.message}`);

      if (options.verbose && log.stack) {
        console.log(`\n  Stack trace:`);
        console.log(`  ${log.stack.split('\n').join('\n  ')}`);
      }

      console.log('');
    }

    console.log('─'.repeat(80));
    console.log(`\nOptions:`);
    console.log(`  --limit <n>    Show last n entries (default: 50)`);
    console.log(`  --level <lvl>  Filter by level (error, warn, info, debug)`);
    console.log(`  --verbose      Show full stack traces`);
    console.log('');

  } catch (error) {
    console.error(`\n❌ Failed to get agent logs: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { logsCommand };
