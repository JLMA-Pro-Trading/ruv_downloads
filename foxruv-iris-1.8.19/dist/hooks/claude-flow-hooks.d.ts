/**
 * Claude Flow Integration Hooks for Iris Optimizer
 *
 * Provides intelligent coordination between Claude Flow's swarm orchestration
 * and Iris's self-improving optimization capabilities using ReasoningBank learning.
 */
interface OptimizationContext {
    taskId: string;
    timestamp: number;
    configuration?: Record<string, any>;
    metrics?: {
        latency?: number;
        successRate?: number;
        confidence?: number;
    };
    patterns?: string[];
}
export declare class ClaudeFlowHooks {
    private readonly memoryDir;
    private readonly sessionFile;
    private readonly config;
    constructor(rootPath?: string);
    /**
     * Pre-Task Hook: Load optimization context from ReasoningBank
     * Runs before any optimization task to warm-start with learned patterns
     */
    preTask(taskDescription: string, taskId?: string): Promise<void>;
    /**
     * Post-Edit Hook: Store optimization configuration in memory
     * Runs after file edits to track successful configurations
     */
    postEdit(filePath: string, context: OptimizationContext): Promise<void>;
    /**
     * Post-Task Hook: Record task completion and outcomes
     * Trains ReasoningBank with success/failure patterns
     */
    postTask(taskId: string, success: boolean, metrics?: OptimizationContext['metrics']): Promise<void>;
    /**
     * Session End Hook: Export metrics and persist learnings
     */
    sessionEnd(): Promise<void>;
    /**
     * Load warm-start patterns from ReasoningBank
     */
    private loadWarmStartPatterns;
    /**
     * Store optimization data in ReasoningBank
     */
    private storeInReasoningBank;
    /**
     * Update confidence scores in ReasoningBank based on outcomes
     */
    private updateReasoningBankConfidence;
    /**
     * Train neural patterns from task outcomes
     */
    private trainNeuralPatterns;
    /**
     * Persist session learnings for cross-session memory
     */
    private persistSessionLearnings;
    /**
     * Run claude-flow CLI command
     */
    private runClaudeFlowCommand;
    /**
     * Session state management
     */
    private loadSessionState;
    private saveSessionState;
    private clearSessionState;
    /**
     * Calculate metrics
     */
    private calculateSuccessRate;
    private calculateAverageConfidence;
}
export declare const hooks: ClaudeFlowHooks;
export declare const preTask: (desc: string, id?: string) => Promise<void>;
export declare const postEdit: (file: string, ctx: OptimizationContext) => Promise<void>;
export declare const postTask: (id: string, success: boolean, metrics?: any) => Promise<void>;
export declare const sessionEnd: () => Promise<void>;
export {};
//# sourceMappingURL=claude-flow-hooks.d.ts.map