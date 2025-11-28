import { PromptGenerationConfig, SyntheticResult } from '../schemas/prompt-schema.js';
import { ModelRouter } from './model-router.js';
/**
 * Optimized synthetic prompt generator
 * Features:
 * - Stream processing
 * - Model routing
 * - Caching
 * - Token tracking
 */
export declare class SyntheticGenerator {
    private router;
    private cache;
    private streamProcessor;
    private metrics;
    constructor(router: ModelRouter, cacheConfig?: {
        maxSize: number;
        ttl: number;
        strategy: "lru";
    });
    /**
     * Generate synthetic prompts
     * @param config - Generation configuration
     */
    generate(config: PromptGenerationConfig): Promise<SyntheticResult>;
    /**
     * Stream synthetic prompts
     * @param config - Generation configuration
     */
    generateStream(config: PromptGenerationConfig): AsyncGenerator<string>;
    private getCacheKey;
    private generatePrompts;
    private parseResponse;
    private updateMetrics;
    /**
     * Get generator statistics
     */
    getStats(): {
        metrics: {
            requests: number;
            tokens: number;
            latency: number;
            errors: number;
        };
        cache: {
            size: number;
            hits: number;
            misses: number;
            evictions: number;
            hitRate: number;
            maxSize: number;
            strategy: "lru" | "lfu" | "fifo";
        };
    };
    /**
     * Reset generator state
     */
    reset(): void;
}
//# sourceMappingURL=generator.d.ts.map