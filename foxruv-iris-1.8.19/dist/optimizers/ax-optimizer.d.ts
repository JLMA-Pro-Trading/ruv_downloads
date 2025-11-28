/**
 * Ax Optimizer Implementation
 *
 * Bayesian optimization using Ax platform via Python service.
 * Requires: ax-platform (Python), ax_service.py running
 *
 * @module optimizers/ax-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer, type SearchSpace, type EvaluationFunction, type OptimizationOptions, type OptimizationResult, type ParameterConfiguration, type OptimizerMetadata, type OptimizerConfig } from './base-optimizer.js';
export declare class AxOptimizer extends BaseOptimizer {
    private baseUrl;
    private currentExperimentId;
    constructor(config?: OptimizerConfig & {
        baseUrl?: string;
    });
    healthCheck(): Promise<boolean>;
    getMetadata(): OptimizerMetadata;
    optimize(searchSpace: SearchSpace, evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    resume(checkpointPath: string): Promise<OptimizationResult>;
    getBestConfiguration(): Promise<ParameterConfiguration | null>;
    private createExperiment;
    private getNextTrial;
    private completeTrial;
    private getBest;
    private saveCheckpoint;
}
//# sourceMappingURL=ax-optimizer.d.ts.map