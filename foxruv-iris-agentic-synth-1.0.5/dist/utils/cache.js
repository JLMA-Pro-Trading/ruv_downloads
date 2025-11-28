/**
 * Context caching implementation with LRU/LFU/FIFO strategies
 */
export class ContextCache {
    cache;
    config;
    accessOrder;
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            ttl: config.ttl ?? 3600000,
            maxSize: config.maxSize ?? 1000,
            strategy: config.strategy ?? 'lru',
        };
        this.cache = new Map();
        this.accessOrder = [];
    }
    /**
     * Get value from cache
     */
    get(key) {
        if (!this.config.enabled)
            return undefined;
        const entry = this.cache.get(key);
        if (!entry)
            return undefined;
        // Check TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            return undefined;
        }
        // Update access tracking
        entry.hits++;
        this.updateAccessOrder(key);
        return entry.value;
    }
    /**
     * Set value in cache
     */
    set(key, value) {
        if (!this.config.enabled)
            return;
        // Evict if necessary
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            this.evict();
        }
        const entry = {
            value,
            timestamp: Date.now(),
            hits: 0,
        };
        this.cache.set(key, entry);
        this.updateAccessOrder(key);
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry)
            return false;
        // Check TTL
        if (Date.now() - entry.timestamp > this.config.ttl) {
            this.cache.delete(key);
            this.removeFromAccessOrder(key);
            return false;
        }
        return true;
    }
    /**
     * Clear cache
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const entries = Array.from(this.cache.entries());
        return {
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRate: this.calculateHitRate(),
            avgHits: entries.reduce((sum, [, entry]) => sum + entry.hits, 0) / (entries.length || 1),
            oldestEntry: Math.min(...entries.map(([, entry]) => entry.timestamp)),
        };
    }
    /**
     * Evict based on strategy
     */
    evict() {
        let keyToEvict;
        switch (this.config.strategy) {
            case 'lru':
                keyToEvict = this.accessOrder[0];
                break;
            case 'lfu':
                keyToEvict = this.findLeastFrequentlyUsed();
                break;
            case 'fifo':
                keyToEvict = this.findOldest();
                break;
        }
        if (keyToEvict) {
            this.cache.delete(keyToEvict);
            this.removeFromAccessOrder(keyToEvict);
        }
    }
    /**
     * Update access order for LRU
     */
    updateAccessOrder(key) {
        this.removeFromAccessOrder(key);
        this.accessOrder.push(key);
    }
    /**
     * Remove from access order
     */
    removeFromAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }
    /**
     * Find least frequently used key
     */
    findLeastFrequentlyUsed() {
        let minHits = Infinity;
        let leastUsedKey;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.hits < minHits) {
                minHits = entry.hits;
                leastUsedKey = key;
            }
        }
        return leastUsedKey;
    }
    /**
     * Find oldest entry
     */
    findOldest() {
        let oldestTime = Infinity;
        let oldestKey;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.timestamp < oldestTime) {
                oldestTime = entry.timestamp;
                oldestKey = key;
            }
        }
        return oldestKey;
    }
    /**
     * Calculate hit rate
     */
    calculateHitRate() {
        const entries = Array.from(this.cache.values());
        const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
        const totalAccess = entries.length;
        return totalAccess > 0 ? totalHits / totalAccess : 0;
    }
}
/**
 * Create cache key from parameters
 */
export function createCacheKey(...parts) {
    return parts.map(p => String(p)).join(':');
}
//# sourceMappingURL=cache.js.map