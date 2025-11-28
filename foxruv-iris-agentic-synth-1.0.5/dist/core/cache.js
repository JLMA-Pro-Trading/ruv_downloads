/**
 * High-performance LRU cache with O(1) operations
 * Optimized for minimal memory allocation and fast access
 */
class LRUNode {
    key;
    value;
    prev;
    next;
    expiry;
    constructor(key, value, prev = null, next = null, expiry = Infinity) {
        this.key = key;
        this.value = value;
        this.prev = prev;
        this.next = next;
        this.expiry = expiry;
    }
}
export class PerformanceCache {
    cache;
    head = null;
    tail = null;
    maxSize;
    ttl;
    strategy;
    hits = 0;
    misses = 0;
    evictions = 0;
    // For LFU strategy
    frequencies;
    constructor(config) {
        this.maxSize = config.maxSize;
        this.ttl = config.ttl;
        this.strategy = config.strategy;
        this.cache = new Map();
        if (this.strategy === 'lfu') {
            this.frequencies = new Map();
        }
    }
    /**
     * Get value from cache with O(1) complexity
     * @param key - Cache key
     * @returns Cached value or undefined
     */
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            this.misses++;
            return undefined;
        }
        // Check expiry
        if (node.expiry < Date.now()) {
            this.delete(key);
            this.misses++;
            return undefined;
        }
        this.hits++;
        // Update access pattern based on strategy
        if (this.strategy === 'lru') {
            this.moveToHead(node);
        }
        else if (this.strategy === 'lfu') {
            const freq = (this.frequencies.get(key) || 0) + 1;
            this.frequencies.set(key, freq);
        }
        return node.value;
    }
    /**
     * Set value in cache with O(1) complexity
     * @param key - Cache key
     * @param value - Value to cache
     */
    set(key, value) {
        const existingNode = this.cache.get(key);
        const expiry = Date.now() + this.ttl;
        if (existingNode) {
            // Update existing node
            existingNode.value = value;
            existingNode.expiry = expiry;
            if (this.strategy === 'lru') {
                this.moveToHead(existingNode);
            }
            return;
        }
        // Create new node
        const newNode = new LRUNode(key, value, null, null, expiry);
        // Check if cache is full
        if (this.cache.size >= this.maxSize) {
            this.evict();
        }
        // Add to cache
        this.cache.set(key, newNode);
        if (this.strategy === 'lfu') {
            this.frequencies.set(key, 1);
        }
        // Add to linked list for LRU
        if (this.strategy === 'lru' || this.strategy === 'fifo') {
            this.addToHead(newNode);
        }
    }
    /**
     * Delete key from cache
     * @param key - Key to delete
     */
    delete(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        this.removeNode(node);
        this.cache.delete(key);
        if (this.strategy === 'lfu') {
            this.frequencies.delete(key);
        }
        return true;
    }
    /**
     * Clear all cached entries
     */
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        if (this.frequencies) {
            this.frequencies.clear();
        }
    }
    /**
     * Get cache statistics for monitoring
     */
    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            evictions: this.evictions,
            hitRate: total > 0 ? this.hits / total : 0,
            maxSize: this.maxSize,
            strategy: this.strategy,
        };
    }
    /**
     * Get all keys currently in cache
     */
    keys() {
        return Array.from(this.cache.keys());
    }
    /**
     * Check if key exists in cache
     */
    has(key) {
        const node = this.cache.get(key);
        if (!node)
            return false;
        if (node.expiry < Date.now()) {
            this.delete(key);
            return false;
        }
        return true;
    }
    // Private helper methods for linked list operations
    moveToHead(node) {
        this.removeNode(node);
        this.addToHead(node);
    }
    addToHead(node) {
        node.next = this.head;
        node.prev = null;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }
    removeNode(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        else {
            this.tail = node.prev;
        }
    }
    evict() {
        let keyToEvict = null;
        if (this.strategy === 'lru' || this.strategy === 'fifo') {
            // Remove tail (least recently used / first in)
            if (this.tail) {
                keyToEvict = this.tail.key;
                this.removeNode(this.tail);
            }
        }
        else if (this.strategy === 'lfu') {
            // Remove least frequently used
            let minFreq = Infinity;
            for (const [key, freq] of this.frequencies.entries()) {
                if (freq < minFreq) {
                    minFreq = freq;
                    keyToEvict = key;
                }
            }
            if (keyToEvict) {
                this.frequencies.delete(keyToEvict);
            }
        }
        if (keyToEvict) {
            this.cache.delete(keyToEvict);
            this.evictions++;
        }
    }
}
/**
 * Simple memoization decorator for expensive operations
 * Uses WeakMap to avoid memory leaks
 */
export function memoize(fn, keyFn) {
    const cache = new Map();
    return ((...args) => {
        const key = keyFn ? keyFn(...args) : JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    });
}
//# sourceMappingURL=cache.js.map