/**
 * Flexible LM Provider Architecture for @ax-llm/ax
 *
 * Supports multiple model providers with environment-based configuration:
 * - Anthropic Claude Sonnet 4.5 (production default)
 * - OpenAI GPT-4 (backup)
 * - LM Studio local models (development/testing)
 *
 * @module lm-provider
 */
export type ModelProvider = 'anthropic' | 'openai' | 'lmstudio';
export interface LMProviderConfig {
    /** Provider to use (defaults to anthropic for production) */
    provider: ModelProvider;
    /** Model name */
    model: string;
    /** API key (not needed for LM Studio) */
    apiKey?: string;
    /** Base URL for custom endpoints (LM Studio) */
    baseURL?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Performance tracking */
    trackPerformance?: boolean;
}
export interface PerformanceMetrics {
    provider: ModelProvider;
    model: string;
    averageLatencyMs: number;
    totalRequests: number;
    successRate: number;
    qualityScore?: number;
}
export declare class LMProviderManager {
    private providers;
    private performanceMetrics;
    private config;
    constructor(config?: Partial<LMProviderConfig>);
    /**
     * Get default configuration from environment variables
     */
    private getDefaultConfig;
    /**
     * Get default model for each provider
     */
    private getDefaultModelForProvider;
    /**
     * Get the primary provider based on configuration
     */
    getProvider(): any;
    /**
     * Get a specific provider by name
     */
    getProviderByName(name: ModelProvider): any | undefined;
    /**
     * Get all available providers
     */
    getAvailableProviders(): ModelProvider[];
    /**
     * Switch to a different provider
     */
    switchProvider(provider: ModelProvider): void;
    /**
     * Record performance metrics for a provider
     */
    recordPerformance(provider: ModelProvider, latencyMs: number, success: boolean, qualityScore?: number): void;
    /**
     * Get performance metrics for a provider
     */
    getPerformanceMetrics(provider?: ModelProvider): PerformanceMetrics | PerformanceMetrics[];
    /**
     * Get performance comparison across all providers
     */
    compareProviders(): {
        fastest: ModelProvider;
        highestQuality: ModelProvider | null;
        mostReliable: ModelProvider;
        metrics: PerformanceMetrics[];
    };
}
/**
 * Get or create the LM provider manager instance
 */
export declare function getLMProvider(config?: Partial<LMProviderConfig>): LMProviderManager;
/**
 * Reset the provider instance (useful for testing)
 */
export declare function resetLMProvider(): void;
//# sourceMappingURL=lm-provider.d.ts.map