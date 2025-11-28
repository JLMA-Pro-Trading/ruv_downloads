/**
 * Base Optimizer Interface
 *
 * Abstract class defining the contract for all optimization strategies.
 * Domain-agnostic - works for any AI task (trading, NLP, robotics, etc.)
 *
 * @module optimizers/base-optimizer
 * @version 1.0.0
 */
export interface SearchSpace {
    parameters: Parameter[];
    constraints?: Constraint[];
}
export interface Parameter {
    name: string;
    type: 'range' | 'choice' | 'fixed';
    bounds?: [number, number];
    values?: any[];
    value?: any;
    log_scale?: boolean;
}
export interface Constraint {
    type: 'linear' | 'order' | 'sum';
    parameters: string[];
    bound?: number;
}
export type EvaluationFunction = (config: ParameterConfiguration) => Promise<EvaluationScore>;
export interface ParameterConfiguration {
    [key: string]: any;
}
export interface EvaluationScore {
    primary: number;
    secondary?: Record<string, number>;
    metadata?: Record<string, any>;
}
export interface OptimizationOptions {
    maxTrials?: number;
    timeout?: number;
    parallelism?: number;
    earlyStoppingPatience?: number;
    checkpointInterval?: number;
}
export interface OptimizationResult {
    bestConfiguration: ParameterConfiguration;
    bestScore: EvaluationScore;
    trialHistory: Trial[];
    convergencePlot?: number[];
    totalTrials: number;
    elapsedTime: number;
    metadata: {
        optimizer: string;
        startTime: string;
        endTime: string;
        checkpointSaved?: string;
        [key: string]: string | number | boolean | undefined;
    };
}
export interface Trial {
    trialIndex: number;
    configuration: ParameterConfiguration;
    score: EvaluationScore;
    status: 'completed' | 'failed' | 'abandoned';
    error?: string;
    duration: number;
}
export interface OptimizerMetadata {
    name: string;
    version: string;
    capabilities: {
        supportsMultiObjective: boolean;
        supportsParallelTrials: boolean;
        supportsCheckpointing: boolean;
        searchStrategy: 'bayesian' | 'evolutionary' | 'grid' | 'random';
    };
    dependencies: string[];
}
export interface OptimizerConfig {
    checkpointDir?: string;
    verbose?: boolean;
    seed?: number;
}
/**
 * Base optimizer that all optimization strategies must extend
 */
export declare abstract class BaseOptimizer {
    protected config: OptimizerConfig;
    constructor(config?: OptimizerConfig);
    /**
     * Run optimization experiment
     *
     * @param searchSpace - Parameters to optimize
     * @param evaluationFn - Function that scores a parameter configuration
     * @param options - Experiment-specific options
     * @returns Best configuration found
     */
    abstract optimize(searchSpace: SearchSpace, evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    /**
     * Resume optimization from checkpoint
     *
     * @param checkpointPath - Path to checkpoint file
     * @returns Resumed optimization result
     */
    abstract resume(checkpointPath: string): Promise<OptimizationResult>;
    /**
     * Get current best configuration (during optimization)
     *
     * @returns Best config so far, or null if not started
     */
    abstract getBestConfiguration(): Promise<ParameterConfiguration | null>;
    /**
     * Health check - is optimizer ready to use?
     *
     * @returns true if all dependencies are available
     */
    abstract healthCheck(): Promise<boolean>;
    /**
     * Get optimizer metadata
     *
     * @returns Metadata describing capabilities and requirements
     */
    abstract getMetadata(): OptimizerMetadata;
    /**
     * Validate search space (called before optimization)
     */
    protected validateSearchSpace(space: SearchSpace): void;
    /**
     * Generate random configuration from search space (helper)
     */
    protected generateRandomConfiguration(space: SearchSpace): ParameterConfiguration;
}
//# sourceMappingURL=base-optimizer.d.ts.map