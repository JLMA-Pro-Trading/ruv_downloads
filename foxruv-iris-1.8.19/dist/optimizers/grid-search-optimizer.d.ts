/**
 * Grid Search Optimizer
 *
 * Simple exhaustive grid search optimizer.
 * No external dependencies - always available as fallback.
 *
 * @module optimizers/grid-search-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer, type SearchSpace, type EvaluationFunction, type OptimizationOptions, type OptimizationResult, type ParameterConfiguration, type OptimizerMetadata } from './base-optimizer.js';
export declare class GridSearchOptimizer extends BaseOptimizer {
    private currentBest;
    private currentBestScore;
    healthCheck(): Promise<boolean>;
    getMetadata(): OptimizerMetadata;
    optimize(searchSpace: SearchSpace, evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    resume(_checkpointPath: string): Promise<OptimizationResult>;
    getBestConfiguration(): Promise<ParameterConfiguration | null>;
    /**
     * Generate grid of all parameter combinations
     */
    private generateGrid;
}
//# sourceMappingURL=grid-search-optimizer.d.ts.map