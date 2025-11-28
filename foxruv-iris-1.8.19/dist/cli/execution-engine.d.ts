/**
 * Smart Execution Engine
 *
 * Automatically uses agentic-flow + AgentDB for all operations
 * Configurable via .iris/config/settings.json
 */
export interface ExecutionConfig {
    use_agentic_flow: boolean;
    use_agentdb: boolean;
    swarm_topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
    max_agents: number;
    enable_learning: boolean;
    enable_caching: boolean;
    track_all_operations: boolean;
}
export interface ExecutionContext {
    command: string;
    args: any[];
    workingDir: string;
    timestamp: number;
}
export interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    metrics: {
        duration_ms: number;
        agents_used?: number;
        tokens_used?: number;
        operations_count?: number;
    };
}
/**
 * Smart Execution Engine
 */
export declare class SmartExecutionEngine {
    private config;
    private irisRoot;
    constructor(projectRoot?: string);
    /**
     * Load execution configuration
     */
    loadConfig(): Promise<ExecutionConfig>;
    /**
     * Execute with smart defaults (automatically uses agentic-flow + AgentDB)
     */
    execute(context: ExecutionContext): Promise<ExecutionResult>;
    /**
     * Execute using agentic-flow swarm
     */
    private executeWithAgenticFlow;
    /**
     * Direct execution (no swarm)
     */
    private executeDirect;
    /**
     * Track operation in AgentDB
     */
    private trackInAgentDB;
    /**
     * Load agentic-flow dynamically
     */
    private loadAgenticFlow;
    /**
     * Mock implementations (fallback when agentic-flow not available)
     */
    private mockInitSwarm;
    private mockExecuteTask;
    /**
     * Update execution configuration
     */
    updateConfig(updates: Partial<ExecutionConfig>): Promise<void>;
    /**
     * Toggle agentic-flow on/off
     */
    toggleAgenticFlow(enable: boolean): Promise<void>;
    /**
     * Toggle AgentDB tracking on/off
     */
    toggleAgentDB(enable: boolean): Promise<void>;
    /**
     * Show current configuration
     */
    showConfig(): Promise<void>;
}
export declare function getExecutionEngine(projectRoot?: string): SmartExecutionEngine;
/**
 * Convenient wrapper for executing with smart defaults
 */
export declare function executeWithDefaults(command: string, args?: any[], workingDir?: string): Promise<ExecutionResult>;
//# sourceMappingURL=execution-engine.d.ts.map