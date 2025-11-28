/**
 * Performance metrics tracking
 */
/**
 * Metrics collector for performance tracking
 */
export class MetricsCollector {
    metrics;
    startTime;
    constructor() {
        this.metrics = {
            requests: 0,
            successes: 0,
            failures: 0,
            totalLatency: 0,
            latencies: [],
            tokensUsed: 0,
            cacheHits: 0,
            cacheMisses: 0,
        };
        this.startTime = Date.now();
    }
    /**
     * Record a request
     */
    recordRequest(latency, success, tokens) {
        this.metrics.requests++;
        if (success) {
            this.metrics.successes++;
        }
        else {
            this.metrics.failures++;
        }
        this.metrics.totalLatency += latency;
        this.metrics.latencies.push(latency);
        if (tokens) {
            this.metrics.tokensUsed += tokens;
        }
    }
    /**
     * Record cache hit
     */
    recordCacheHit() {
        this.metrics.cacheHits++;
    }
    /**
     * Record cache miss
     */
    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }
    /**
     * Get performance statistics
     */
    getStats() {
        const sortedLatencies = [...this.metrics.latencies].sort((a, b) => a - b);
        const totalCacheAccess = this.metrics.cacheHits + this.metrics.cacheMisses;
        return {
            requests: this.metrics.requests,
            successRate: this.metrics.requests > 0
                ? this.metrics.successes / this.metrics.requests
                : 0,
            avgLatency: this.metrics.requests > 0
                ? this.metrics.totalLatency / this.metrics.requests
                : 0,
            p50Latency: this.calculatePercentile(sortedLatencies, 0.5),
            p95Latency: this.calculatePercentile(sortedLatencies, 0.95),
            p99Latency: this.calculatePercentile(sortedLatencies, 0.99),
            minLatency: sortedLatencies[0] || 0,
            maxLatency: sortedLatencies[sortedLatencies.length - 1] || 0,
            totalTokens: this.metrics.tokensUsed,
            cacheHitRate: totalCacheAccess > 0
                ? this.metrics.cacheHits / totalCacheAccess
                : 0,
        };
    }
    /**
     * Get raw metrics
     */
    getRawMetrics() {
        return { ...this.metrics };
    }
    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            requests: 0,
            successes: 0,
            failures: 0,
            totalLatency: 0,
            latencies: [],
            tokensUsed: 0,
            cacheHits: 0,
            cacheMisses: 0,
        };
        this.startTime = Date.now();
    }
    /**
     * Get uptime in milliseconds
     */
    getUptime() {
        return Date.now() - this.startTime;
    }
    /**
     * Calculate percentile from sorted array
     */
    calculatePercentile(sortedValues, percentile) {
        if (sortedValues.length === 0)
            return 0;
        const index = Math.ceil(sortedValues.length * percentile) - 1;
        return sortedValues[Math.max(0, index)];
    }
    /**
     * Format stats as readable string
     */
    formatStats() {
        const stats = this.getStats();
        return `
Performance Statistics:
  Requests: ${stats.requests}
  Success Rate: ${(stats.successRate * 100).toFixed(2)}%
  Avg Latency: ${stats.avgLatency.toFixed(2)}ms
  P50 Latency: ${stats.p50Latency.toFixed(2)}ms
  P95 Latency: ${stats.p95Latency.toFixed(2)}ms
  P99 Latency: ${stats.p99Latency.toFixed(2)}ms
  Min Latency: ${stats.minLatency.toFixed(2)}ms
  Max Latency: ${stats.maxLatency.toFixed(2)}ms
  Total Tokens: ${stats.totalTokens}
  Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(2)}%
  Uptime: ${(this.getUptime() / 1000).toFixed(2)}s
    `.trim();
    }
}
/**
 * Measure execution time of a function
 */
export async function measureLatency(fn) {
    const start = performance.now();
    const result = await fn();
    const latency = performance.now() - start;
    return { result, latency };
}
/**
 * Create a timer for tracking operation duration
 */
export class Timer {
    startTime;
    constructor() {
        this.startTime = performance.now();
    }
    /**
     * Get elapsed time in milliseconds
     */
    elapsed() {
        return performance.now() - this.startTime;
    }
    /**
     * Reset timer
     */
    reset() {
        this.startTime = performance.now();
    }
}
//# sourceMappingURL=metrics.js.map