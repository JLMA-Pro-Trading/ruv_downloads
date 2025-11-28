/**
 * Flow Selector - Unified interface for agentic-flow and claude-flow
 *
 * Determines which flow library to use based on task requirements.
 *
 * @module flow/flow-selector
 * @version 1.0.0
 */
export type FlowProvider = 'agentic-flow' | 'claude-flow' | 'auto';
export interface FlowCapabilities {
    swarmOrchestration: boolean;
    memoryPersistence: boolean;
    reasoningBank: boolean;
    neuralTraining: boolean;
    parallelExecution: boolean;
    workerThreads: boolean;
    distributedTasks: boolean;
    trajectoryStorage: boolean;
    confidenceTracking: boolean;
    patternRecognition: boolean;
    warmStart: boolean;
    mcpIntegration: boolean;
    agentdbIntegration: boolean;
    hooksSystem: boolean;
}
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
export declare const FLOW_CAPABILITIES: Record<'agentic-flow' | 'claude-flow', FlowCapabilities>;
export interface TaskRequirements {
    needsLearning?: boolean;
    needsPatterns?: boolean;
    needsWarmStart?: boolean;
    needsNeuralTraining?: boolean;
    needsSwarm?: boolean;
    needsAgentDB?: boolean;
    needsHooks?: boolean;
    preferStability?: boolean;
    isLongRunning?: boolean;
}
/**
 * Select the appropriate flow provider based on task requirements
 */
export declare function selectFlow(requirements: TaskRequirements): FlowProvider;
/**
 * Task type presets for common operations
 */
export declare const TASK_PRESETS: Record<string, TaskRequirements>;
/**
 * Get recommended flow for a task preset
 */
export declare function getFlowForPreset(preset: keyof typeof TASK_PRESETS): FlowProvider;
/**
 * Check if a flow provider supports specific capabilities
 */
export declare function checkCapabilities(provider: FlowProvider, required: Partial<FlowCapabilities>): {
    supported: boolean;
    missing: string[];
};
/**
 * Unified flow interface for Iris
 */
export declare class FlowManager {
    private provider;
    private agenticFlow;
    private _claudeFlow;
    constructor(provider?: FlowProvider);
    /**
     * Initialize the appropriate flow provider
     */
    initialize(requirements?: TaskRequirements): Promise<void>;
    /**
     * Get the active provider
     */
    getProvider(): FlowProvider;
    /**
     * Get the claude-flow instance (if initialized)
     */
    getClaudeFlow(): any;
    /**
     * Store a learning trajectory
     */
    storeTrajectory(data: {
        taskId: string;
        context: Record<string, any>;
        action: string;
        outcome: Record<string, any>;
        verdict: 'success' | 'partial' | 'failure';
        confidence: number;
    }): Promise<void>;
    /**
     * Query for similar patterns
     */
    queryPatterns(query: string, limit?: number): Promise<any[]>;
    /**
     * Execute hooks
     */
    executeHook(hookType: 'pre-task' | 'post-task' | 'post-edit' | 'session-end', data?: any): Promise<void>;
}
export declare const flowManager: FlowManager;
//# sourceMappingURL=flow-selector.d.ts.map