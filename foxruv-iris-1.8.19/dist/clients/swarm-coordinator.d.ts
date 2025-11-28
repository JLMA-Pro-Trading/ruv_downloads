/**
 * Swarm Coordinator for Parallel Expert Training
 *
 * Orchestrates multi-expert optimization using swarm patterns. Enables:
 * - Parallel training of multiple experts
 * - Load balancing across training resources
 * - Coordinated optimization with shared learning
 * - Fault-tolerant training pipelines
 *
 * @module swarm-coordinator
 * @version 1.0.0
 */
import type { PythonOptimizerClient, OptimizationRequest, OptimizationResult } from './python-optimizer-client.js';
import type { AgentDBOptimizerStorage } from '../storage/agentdb-optimizer-storage.js';
import type { ReasoningBankManager } from '../storage/reasoning-bank.js';
export interface ExpertTrainingTask {
    expert_role: string;
    request: OptimizationRequest;
    priority?: 'low' | 'medium' | 'high' | 'critical';
}
export interface SwarmConfig {
    max_concurrent: number;
    retry_on_failure: boolean;
    max_retries: number;
    share_learning: boolean;
    load_balance: boolean;
}
export interface TrainingResult {
    expert_role: string;
    success: boolean;
    result?: OptimizationResult;
    error?: string;
    duration_ms: number;
    retries: number;
}
export interface SwarmStats {
    total_experts: number;
    completed: number;
    failed: number;
    in_progress: number;
    avg_duration_ms: number;
    success_rate: number;
}
export declare class SwarmCoordinator {
    private optimizer;
    private storage;
    private reasoningBank?;
    private config;
    private activeWorkers;
    private queue;
    private results;
    constructor(optimizer: PythonOptimizerClient, storage: AgentDBOptimizerStorage, config?: Partial<SwarmConfig>, reasoningBank?: ReasoningBankManager);
    /**
     * Train multiple experts in parallel
     */
    trainExperts(tasks: ExpertTrainingTask[]): Promise<TrainingResult[]>;
    /**
     * Process training queue with concurrency control
     */
    private processQueue;
    /**
     * Train a single expert with retry logic
     */
    private trainExpert;
    /**
     * Apply shared learning from other experts
     */
    private applySharedLearning;
    /**
     * Sort tasks by priority
     */
    private sortByPriority;
    /**
     * Get swarm statistics
     */
    getStats(): SwarmStats;
    /**
     * Get detailed results
     */
    getResults(): TrainingResult[];
}
/**
 * Create swarm coordinator instance
 */
export declare function createSwarmCoordinator(optimizer: PythonOptimizerClient, storage: AgentDBOptimizerStorage, config?: Partial<SwarmConfig>, reasoningBank?: ReasoningBankManager): SwarmCoordinator;
/**
 * Quick parallel training helper
 */
export declare function trainExpertsParallel(experts: string[], requestBuilder: (expert: string) => OptimizationRequest, optimizer: PythonOptimizerClient, storage: AgentDBOptimizerStorage, maxConcurrent?: number): Promise<TrainingResult[]>;
//# sourceMappingURL=swarm-coordinator.d.ts.map