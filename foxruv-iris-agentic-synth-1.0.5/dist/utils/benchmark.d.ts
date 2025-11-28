import { BenchmarkConfig } from '../schemas/prompt-schema.js';
/**
 * High-precision performance benchmarking utilities
 * Tracks P50, P90, P95, P99 latencies
 */
export interface BenchmarkResult {
    iterations: number;
    totalTime: number;
    averageTime: number;
    medianTime: number;
    minTime: number;
    maxTime: number;
    p90: number;
    p95: number;
    p99: number;
    standardDeviation: number;
    throughput: number;
    memoryUsage?: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
}
export declare class PerformanceBenchmark {
    private config;
    private measurements;
    private startMemory?;
    private endMemory?;
    constructor(config: BenchmarkConfig);
    /**
     * Run benchmark with proper warmup and statistical analysis
     */
    run(operation: () => Promise<void> | void, label?: string): Promise<BenchmarkResult>;
    /**
     * Run comparative benchmark between two implementations
     */
    compare(operationA: () => Promise<void> | void, operationB: () => Promise<void> | void, labelA?: string, labelB?: string): Promise<{
        a: BenchmarkResult;
        b: BenchmarkResult;
        comparison: {
            speedup: number;
            percentFaster: number;
            throughputImprovement: number;
            memoryImprovement: number;
        };
    }>;
    /**
     * Warmup phase to stabilize performance
     */
    private warmup;
    /**
     * Run benchmark sequentially
     */
    private runSequential;
    /**
     * Run benchmark with concurrency
     */
    private runConcurrent;
    /**
     * Calculate comprehensive statistics
     */
    private calculateStatistics;
    /**
     * Calculate percentile value
     */
    private percentile;
    /**
     * Print benchmark results
     */
    private printResults;
    /**
     * Print comparison results
     */
    private printComparison;
    /**
     * Format bytes to human-readable string
     */
    private formatBytes;
    private sleep;
}
/**
 * Quick benchmark function for one-off measurements
 */
export declare function benchmark(operation: () => Promise<void> | void, iterations?: number, warmup?: number): Promise<BenchmarkResult>;
/**
 * Monitor continuous performance metrics
 */
export declare class PerformanceMonitor {
    private samples;
    private maxSamples;
    private startTime;
    constructor(maxSamples?: number);
    /**
     * Record a measurement
     */
    record(value: number): void;
    /**
     * Get current statistics
     */
    getStats(): {
        count: number;
        mean: number;
        median: number;
        p95: number;
        p99: number;
        min: number;
        max: number;
        duration: number;
    } | null;
    /**
     * Reset monitor
     */
    reset(): void;
}
//# sourceMappingURL=benchmark.d.ts.map