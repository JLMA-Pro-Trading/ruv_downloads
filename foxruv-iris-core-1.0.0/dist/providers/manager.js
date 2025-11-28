/**
 * Flexible LM Provider Architecture for @iris/core
 *
 * Supports multiple model providers with environment-based configuration:
 * - Anthropic Claude Sonnet 4.5 (production default)
 * - OpenAI GPT-4 (backup)
 * - LM Studio local models (development/testing)
 *
 * Pure Node.js implementation with no external dependencies
 *
 * @module providers/manager
 */
// ============================================================================
// LM Provider Manager
// ============================================================================
export class LMProviderManager {
    providers = new Map();
    performanceMetrics = new Map();
    config;
    constructor(config) {
        this.config = this.getDefaultConfig(config);
        // Note: Actual provider initialization requires provider instances
        // This is a base class that can be extended with actual providers
    }
    /**
     * Get default configuration from environment variables
     */
    getDefaultConfig(overrides) {
        // Check environment to determine default provider
        const localModelEnabled = process.env.LOCAL_MODEL_ENABLED === 'true';
        const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        let defaultProvider = 'anthropic';
        if (localModelEnabled) {
            defaultProvider = 'lmstudio';
        }
        else if (!hasAnthropic && hasOpenAI) {
            defaultProvider = 'openai';
        }
        return {
            provider: defaultProvider,
            model: this.getDefaultModelForProvider(defaultProvider),
            debug: process.env.NODE_ENV === 'development',
            trackPerformance: true,
            ...overrides
        };
    }
    /**
     * Get default model for each provider
     */
    getDefaultModelForProvider(provider) {
        switch (provider) {
            case 'anthropic':
                return 'claude-sonnet-4-5-20250929';
            case 'openai':
                return 'gpt-4-turbo-preview';
            case 'lmstudio':
                return 'local-model'; // LM Studio serves whatever model is loaded
            default:
                return 'claude-sonnet-4-5-20250929';
        }
    }
    /**
     * Get the primary provider based on configuration
     */
    getProvider() {
        const provider = this.providers.get(this.config.provider);
        if (!provider) {
            throw new Error(`Provider ${this.config.provider} not initialized. Check API keys.`);
        }
        return provider;
    }
    /**
     * Get a specific provider by name
     */
    getProviderByName(name) {
        return this.providers.get(name);
    }
    /**
     * Get all available providers
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    /**
     * Switch to a different provider
     */
    switchProvider(provider) {
        if (!this.providers.has(provider)) {
            throw new Error(`Provider ${provider} not available. Initialize it first.`);
        }
        this.config.provider = provider;
        console.log(`🔄 Switched to ${provider} provider`);
    }
    /**
     * Record performance metrics for a provider
     */
    recordPerformance(provider, latencyMs, success, qualityScore) {
        if (!this.config.trackPerformance)
            return;
        const metrics = this.performanceMetrics.get(provider);
        if (!metrics)
            return;
        const totalRequests = metrics.totalRequests + 1;
        const averageLatencyMs = (metrics.averageLatencyMs * metrics.totalRequests + latencyMs) / totalRequests;
        const successRate = (metrics.successRate * metrics.totalRequests + (success ? 1 : 0)) / totalRequests;
        this.performanceMetrics.set(provider, {
            ...metrics,
            averageLatencyMs,
            totalRequests,
            successRate,
            qualityScore: qualityScore ?? metrics.qualityScore
        });
    }
    /**
     * Get performance metrics for a provider
     */
    getPerformanceMetrics(provider) {
        if (provider) {
            const metrics = this.performanceMetrics.get(provider);
            if (!metrics) {
                throw new Error(`No metrics available for ${provider}`);
            }
            return metrics;
        }
        return Array.from(this.performanceMetrics.values());
    }
    /**
     * Get performance comparison across all providers
     */
    compareProviders() {
        const metrics = Array.from(this.performanceMetrics.values());
        if (metrics.length === 0) {
            throw new Error('No performance data available yet');
        }
        const fastest = metrics.reduce((prev, curr) => curr.averageLatencyMs < prev.averageLatencyMs ? curr : prev).provider;
        const mostReliable = metrics.reduce((prev, curr) => curr.successRate > prev.successRate ? curr : prev).provider;
        const withQuality = metrics.filter(m => m.qualityScore !== undefined);
        const highestQuality = withQuality.length > 0
            ? withQuality.reduce((prev, curr) => (curr.qualityScore ?? 0) > (prev.qualityScore ?? 0) ? curr : prev).provider
            : null;
        return {
            fastest,
            highestQuality,
            mostReliable,
            metrics
        };
    }
}
// ============================================================================
// Singleton Instance with Environment-Based Configuration
// ============================================================================
let _instance = null;
/**
 * Get or create the LM provider manager instance
 */
export function getLMProvider(config) {
    if (!_instance) {
        _instance = new LMProviderManager(config);
    }
    return _instance;
}
/**
 * Reset the provider instance (useful for testing)
 */
export function resetLMProvider() {
    _instance = null;
}
//# sourceMappingURL=manager.js.map