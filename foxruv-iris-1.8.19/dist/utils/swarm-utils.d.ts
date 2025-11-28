/**
 * Swarm Coordination Utilities
 *
 * Utilities for coordinating multi-agent training using claude-flow MCP tools.
 * Enables parallel expert optimization, distributed learning, and fault-tolerant workflows.
 *
 * @module swarm-utils
 * @version 1.0.0
 */
/**
 * Training task for a single expert
 */
export interface TrainingTask {
    expertId: string;
    expertName: string;
    trainingData: any[];
    valData?: any[];
    config: {
        maxSteps?: number;
        temperature?: number;
        batchSize?: number;
        [key: string]: any;
    };
}
/**
 * Result from training a single expert
 */
export interface TrainingResult {
    expertId: string;
    success: boolean;
    metrics: {
        accuracy?: number;
        f1?: number;
        loss?: number;
        [key: string]: number | undefined;
    };
    duration: number;
    error?: string;
}
/**
 * Swarm configuration for parallel training
 */
export interface SwarmConfig {
    topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
    maxAgents: number;
    strategy: 'balanced' | 'specialized' | 'adaptive';
    enableMemory?: boolean;
    enableNeuralCoordination?: boolean;
}
/**
 * Swarm statistics
 */
export interface SwarmStats {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    avgDuration: number;
    peakMemoryMB: number;
}
/**
 * Train multiple experts in parallel using swarm coordination
 */
export declare function trainExpertsInParallel(tasks: TrainingTask[], config: SwarmConfig): Promise<TrainingResult[]>;
/**
 * Calculate swarm statistics from training results
 */
export declare function calculateSwarmStats(results: TrainingResult[]): SwarmStats;
/**
 * Retry failed training tasks with exponential backoff
 */
export declare function retryFailedTasks(results: TrainingResult[], originalTasks: TrainingTask[], maxRetries?: number): Promise<TrainingResult[]>;
/**
 * Shard large training dataset for distributed processing
 */
export declare function shardTrainingData<T>(data: T[], numShards: number): T[][];
/**
 * Aggregate metrics from multiple training runs
 */
export declare function aggregateMetrics(results: TrainingResult[]): Record<string, number>;
/**
 * Load balancing strategy for distributing tasks across agents
 */
export declare function loadBalanceTasks<T>(tasks: T[], agentCapacities: number[]): T[][];
/**
 * Create a fault-tolerant training wrapper
 */
export declare function faultTolerantTrain(task: TrainingTask, maxRetries?: number, timeout?: number): Promise<TrainingResult>;
/**
 * Monitor training progress with real-time updates
 */
export declare class TrainingMonitor {
    private totalTasks;
    private completedTasks;
    private startTime;
    private callbacks;
    constructor(totalTasks: number);
    onProgress(callback: (progress: number) => void): void;
    reportComplete(): void;
    getETA(): number;
    getStats(): {
        progress: number;
        completed: number;
        total: number;
        eta: number;
        elapsed: number;
    };
}
//# sourceMappingURL=swarm-utils.d.ts.map