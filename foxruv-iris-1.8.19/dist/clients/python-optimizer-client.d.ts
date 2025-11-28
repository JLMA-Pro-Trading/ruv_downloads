/**
 * Python MIPROv2 Optimizer Client
 *
 * TypeScript client for communicating with the Python DSPy optimizer service.
 * Used ONLY during training to optimize expert prompts via MIPROv2.
 *
 * Architecture:
 * - Training: TypeScript → Python MIPROv2 service → Optimized prompts
 * - Production: TypeScript loads optimized prompts from AgentDB (no Python)
 *
 * @module python-optimizer-client
 * @version 1.0.0
 */
export interface SignatureField {
    name: string;
    type: string;
    description?: string;
    required?: boolean;
}
export interface SignatureDefinition {
    inputs: SignatureField[];
    outputs: SignatureField[];
    description?: string;
}
export interface TrainingExample {
    inputs: Record<string, any>;
    expected_outputs: Record<string, any>;
    quality_score?: number;
    sample_id?: string;
}
export interface OptimizationConfig {
    num_candidates?: number;
    init_temperature?: number;
    num_trials?: number;
    max_bootstrapped_demos?: number;
    max_labeled_demos?: number;
    verbose?: boolean;
}
export interface LMConfig {
    provider?: 'anthropic' | 'openai';
    model?: string;
    api_key?: string;
}
export interface OptimizationRequest {
    expert_role: string;
    signature: SignatureDefinition;
    training_data: TrainingExample[];
    config?: OptimizationConfig;
    lm_config?: LMConfig;
}
export interface OptimizationResult {
    expert_role: string;
    optimized_signature: {
        inputs: SignatureField[];
        outputs: SignatureField[];
        description?: string;
    };
    few_shot_examples: Array<{
        inputs: Record<string, any>;
        outputs: Record<string, any>;
    }>;
    performance_metrics: {
        quality_score: number;
        baseline_quality: number;
        num_examples: number;
        num_demos: number;
    };
    quality_before: number;
    quality_after: number;
    improvement: number;
    version: string;
    timestamp: string;
    trials_completed: number;
}
export declare class PythonOptimizerClient {
    private baseUrl;
    private timeout;
    constructor(config?: {
        baseUrl?: string;
        timeout?: number;
    });
    /**
     * Check if Python optimizer service is available
     */
    healthCheck(): Promise<boolean>;
    /**
     * Run MIPROv2 optimization via Python service
     */
    optimize(request: OptimizationRequest): Promise<OptimizationResult>;
    /**
     * Get service information
     */
    getServiceInfo(): Promise<any>;
}
/**
 * Create default Python optimizer client
 */
export declare function createOptimizerClient(baseUrl?: string): PythonOptimizerClient;
/**
 * Check if Python optimizer is available
 */
export declare function isOptimizerAvailable(baseUrl?: string): Promise<boolean>;
//# sourceMappingURL=python-optimizer-client.d.ts.map