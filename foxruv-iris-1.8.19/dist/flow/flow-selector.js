/**
 * Flow Selector - Unified interface for agentic-flow and claude-flow
 *
 * Determines which flow library to use based on task requirements.
 *
 * @module flow/flow-selector
 * @version 1.0.0
 */
/**
 * When to use each flow library:
 *
 * AGENTIC-FLOW (v1.9.1)
 * =====================
 * Use for:
 * - Direct AgentDB integration (already has bindings)
 * - Swarm coordination and orchestration
 * - Memory operations with existing AgentDB schema
 * - When you need the established, stable API
 * - Lightweight operations without neural training
 *
 * Best for:
 * - Simple optimization runs
 * - Direct database operations
 * - Swarm spawning and coordination
 * - When stability > features
 *
 *
 * CLAUDE-FLOW (alpha)
 * ===================
 * Use for:
 * - ReasoningBank with trajectory learning
 * - Neural pattern training
 * - Advanced hooks system (pre/post task)
 * - Confidence-based learning
 * - Cross-session memory persistence
 * - Warm-start optimization from learned patterns
 *
 * Best for:
 * - Complex optimization with learning
 * - Long-running optimization campaigns
 * - When you need pattern recognition
 * - Self-improving systems
 * - When features > stability
 */
export const FLOW_CAPABILITIES = {
    'agentic-flow': {
        swarmOrchestration: true,
        memoryPersistence: true,
        reasoningBank: false, // Basic memory, not full ReasoningBank
        neuralTraining: false,
        parallelExecution: true,
        workerThreads: false,
        distributedTasks: true,
        trajectoryStorage: false,
        confidenceTracking: false,
        patternRecognition: false,
        warmStart: false,
        mcpIntegration: true,
        agentdbIntegration: true, // Direct AgentDB bindings
        hooksSystem: false
    },
    'claude-flow': {
        swarmOrchestration: true,
        memoryPersistence: true,
        reasoningBank: true, // Full ReasoningBank with trajectories
        neuralTraining: true,
        parallelExecution: true,
        workerThreads: true,
        distributedTasks: true,
        trajectoryStorage: true,
        confidenceTracking: true,
        patternRecognition: true,
        warmStart: true,
        mcpIntegration: true,
        agentdbIntegration: true,
        hooksSystem: true // Pre/post task hooks
    }
};
/**
 * Select the appropriate flow provider based on task requirements
 */
export function selectFlow(requirements) {
    // If user prefers stability, use agentic-flow
    if (requirements.preferStability) {
        return 'agentic-flow';
    }
    // If learning/patterns/warm-start needed, must use claude-flow
    if (requirements.needsLearning ||
        requirements.needsPatterns ||
        requirements.needsWarmStart ||
        requirements.needsNeuralTraining ||
        requirements.needsHooks) {
        return 'claude-flow';
    }
    // Long-running campaigns benefit from claude-flow learning
    if (requirements.isLongRunning) {
        return 'claude-flow';
    }
    // Simple swarm/AgentDB operations - agentic-flow is sufficient
    if (requirements.needsSwarm || requirements.needsAgentDB) {
        return 'agentic-flow';
    }
    // Default to agentic-flow for stability
    return 'agentic-flow';
}
/**
 * Task type presets for common operations
 */
export const TASK_PRESETS = {
    // Simple one-shot optimization
    'simple-optimization': {
        needsSwarm: false,
        needsAgentDB: true,
        preferStability: true
    },
    // Learning optimization that improves over time
    'learning-optimization': {
        needsLearning: true,
        needsPatterns: true,
        needsWarmStart: true,
        isLongRunning: true
    },
    // Swarm-based parallel optimization
    'swarm-optimization': {
        needsSwarm: true,
        needsAgentDB: true,
        preferStability: true
    },
    // Neural-enhanced optimization
    'neural-optimization': {
        needsNeuralTraining: true,
        needsPatterns: true,
        needsLearning: true
    },
    // Production trading optimization
    'trading-optimization': {
        needsLearning: true,
        needsWarmStart: true,
        needsPatterns: true,
        isLongRunning: true,
        needsAgentDB: true
    }
};
/**
 * Get recommended flow for a task preset
 */
export function getFlowForPreset(preset) {
    return selectFlow(TASK_PRESETS[preset]);
}
/**
 * Check if a flow provider supports specific capabilities
 */
export function checkCapabilities(provider, required) {
    if (provider === 'auto') {
        // Auto means we'll pick the right one, so all capabilities available
        return { supported: true, missing: [] };
    }
    const capabilities = FLOW_CAPABILITIES[provider];
    const missing = [];
    for (const [key, needed] of Object.entries(required)) {
        if (needed && !capabilities[key]) {
            missing.push(key);
        }
    }
    return {
        supported: missing.length === 0,
        missing
    };
}
/**
 * Unified flow interface for Iris
 */
export class FlowManager {
    provider;
    agenticFlow = null;
    _claudeFlow = null;
    constructor(provider = 'auto') {
        this.provider = provider;
    }
    /**
     * Initialize the appropriate flow provider
     */
    async initialize(requirements) {
        const selectedProvider = this.provider === 'auto'
            ? selectFlow(requirements || {})
            : this.provider;
        if (selectedProvider === 'agentic-flow') {
            try {
                this.agenticFlow = await import('agentic-flow');
                console.log('Initialized agentic-flow');
            }
            catch (error) {
                console.warn('Failed to initialize agentic-flow:', error);
            }
        }
        else {
            try {
                // claude-flow is typically used via npx
                this._claudeFlow = { initialized: true };
                console.log('Initialized claude-flow (CLI-based)');
            }
            catch (error) {
                console.warn('Failed to initialize claude-flow:', error);
            }
        }
    }
    /**
     * Get the active provider
     */
    getProvider() {
        return this.provider;
    }
    /**
     * Get the claude-flow instance (if initialized)
     */
    getClaudeFlow() {
        return this._claudeFlow;
    }
    /**
     * Store a learning trajectory
     */
    async storeTrajectory(data) {
        if (this.provider === 'claude-flow' || this.provider === 'auto') {
            // Use claude-flow's ReasoningBank
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            const trajectory = JSON.stringify(data);
            await execAsync(`npx claude-flow@alpha memory store "${data.taskId}" '${trajectory}' --reasoningbank --namespace iris-optimization`);
        }
        else {
            // Use agentic-flow's memory
            if (this.agenticFlow?.memory) {
                await this.agenticFlow.memory.store(data.taskId, data);
            }
        }
    }
    /**
     * Query for similar patterns
     */
    async queryPatterns(query, limit = 10) {
        if (this.provider === 'claude-flow' || this.provider === 'auto') {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            try {
                const result = await execAsync(`npx claude-flow@alpha memory query "${query}" --reasoningbank --namespace iris-optimization --limit ${limit}`);
                return JSON.parse(result.stdout || '[]');
            }
            catch {
                return [];
            }
        }
        else {
            if (this.agenticFlow?.memory) {
                return await this.agenticFlow.memory.query(query, limit);
            }
            return [];
        }
    }
    /**
     * Execute hooks
     */
    async executeHook(hookType, data) {
        if (this.provider !== 'claude-flow' && this.provider !== 'auto') {
            // agentic-flow doesn't have hooks system
            return;
        }
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const dataStr = data ? JSON.stringify(data) : '';
        try {
            await execAsync(`npx claude-flow@alpha hooks ${hookType} ${dataStr ? `'${dataStr}'` : ''}`);
        }
        catch (error) {
            console.warn(`Hook ${hookType} failed:`, error);
        }
    }
}
// Export singleton for convenience
export const flowManager = new FlowManager('auto');
