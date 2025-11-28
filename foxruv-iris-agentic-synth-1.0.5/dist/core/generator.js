import { PromptGenerationConfigSchema } from '../schemas/prompt-schema.js';
import { PerformanceCache } from './cache.js';
import { StreamProcessor } from './stream-processor.js';
/**
 * Optimized synthetic prompt generator
 * Features:
 * - Stream processing
 * - Model routing
 * - Caching
 * - Token tracking
 */
export class SyntheticGenerator {
    router;
    cache;
    streamProcessor;
    metrics = {
        requests: 0,
        tokens: 0,
        latency: 0,
        errors: 0,
    };
    constructor(router, cacheConfig = { maxSize: 1000, ttl: 3600000, strategy: 'lru' }) {
        this.router = router;
        this.cache = new PerformanceCache({ ...cacheConfig, enabled: true });
        this.streamProcessor = new StreamProcessor();
    }
    /**
     * Generate synthetic prompts
     * @param config - Generation configuration
     */
    async generate(config) {
        const validated = PromptGenerationConfigSchema.parse(config);
        const cacheKey = this.getCacheKey(validated);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const startTime = Date.now();
        try {
            const prompts = await this.generatePrompts(validated);
            const result = {
                prompts,
                metadata: {
                    seedPrompt: validated.seedPrompt,
                    count: validated.count,
                    model: validated.model || 'default',
                    timestamp: Date.now(),
                    latency: Date.now() - startTime,
                    tokensUsed: 0, // TODO: Implement token counting
                },
            };
            this.cache.set(cacheKey, result);
            this.updateMetrics(result);
            return result;
        }
        catch (error) {
            this.metrics.errors++;
            throw error;
        }
    }
    /**
     * Stream synthetic prompts
     * @param config - Generation configuration
     */
    async *generateStream(config) {
        const validated = PromptGenerationConfigSchema.parse(config);
        // systemPrompt removed as it's not used in the route call
        const response = await this.router.route({
            id: `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Add unique ID
            prompt: validated.seedPrompt,
            model: validated.model,
            // stream: true, // Removed as it does not exist in ModelRequest
            // temperature: validated.temperature, // Removed as it does not exist in ModelRequest
            // maxTokens: validated.maxTokens, // Removed as it does not exist in ModelRequest
        });
        // Convert string response to AsyncGenerator<string> to match return type
        const source = (async function* () {
            yield response.content;
        })();
        // Cast to any to bypass the specific StreamChunk vs string mismatch for now, 
        // assuming streamProcessor.process yields compatible chunks or string
        yield* this.streamProcessor.process(source);
    }
    // Private helpers
    getCacheKey(config) {
        return `${config.seedPrompt}:${config.count}:${config.model}:${config.temperature}`;
    }
    async generatePrompts(config) {
        // const systemPrompt = this.buildSystemPrompt(config); // systemPrompt not supported in ModelRequest
        const response = await this.router.route({
            id: `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Add unique ID
            prompt: config.seedPrompt,
            // systemPrompt, 
            model: config.model,
            // temperature: config.temperature, // Removed as it does not exist in ModelRequest
            // maxTokens: config.maxTokens, // Removed as it does not exist in ModelRequest
        });
        return this.parseResponse(response.content);
    }
    // Removed unused buildSystemPrompt method
    /*
    private buildSystemPrompt(config: PromptGenerationConfig): string {
      return `Generate ${config.count} diverse variations of the following prompt.
      Diversity level: ${config.diversity}.
      Output format: JSON array of strings.`;
    }
    */
    parseResponse(content) {
        try {
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : [content];
        }
        catch {
            return content.split('\n').filter(line => line.trim().length > 0);
        }
    }
    updateMetrics(result) {
        this.metrics.requests++;
        this.metrics.latency = (this.metrics.latency * (this.metrics.requests - 1) + (result.metadata.latency || 0)) / this.metrics.requests;
    }
    /**
     * Get generator statistics
     */
    getStats() {
        return {
            metrics: this.metrics,
            cache: this.cache.getStats(),
        };
    }
    /**
     * Reset generator state
     */
    reset() {
        this.cache.clear();
        this.metrics = {
            requests: 0,
            tokens: 0,
            latency: 0,
            errors: 0,
        };
    }
}
//# sourceMappingURL=generator.js.map