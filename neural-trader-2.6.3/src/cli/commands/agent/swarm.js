/**
 * Agent Swarm Command - Deploy multi-agent swarm strategy
 */

const { SwarmOrchestrator } = require('../../lib/swarm-orchestrator');
const { AgentRegistry } = require('../../lib/agent-registry');

const registry = new AgentRegistry();

async function swarmCommand(strategyName, options = {}) {
  if (!strategyName) {
    // List available strategies
    console.log('\n🐝 Available Swarm Strategies:\n');
    console.log('─'.repeat(60));

    const strategies = registry.getAllSwarmStrategies();

    for (const name of strategies) {
      const strategy = registry.getSwarmStrategy(name);
      console.log(`\n${name}`);
      console.log(`  ${strategy.description}`);
      console.log(`  Agents: ${strategy.agents.join(', ')}`);
      console.log(`  Topology: ${strategy.topology}`);
      console.log(`  Coordination: ${strategy.coordination}`);
    }

    console.log('\n─'.repeat(60));
    console.log('\nUsage: neural-trader agent swarm <strategy> [options]');
    console.log('Example: neural-trader agent swarm multi-strategy\n');
    return;
  }

  console.log(`\n🐝 Deploying swarm: ${strategyName}...\n`);

  try {
    // Validate strategy
    const strategy = registry.getSwarmStrategy(strategyName);
    if (!strategy) {
      console.error(`❌ Unknown swarm strategy: ${strategyName}`);
      console.error(`\nAvailable strategies: ${registry.getAllSwarmStrategies().join(', ')}`);
      process.exit(1);
    }

    // Get or create orchestrator
    const orchestrator = global.__agentOrchestrator || new SwarmOrchestrator();
    if (!global.__agentOrchestrator) {
      global.__agentOrchestrator = orchestrator;
    }

    // Parse options
    const swarmOptions = {
      name: options.name,
      topology: options.topology,
      config: options.config ? JSON.parse(options.config) : {}
    };

    // Deploy swarm
    console.log(`Deploying ${strategy.agents.length} agents with ${strategy.topology} topology...`);

    const swarm = await orchestrator.deploySwarm(strategyName, swarmOptions);

    console.log(`\n✅ Swarm deployed successfully!`);
    console.log(`\nSwarm Details:`);
    console.log(`  ID: ${swarm.id}`);
    console.log(`  Name: ${swarm.name}`);
    console.log(`  Strategy: ${swarm.strategy}`);
    console.log(`  Status: ${swarm.status}`);
    console.log(`  Topology: ${swarm.topology}`);
    console.log(`  Coordination: ${swarm.coordination}`);
    console.log(`  Agents: ${swarm.agents.length}`);

    console.log(`\n  Agent IDs:`);
    swarm.agents.forEach((agentId, index) => {
      const agent = orchestrator.agentManager.get(agentId);
      console.log(`    ${index + 1}. ${agent.type}: ${agentId}`);
    });

    console.log(`\nCommands:`);
    console.log(`  View status: neural-trader agent coordinate`);
    console.log(`  Stop swarm: neural-trader agent stopall --force`);
    console.log('');

    return swarm;
  } catch (error) {
    console.error(`\n❌ Failed to deploy swarm: ${error.message}\n`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { swarmCommand };
