/**
 * Agent Stop All Command - Stop all running agents
 */

async function stopAllCommand(options = {}) {
  console.log(`\n🛑 Stopping all agents...\n`);

  try {
    const orchestrator = global.__agentOrchestrator;

    if (!orchestrator) {
      console.log('No agents running (orchestrator not initialized)\n');
      return;
    }

    const agents = orchestrator.agentManager.list();

    if (agents.length === 0) {
      console.log('No agents to stop\n');
      return;
    }

    console.log(`Found ${agents.length} running agents\n`);

    // Confirm if not forced
    if (!options.force) {
      console.log('⚠️  This will stop all running agents!');
      console.log('Use --force to skip this confirmation\n');

      // In a real implementation, would prompt for confirmation
      // For now, require --force flag
      console.log('Add --force flag to confirm\n');
      process.exit(1);
    }

    const results = await orchestrator.agentManager.stopAll();

    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;

    console.log(`✅ Stopped ${successful} agents`);
    if (failed > 0) {
      console.log(`❌ Failed to stop ${failed} agents`);

      if (options.verbose) {
        console.log('\nErrors:');
        results.filter(r => r.error).forEach(r => {
          console.log(`  ${r.id}: ${r.error.message}`);
        });
      }
    }
    console.log('');

  } catch (error) {
    console.error(`\n❌ Failed to stop agents: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { stopAllCommand };
