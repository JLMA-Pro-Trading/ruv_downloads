/**
 * DSPy Optimizer Adapter
 *
 * Adapts the specific PythonOptimizerClient (DSPy MIPROv2) to the generic BaseOptimizer interface.
 * Allows DSPy to be used interchangeably with other optimizers in the registry.
 *
 * note: Unlike Ax (which calls back for evaluation), DSPy runs the optimization loop
 * entirely server-side (in Python). The `evaluationFn` passed to optimize() is largely
 * unused here, as the metric is implicit in the training data/Python service.
 *
 * @module optimizers/dspy-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer, type SearchSpace, type EvaluationFunction, type OptimizationOptions, type OptimizationResult, type ParameterConfiguration, type OptimizerMetadata, type OptimizerConfig } from './base-optimizer.js';
export declare class DSPyOptimizer extends BaseOptimizer {
    private client;
    constructor(config?: OptimizerConfig & {
        baseUrl?: string;
    });
    healthCheck(): Promise<boolean>;
    getMetadata(): OptimizerMetadata;
    optimize(searchSpace: SearchSpace, _evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    resume(_checkpointPath: string): Promise<OptimizationResult>;
    getBestConfiguration(): Promise<ParameterConfiguration | null>;
    private convertToDSPyRequest;
}
//# sourceMappingURL=dspy-optimizer.d.ts.map