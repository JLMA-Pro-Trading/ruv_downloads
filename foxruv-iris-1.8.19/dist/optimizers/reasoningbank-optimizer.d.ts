/**
 * ReasoningBank Optimizer
 *
 * Intelligent optimizer that uses learned patterns from ReasoningBank for warm-start optimization.
 * Queries historical successful configurations before starting, uses high-confidence patterns
 * to initialize search, falls back to grid search for exploration, and stores successful
 * trials back to ReasoningBank for continuous learning.
 *
 * @module optimizers/reasoningbank-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer, type SearchSpace, type EvaluationFunction, type OptimizationOptions, type OptimizationResult, type ParameterConfiguration, type OptimizerMetadata, type OptimizerConfig } from './base-optimizer.js';
export interface ReasoningBankOptimizerConfig extends OptimizerConfig {
    dbPath?: string;
    expertRole?: string;
    warmStartRatio?: number;
    confidenceThreshold?: number;
    successThreshold?: number;
    enableLearning?: boolean;
}
/**
 * ReasoningBank-powered optimizer with adaptive warm-start
 */
export declare class ReasoningBankOptimizer extends BaseOptimizer {
    private reasoningBank;
    private expertRole;
    private warmStartRatio;
    private confidenceThreshold;
    private successThreshold;
    private enableLearning;
    private currentBest;
    private currentBestScore;
    constructor(config?: ReasoningBankOptimizerConfig);
    healthCheck(): Promise<boolean>;
    getMetadata(): OptimizerMetadata;
    optimize(searchSpace: SearchSpace, evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    resume(_checkpointPath: string): Promise<OptimizationResult>;
    getBestConfiguration(): Promise<ParameterConfiguration | null>;
    /**
     * Generate warm-start configurations from ReasoningBank patterns
     */
    private generateWarmStartConfigs;
    /**
     * Extract parameter configuration from learning trajectory
     */
    private extractConfigFromTrajectory;
    /**
     * Create variation of a configuration (for exploration around successful configs)
     */
    private createVariation;
    /**
     * Generate exploration configs using grid search
     */
    private generateExplorationConfigs;
    /**
     * Store successful trial to ReasoningBank for future learning
     */
    private storeSuccessfulTrial;
    /**
     * Store failed trial to learn from mistakes
     */
    private storeFailedTrial;
    /**
     * Get learning insights for this optimizer
     */
    getLearningInsights(): Promise<import("../storage/reasoning-bank.js").LearningInsights>;
    /**
     * Close ReasoningBank connections
     */
    close(): void;
}
//# sourceMappingURL=reasoningbank-optimizer.d.ts.map