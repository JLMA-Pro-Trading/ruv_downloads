import { CacheConfig } from '../schemas/prompt-schema.js';
export declare class PerformanceCache<K = string, V = any> {
    private cache;
    private head;
    private tail;
    private readonly maxSize;
    private readonly ttl;
    private readonly strategy;
    private hits;
    private misses;
    private evictions;
    private frequencies?;
    constructor(config: CacheConfig);
    /**
     * Get value from cache with O(1) complexity
     * @param key - Cache key
     * @returns Cached value or undefined
     */
    get(key: K): V | undefined;
    /**
     * Set value in cache with O(1) complexity
     * @param key - Cache key
     * @param value - Value to cache
     */
    set(key: K, value: V): void;
    /**
     * Delete key from cache
     * @param key - Key to delete
     */
    delete(key: K): boolean;
    /**
     * Clear all cached entries
     */
    clear(): void;
    /**
     * Get cache statistics for monitoring
     */
    getStats(): {
        size: number;
        hits: number;
        misses: number;
        evictions: number;
        hitRate: number;
        maxSize: number;
        strategy: "lru" | "lfu" | "fifo";
    };
    /**
     * Get all keys currently in cache
     */
    keys(): K[];
    /**
     * Check if key exists in cache
     */
    has(key: K): boolean;
    private moveToHead;
    private addToHead;
    private removeNode;
    private evict;
}
/**
 * Simple memoization decorator for expensive operations
 * Uses WeakMap to avoid memory leaks
 */
export declare function memoize<T extends (...args: any[]) => any>(fn: T, keyFn?: (...args: Parameters<T>) => string): T;
//# sourceMappingURL=cache.d.ts.map