/**
 * Swarm Coordination Wrapper for NAPI Bindings
 * Provides validated interface to Rust swarm orchestration
 * Version: 2.4.0+
 */

// Load NAPI binding directly to avoid circular dependency
const { platform, arch } = process;

const nativeBinding = (() => {
  const loadErrors = [];

  const getTargetSuffix = () => {
    if (platform === 'linux' && arch === 'x64') return 'linux-x64-gnu';
    if (platform === 'linux' && arch === 'arm64') return 'linux-arm64-gnu';
    if (platform === 'darwin' && arch === 'x64') return 'darwin-x64';
    if (platform === 'darwin' && arch === 'arm64') return 'darwin-arm64';
    if (platform === 'win32' && arch === 'x64') return 'win32-x64-msvc';
    return `${platform}-${arch}`;
  };

  const targetSuffix = getTargetSuffix();

  const targets = [
    [`napi-${targetSuffix}-root`, `../../../neural-trader-rust/neural-trader.${targetSuffix}.node`],
    [`napi-${targetSuffix}`, `../../../neural-trader-rust/crates/napi-bindings/neural-trader.${targetSuffix}.node`],
    [`${platform}-${arch}`, `../../../neural-trader-rust/crates/napi-bindings/neural-trader.${platform}-${arch}.node`],
    ['universal', '../../../neural-trader-rust/crates/napi-bindings/neural-trader.node']
  ];

  for (const [name, path] of targets) {
    try {
      return require(path);
    } catch (error) {
      loadErrors.push(`[${name}]: ${error.message}`);
    }
  }

  throw new Error('NAPI Swarm bindings not available. Please build with: npm run build');
})();

const napi = nativeBinding;

/**
 * Initialize a new swarm
 * @param {Object} config - Swarm configuration
 * @param {string} config.topology - Swarm topology ('mesh', 'hierarchical', 'ring', 'star')
 * @param {number} [config.max_agents=8] - Maximum number of agents
 * @param {string} [config.strategy='balanced'] - Distribution strategy
 * @param {boolean} [config.enable_reasoning=true] - Enable ReasoningBank
 * @returns {Promise<string>} Swarm ID
 */
async function init(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('config object is required');
  }

  const validTopologies = ['mesh', 'hierarchical', 'ring', 'star'];
  if (!validTopologies.includes(config.topology)) {
    throw new Error(`topology must be one of: ${validTopologies.join(', ')}`);
  }

  const validStrategies = ['balanced', 'specialized', 'adaptive'];
  const strategy = config.strategy || 'balanced';
  if (!validStrategies.includes(strategy)) {
    throw new Error(`strategy must be one of: ${validStrategies.join(', ')}`);
  }

  const swarmConfig = {
    topology: config.topology,
    maxAgents: config.max_agents || 8,  // camelCase for NAPI
    strategy,
    enableReasoning: config.enable_reasoning ?? true  // camelCase for NAPI
  };

  return await napi.swarmInit(swarmConfig);
}

/**
 * Spawn a new agent in the swarm
 * @param {Object} agentConfig - Agent configuration
 * @param {string} agentConfig.agent_type - Agent type ('trader', 'analyzer', 'risk-manager', 'monitor')
 * @param {string} agentConfig.name - Agent name
 * @param {Array<string>} [agentConfig.capabilities=[]] - Agent capabilities
 * @returns {Promise<string>} Agent ID
 */
async function spawnAgent(agentConfig) {
  if (!agentConfig || typeof agentConfig !== 'object') {
    throw new Error('agentConfig object is required');
  }
  if (!agentConfig.agent_type || typeof agentConfig.agent_type !== 'string') {
    throw new Error('agentConfig.agent_type is required and must be a string');
  }
  if (!agentConfig.name || typeof agentConfig.name !== 'string') {
    throw new Error('agentConfig.name is required and must be a string');
  }

  const config = {
    agentType: agentConfig.agent_type,  // camelCase for NAPI
    name: agentConfig.name,
    capabilities: agentConfig.capabilities || []
  };

  return await napi.swarmSpawnAgent(config);
}

/**
 * Get swarm status
 * @returns {Promise<Object>} Swarm status object
 */
async function getStatus() {
  return await napi.swarmGetStatus();
}

/**
 * List all agents in the swarm
 * @returns {Promise<Array>} Array of agent info objects
 */
async function listAgents() {
  return await napi.swarmListAgents();
}

/**
 * Orchestrate a task across the swarm
 * @param {Object} task - Task request
 * @param {string} task.task_type - Type of task
 * @param {string} task.description - Task description
 * @param {string} [task.priority='medium'] - Task priority
 * @param {string} [task.strategy='adaptive'] - Execution strategy
 * @returns {Promise<Object>} Task result
 */
async function orchestrateTask(task) {
  if (!task || typeof task !== 'object') {
    throw new Error('task object is required');
  }
  if (!task.task_type || typeof task.task_type !== 'string') {
    throw new Error('task.task_type is required and must be a string');
  }
  if (!task.description || typeof task.description !== 'string') {
    throw new Error('task.description is required and must be a string');
  }

  const validPriorities = ['low', 'medium', 'high', 'critical'];
  const priority = task.priority || 'medium';
  if (!validPriorities.includes(priority)) {
    throw new Error(`priority must be one of: ${validPriorities.join(', ')}`);
  }

  const validStrategies = ['parallel', 'sequential', 'adaptive'];
  const strategy = task.strategy || 'adaptive';
  if (!validStrategies.includes(strategy)) {
    throw new Error(`strategy must be one of: ${validStrategies.join(', ')}`);
  }

  const taskRequest = {
    taskType: task.task_type,  // camelCase for NAPI
    description: task.description,
    priority,
    strategy
  };

  return await napi.swarmOrchestrateTask(taskRequest);
}

/**
 * Stop a specific agent
 * @param {string} agentId - Agent ID to stop
 * @returns {Promise<boolean>} True if stopped successfully
 */
async function stopAgent(agentId) {
  if (!agentId || typeof agentId !== 'string') {
    throw new Error('agentId is required and must be a string');
  }

  return await napi.swarmStopAgent(agentId);
}

/**
 * Destroy the swarm
 * @returns {Promise<boolean>} True if destroyed successfully
 */
async function destroy() {
  return await napi.swarmDestroy();
}

/**
 * Scale swarm to target agent count
 * @param {number} targetAgents - Target number of agents
 * @returns {Promise<number>} Current agent count
 */
async function scale(targetAgents) {
  if (typeof targetAgents !== 'number' || targetAgents < 0) {
    throw new Error('targetAgents must be a non-negative number');
  }

  return await napi.swarmScale(targetAgents);
}

/**
 * Check swarm health
 * @returns {Promise<string>} Health status message
 */
async function healthCheck() {
  return await napi.swarmHealthCheck();
}

/**
 * Helper: Create mesh swarm (peer-to-peer, best for balanced workloads)
 * @param {number} [maxAgents=8] - Maximum agents
 * @returns {Promise<string>} Swarm ID
 */
async function createMeshSwarm(maxAgents = 8) {
  return await init({
    topology: 'mesh',
    max_agents: maxAgents,
    strategy: 'balanced',
    enable_reasoning: true
  });
}

/**
 * Helper: Create hierarchical swarm (leader-follower, best for coordinated tasks)
 * @param {number} [maxAgents=8] - Maximum agents
 * @returns {Promise<string>} Swarm ID
 */
async function createHierarchicalSwarm(maxAgents = 8) {
  return await init({
    topology: 'hierarchical',
    max_agents: maxAgents,
    strategy: 'specialized',
    enable_reasoning: true
  });
}

/**
 * Helper: Create star swarm (centralized, best for simple coordination)
 * @param {number} [maxAgents=8] - Maximum agents
 * @returns {Promise<string>} Swarm ID
 */
async function createStarSwarm(maxAgents = 8) {
  return await init({
    topology: 'star',
    max_agents: maxAgents,
    strategy: 'balanced',
    enable_reasoning: true
  });
}

module.exports = {
  init,
  spawnAgent,
  getStatus,
  listAgents,
  orchestrateTask,
  stopAgent,
  destroy,
  scale,
  healthCheck,

  // Helpers
  createMeshSwarm,
  createHierarchicalSwarm,
  createStarSwarm
};
