import { Module } from '../../src/core/module';
export interface TextInput {
    text: string;
}
export interface TextOutput {
    generated: string;
    quality: number;
}
export interface RewardOutput {
    reward: number;
    feedback: string;
}
export interface GRPOConfig {
    learningRate: number;
    clipEpsilon: number;
    miniBatchSize: number;
    epochs: number;
    entropyCoef: number;
}
export interface TrainingMetrics {
    batchId: number;
    avgReward: number;
    policyLoss: number;
    valueLoss: number;
}
export interface TopicKnowledge {
    keywords: string[];
    templates: string[];
    relationships: Record<string, string[]>;
}
export interface DomainConfig {
    knowledge: Record<string, TopicKnowledge>;
    defaultQuality?: number;
    minQuality?: number;
    maxQuality?: number;
}
/**
 * Text generation module that can be fine-tuned
 */
export declare class TextGeneratorModule extends Module<TextInput, TextOutput> {
    private weights;
    private knowledge;
    private options;
    constructor(options: {
        name: string;
        promptTemplate: (input: TextInput) => string;
        domainConfig?: DomainConfig;
    });
    private findRelevantDomain;
    run(input: TextInput): Promise<TextOutput>;
    getLogProbabilities(output: TextOutput): Promise<number[]>;
    updateWeights(gradients: number[]): Promise<void>;
}
/**
 * Reward evaluation module
 */
export declare class RewardModule extends Module<TextOutput, RewardOutput> {
    constructor(options: {
        name: string;
        promptTemplate: (input: TextOutput) => string;
    });
    run(input: TextOutput): Promise<RewardOutput>;
}
/**
 * GRPO Optimizer implementation
 */
export declare class GRPOOptimizer {
    private config;
    private currentStep;
    constructor(config: Partial<GRPOConfig>);
    update(module: TextGeneratorModule, outputs: TextOutput[], rewards: RewardOutput[]): Promise<TrainingMetrics>;
    private normalizeRewards;
}
/**
 * Training Manager handles the training process
 */
export declare class TrainingManager {
    private module;
    private optimizer;
    private rewardModule;
    private onBatchComplete?;
    constructor(config: {
        module: TextGeneratorModule;
        optimizer: GRPOOptimizer;
        rewardModule: RewardModule;
        onBatchComplete?: (metrics: TrainingMetrics) => void;
    });
    trainOnBatch(batch: TextInput[]): Promise<TrainingMetrics>;
}
/**
 * Create and configure a fine-tuned model
 */
export declare function createFineTunedModel(trainingData: {
    input: TextInput;
    output?: TextOutput;
}[], config: {
    basePrompt: string;
    rewardPrompt: string;
    optimizerConfig: Partial<GRPOConfig>;
}): Promise<TextGeneratorModule>;
