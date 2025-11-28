/**
 * Agent Spawn Command - Spawn new trading agent
 */

const { SwarmOrchestrator } = require('../../lib/swarm-orchestrator');
const { AgentRegistry } = require('../../lib/agent-registry');

const registry = new AgentRegistry();

async function spawnCommand(type, options = {}) {
  console.log(`\n🚀 Spawning ${type} agent...\n`);

  try {
    // Validate agent type
    const agentType = registry.getAgentType(type);
    if (!agentType) {
      console.error(`❌ Unknown agent type: ${type}`);
      console.error(`\nAvailable types: ${registry.getAllTypes().join(', ')}`);
      process.exit(1);
    }

    // Get or create orchestrator
    const orchestrator = global.__agentOrchestrator || new SwarmOrchestrator();
    if (!global.__agentOrchestrator) {
      global.__agentOrchestrator = orchestrator;
    }

    // Parse options
    const agentOptions = {
      name: options.name,
      config: options.config ? JSON.parse(options.config) : {}
    };

    // Spawn agent
    const agent = await orchestrator.agentManager.spawn(type, agentOptions);

    console.log(`✅ Agent spawned successfully!`);
    console.log(`\nAgent Details:`);
    console.log(`  ID: ${agent.id}`);
    console.log(`  Name: ${agent.name}`);
    console.log(`  Type: ${agent.type}`);
    console.log(`  Status: ${agent.status}`);
    console.log(`  Capabilities: ${agent.capabilities.join(', ')}`);
    console.log(`\nUse "neural-trader agent status ${agent.id}" to check status\n`);

    return agent;
  } catch (error) {
    console.error(`\n❌ Failed to spawn agent: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { spawnCommand };
