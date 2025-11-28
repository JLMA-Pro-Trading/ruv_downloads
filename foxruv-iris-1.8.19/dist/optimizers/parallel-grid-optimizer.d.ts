/**
 * Parallel Grid Search Optimizer
 *
 * Parallel implementation of grid search using Node.js worker threads.
 * Provides significant speedup for expensive evaluation functions.
 *
 * Features:
 * - Configurable parallelism (default: number of CPUs)
 * - Batch-based evaluation for optimal throughput
 * - Progress tracking across workers
 * - Graceful error handling and fallback
 * - Feature detection (falls back to sequential if workers unavailable)
 *
 * @module optimizers/parallel-grid-optimizer
 * @version 1.0.0
 */
import { GridSearchOptimizer } from './grid-search-optimizer.js';
import type { SearchSpace, EvaluationFunction, OptimizationOptions, OptimizationResult, OptimizerMetadata } from './base-optimizer.js';
/**
 * Parallel Grid Search Optimizer using Worker Threads
 */
export declare class ParallelGridOptimizer extends GridSearchOptimizer {
    private parallelism;
    private workersAvailable;
    constructor(config?: any);
    /**
     * Check if worker threads are available
     */
    private checkWorkerSupport;
    healthCheck(): Promise<boolean>;
    getMetadata(): OptimizerMetadata;
    /**
     * Run optimization with parallel evaluation
     */
    optimize(searchSpace: SearchSpace, evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    /**
     * Evaluate configurations in parallel using worker threads
     */
    private evaluateParallel;
    /**
     * Get current parallelism level
     */
    getParallelism(): number;
    /**
     * Set parallelism level
     */
    setParallelism(parallelism: number): void;
    /**
     * Check if workers are available
     */
    isParallelAvailable(): boolean;
}
//# sourceMappingURL=parallel-grid-optimizer.d.ts.map