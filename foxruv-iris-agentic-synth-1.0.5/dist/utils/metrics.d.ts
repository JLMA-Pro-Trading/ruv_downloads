/**
 * Performance metrics tracking
 */
export interface Metrics {
    requests: number;
    successes: number;
    failures: number;
    totalLatency: number;
    latencies: number[];
    tokensUsed: number;
    cacheHits: number;
    cacheMisses: number;
}
export interface PerformanceStats {
    requests: number;
    successRate: number;
    avgLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    totalTokens: number;
    cacheHitRate: number;
}
/**
 * Metrics collector for performance tracking
 */
export declare class MetricsCollector {
    private metrics;
    private startTime;
    constructor();
    /**
     * Record a request
     */
    recordRequest(latency: number, success: boolean, tokens?: number): void;
    /**
     * Record cache hit
     */
    recordCacheHit(): void;
    /**
     * Record cache miss
     */
    recordCacheMiss(): void;
    /**
     * Get performance statistics
     */
    getStats(): PerformanceStats;
    /**
     * Get raw metrics
     */
    getRawMetrics(): Metrics;
    /**
     * Reset metrics
     */
    reset(): void;
    /**
     * Get uptime in milliseconds
     */
    getUptime(): number;
    /**
     * Calculate percentile from sorted array
     */
    private calculatePercentile;
    /**
     * Format stats as readable string
     */
    formatStats(): string;
}
/**
 * Measure execution time of a function
 */
export declare function measureLatency<T>(fn: () => Promise<T>): Promise<{
    result: T;
    latency: number;
}>;
/**
 * Create a timer for tracking operation duration
 */
export declare class Timer {
    private startTime;
    constructor();
    /**
     * Get elapsed time in milliseconds
     */
    elapsed(): number;
    /**
     * Reset timer
     */
    reset(): void;
}
//# sourceMappingURL=metrics.d.ts.map