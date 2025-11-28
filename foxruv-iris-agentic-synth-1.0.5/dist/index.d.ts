/**
 * AgenticSynth - Optimized Synthetic Prompt Generation
 *
 * Main entry point with lazy loading for optimal bundle size
 */
import { PromptGenerationConfig, EvolutionConfig, SyntheticResult } from './schemas/prompt-schema.js';
export * from './schemas/prompt-schema.js';
export type { PerformanceCache } from './core/cache.js';
export type { GeneticOptimizer } from './core/genetic-optimizer.js';
export type { StreamProcessor, StreamChunk, StreamOptions } from './core/stream-processor.js';
export type { ModelRouter, RouterConfig, ModelRequest, ModelResponse } from './core/model-router.js';
/**
 * Lazy-loaded cache module
 * Only loaded when cache is needed
 */
export declare function createCache(config: any): Promise<import("./core/cache.js").PerformanceCache<string, any>>;
/**
 * Lazy-loaded genetic optimizer
 * Only loaded when evolution is needed
 */
export declare function createGeneticOptimizer(config: any): Promise<import("./core/genetic-optimizer.js").GeneticOptimizer>;
/**
 * Lazy-loaded stream processor
 * Only loaded when streaming is enabled
 */
export declare function createStreamProcessor(options?: any): Promise<import("./core/stream-processor.js").StreamProcessor>;
/**
 * Lazy-loaded model router
 * Only loaded when model routing is needed
 */
export declare function createModelRouter(models: any[], primaryModel: string, fallbackModels?: string[], config?: any): Promise<import("./core/model-router.js").ModelRouter>;
/**
 * Main AgenticSynth class with optimized initialization
 */
export declare class AgenticSynth {
    private config;
    private cache?;
    private optimizer?;
    private stream?;
    private router?;
    constructor(config: any);
    /**
     * Initialize with lazy loading of required components
     */
    initialize(): Promise<this>;
    /**
     * Generate synthetic prompts with optimized execution
     */
    generate(config: PromptGenerationConfig): Promise<SyntheticResult>;
    /**
     * Evolve prompts using genetic algorithm
     */
    evolve(config: EvolutionConfig): Promise<any>;
    /**
     * Stream generation for large outputs
     */
    streamGenerate(seedPrompt: string): AsyncGenerator<any, void, any>;
    /**
     * Get performance statistics
     */
    getStats(): {
        cache: any;
        optimizer: any;
        stream: any;
        router: any;
    };
    private performGeneration;
    private createMockStream;
}
/**
 * Create optimized AgenticSynth instance
 */
export declare function createAgenticSynth(config: any): Promise<AgenticSynth>;
export default AgenticSynth;
//# sourceMappingURL=index.d.ts.map