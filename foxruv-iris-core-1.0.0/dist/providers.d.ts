/**
 * LM Provider implementations for @iris/core
 */
import type { ModelProvider, LMProviderConfig, PerformanceMetrics, Signature } from './types.js';
export declare class ClaudeProvider {
    private apiKey;
    private model;
    constructor(apiKey: string, model?: string);
    predict(_signature: Signature, input: Record<string, any>, temperature?: number): Promise<Record<string, any>>;
}
export declare class Qwen3Provider {
    private endpoint;
    private model;
    private maxConcurrency;
    private requestQueue;
    private activeRequests;
    constructor(endpoint?: string, model?: string, maxConcurrency?: number);
    private formatPrompt;
    private parseResponse;
    predict(signature: Signature, input: Record<string, any>, customInstructions?: string, temperature?: number, maxTokens?: number, schema?: Record<string, any>): Promise<Record<string, any>>;
    private processQueue;
    private queuedPredict;
    batchPredict(signature: Signature, inputs: Array<Record<string, any>>, customInstructions?: string, temperature?: number, maxTokens?: number): Promise<Array<Record<string, any>>>;
    healthCheck(): Promise<boolean>;
}
export declare class LMProviderManager {
    private providers;
    private performanceMetrics;
    private config;
    constructor(config?: Partial<LMProviderConfig>);
    private getDefaultConfig;
    private getDefaultModelForProvider;
    getProvider(): any;
    getProviderByName(name: ModelProvider): any | undefined;
    getAvailableProviders(): ModelProvider[];
    switchProvider(provider: ModelProvider): void;
    recordPerformance(provider: ModelProvider, latencyMs: number, success: boolean, qualityScore?: number): void;
    getPerformanceMetrics(provider?: ModelProvider): PerformanceMetrics | PerformanceMetrics[];
    compareProviders(): {
        fastest: ModelProvider;
        highestQuality: ModelProvider | null;
        mostReliable: ModelProvider;
        metrics: PerformanceMetrics[];
    };
}
//# sourceMappingURL=providers.d.ts.map