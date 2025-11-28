/**
 * TypeScript DSPy Optimizer
 *
 * Native TypeScript implementation using @ts-dspy/core.
 * No Python service required - runs entirely in TypeScript.
 *
 * Features:
 * - Type-safe signatures with validation
 * - Chain-of-thought reasoning
 * - Automatic prompt optimization
 * - Works with Anthropic, OpenAI, or custom LMs
 *
 * @module optimizers/ts-dspy-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer, type SearchSpace, type EvaluationFunction, type OptimizationOptions, type OptimizationResult, type ParameterConfiguration, type OptimizerMetadata, type OptimizerConfig } from './base-optimizer.js';
import type { ILanguageModel, LLMCallOptions, ChatMessage, UsageStats, ModelCapabilities } from '@ts-dspy/core';
export interface AnthropicConfig {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}
/**
 * Anthropic Claude adapter for ts-dspy
 */
export declare class AnthropicLM implements ILanguageModel {
    private apiKey;
    private model;
    private maxTokens;
    private temperature;
    private usage;
    constructor(config?: AnthropicConfig);
    generate(prompt: string, options?: LLMCallOptions): Promise<string>;
    generateStructured<T>(prompt: string, _schema: any, options?: LLMCallOptions): Promise<T>;
    chat(messages: ChatMessage[], options?: LLMCallOptions): Promise<string>;
    getUsage(): UsageStats;
    resetUsage(): void;
    getCapabilities(): ModelCapabilities;
    getModelName(): string;
    setModel(model: string): void;
    isHealthy(): Promise<boolean>;
}
export interface TsDspyOptimizerConfig extends OptimizerConfig {
    /** Language model to use */
    lm?: ILanguageModel;
    /** Anthropic config (if not providing lm) */
    anthropicConfig?: AnthropicConfig;
    /** Use chain-of-thought reasoning */
    useChainOfThought?: boolean;
    /** Number of bootstrap demonstrations */
    numBootstrapDemos?: number;
    /** Temperature for exploration */
    explorationTemperature?: number;
}
export declare class TsDspyOptimizer extends BaseOptimizer {
    private lm;
    private useChainOfThought;
    private numBootstrapDemos;
    private explorationTemperature;
    constructor(config?: TsDspyOptimizerConfig);
    healthCheck(): Promise<boolean>;
    getMetadata(): OptimizerMetadata;
    optimize(searchSpace: SearchSpace, evaluationFn: EvaluationFunction, options?: OptimizationOptions): Promise<OptimizationResult>;
    resume(_checkpointPath: string): Promise<OptimizationResult>;
    getBestConfiguration(): Promise<ParameterConfiguration | null>;
    private extractSignatureConfig;
    private extractTrainingData;
    private generateConfiguration;
    private generatePromptTemplate;
}
//# sourceMappingURL=ts-dspy-optimizer.d.ts.map