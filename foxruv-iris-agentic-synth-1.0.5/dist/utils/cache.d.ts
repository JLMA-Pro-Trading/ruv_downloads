import { CacheConfig } from '../schemas/prompt-schema.js';
/**
 * Context caching implementation with LRU/LFU/FIFO strategies
 */
export declare class ContextCache<T = any> {
    private cache;
    private config;
    private accessOrder;
    constructor(config?: Partial<CacheConfig>);
    /**
     * Get value from cache
     */
    get(key: string): T | undefined;
    /**
     * Set value in cache
     */
    set(key: string, value: T): void;
    /**
     * Check if key exists in cache
     */
    has(key: string): boolean;
    /**
     * Clear cache
     */
    clear(): void;
    /**
     * Get cache statistics
     */
    getStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        avgHits: number;
        oldestEntry: number;
    };
    /**
     * Evict based on strategy
     */
    private evict;
    /**
     * Update access order for LRU
     */
    private updateAccessOrder;
    /**
     * Remove from access order
     */
    private removeFromAccessOrder;
    /**
     * Find least frequently used key
     */
    private findLeastFrequentlyUsed;
    /**
     * Find oldest entry
     */
    private findOldest;
    /**
     * Calculate hit rate
     */
    private calculateHitRate;
}
/**
 * Create cache key from parameters
 */
export declare function createCacheKey(...parts: (string | number | boolean)[]): string;
//# sourceMappingURL=cache.d.ts.map