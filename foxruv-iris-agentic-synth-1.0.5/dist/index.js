/**
 * AgenticSynth - Optimized Synthetic Prompt Generation
 *
 * Main entry point with lazy loading for optimal bundle size
 */
// Export types and schemas (no runtime cost)
export * from './schemas/prompt-schema.js';
/**
 * Lazy-loaded cache module
 * Only loaded when cache is needed
 */
export async function createCache(config) {
    const { PerformanceCache } = await import('./core/cache.js');
    return new PerformanceCache(config);
}
/**
 * Lazy-loaded genetic optimizer
 * Only loaded when evolution is needed
 */
export async function createGeneticOptimizer(config) {
    const { GeneticOptimizer } = await import('./core/genetic-optimizer.js');
    return new GeneticOptimizer(config);
}
/**
 * Lazy-loaded stream processor
 * Only loaded when streaming is enabled
 */
export async function createStreamProcessor(options) {
    const { StreamProcessor } = await import('./core/stream-processor.js');
    return new StreamProcessor(options);
}
/**
 * Lazy-loaded model router
 * Only loaded when model routing is needed
 */
export async function createModelRouter(models, primaryModel, fallbackModels, config) {
    const { ModelRouter } = await import('./core/model-router.js');
    return new ModelRouter(models, primaryModel, fallbackModels, config);
}
/**
 * Main AgenticSynth class with optimized initialization
 */
export class AgenticSynth {
    config;
    cache;
    optimizer;
    stream;
    router;
    constructor(config) {
        this.config = config;
    }
    /**
     * Initialize with lazy loading of required components
     */
    async initialize() {
        const promises = [];
        // Load only what's needed based on configuration
        if (this.config.cache?.enabled) {
            promises.push(createCache(this.config.cache).then((cache) => {
                this.cache = cache;
            }));
        }
        if (this.config.streaming) {
            promises.push(createStreamProcessor().then((stream) => {
                this.stream = stream;
            }));
        }
        if (this.config.models) {
            promises.push(createModelRouter(this.config.models, this.config.primaryModel, this.config.fallbackModels).then((router) => {
                this.router = router;
            }));
        }
        // Parallel initialization for performance
        await Promise.all(promises);
        return this;
    }
    /**
     * Generate synthetic prompts with optimized execution
     */
    async generate(config) {
        // Check cache first
        if (this.cache) {
            const cacheKey = `generate:${config.seedPrompt}:${config.count}`;
            const cached = this.cache.get(cacheKey);
            if (cached)
                return cached;
        }
        // Generation logic would go here
        const results = await this.performGeneration(config);
        // Cache results
        if (this.cache) {
            const cacheKey = `generate:${config.seedPrompt}:${config.count}`;
            this.cache.set(cacheKey, results);
        }
        return results;
    }
    /**
     * Evolve prompts using genetic algorithm
     */
    async evolve(config) {
        // Lazy load optimizer on demand
        if (!this.optimizer) {
            this.optimizer = await createGeneticOptimizer(config);
        }
        // Fitness function
        const fitnessFunction = async (prompt) => {
            // Simplified fitness - would be replaced with actual evaluation
            return prompt.length * Math.random();
        };
        return this.optimizer.evolve(config.seedPrompts, fitnessFunction);
    }
    /**
     * Stream generation for large outputs
     */
    async *streamGenerate(seedPrompt) {
        if (!this.stream) {
            throw new Error('Streaming not enabled in configuration');
        }
        // Stream generation logic would go here
        const mockStream = this.createMockStream(seedPrompt);
        yield* this.stream.process(mockStream);
    }
    /**
     * Get performance statistics
     */
    getStats() {
        return {
            cache: this.cache?.getStats(),
            optimizer: this.optimizer?.getStats(),
            stream: this.stream?.getStats(),
            router: this.router?.getStats(),
        };
    }
    // Private helper methods
    async performGeneration(config) {
        // Simplified generation - would use actual model routing
        const prompts = Array.from({ length: config.count }, (_, i) => ({
            prompt: `${config.seedPrompt} variation ${i + 1}`,
            metadata: {
                index: i,
                timestamp: Date.now(),
            },
        }));
        return {
            prompts: prompts.map(p => p.prompt),
            metadata: {
                seedPrompt: config.seedPrompt,
                count: config.count,
                model: config.model || 'mock-model',
                timestamp: Date.now(),
                latency: Math.random() * 100, // Mock latency
                tokensUsed: config.count * 10, // Mock tokens
            }
        };
    }
    async *createMockStream(seedPrompt) {
        // Mock stream for demonstration
        for (let i = 0; i < 10; i++) {
            yield `Chunk ${i}: ${seedPrompt}`;
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
}
/**
 * Create optimized AgenticSynth instance
 */
export async function createAgenticSynth(config) {
    const synth = new AgenticSynth(config);
    await synth.initialize();
    return synth;
}
// Default export for convenience
export default AgenticSynth;
//# sourceMappingURL=index.js.map