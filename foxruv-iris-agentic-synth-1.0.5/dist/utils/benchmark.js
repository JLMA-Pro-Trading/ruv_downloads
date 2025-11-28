export class PerformanceBenchmark {
    config;
    measurements = [];
    startMemory;
    endMemory;
    constructor(config) {
        this.config = config;
    }
    /**
     * Run benchmark with proper warmup and statistical analysis
     */
    async run(operation, label = 'Operation') {
        console.log(`Running benchmark: ${label}`);
        console.log(`Warmup: ${this.config.warmupIterations} iterations`);
        console.log(`Test: ${this.config.iterations} iterations`);
        console.log(`Concurrency: ${this.config.concurrency}`);
        // Warmup phase
        await this.warmup(operation);
        // Clear measurements
        this.measurements = [];
        // Capture initial memory
        if (global.gc) {
            global.gc();
        }
        this.startMemory = process.memoryUsage();
        // Run benchmark
        const startTime = performance.now();
        if (this.config.concurrency > 1) {
            await this.runConcurrent(operation);
        }
        else {
            await this.runSequential(operation);
        }
        const totalTime = performance.now() - startTime;
        // Capture final memory
        this.endMemory = process.memoryUsage();
        // Calculate statistics
        return this.calculateStatistics(totalTime);
    }
    /**
     * Run comparative benchmark between two implementations
     */
    async compare(operationA, operationB, labelA = 'Operation A', labelB = 'Operation B') {
        console.log('\n=== Comparative Benchmark ===\n');
        const resultA = await this.run(operationA, labelA);
        const resultB = await this.run(operationB, labelB);
        const comparison = {
            speedup: resultA.averageTime / resultB.averageTime,
            percentFaster: ((resultA.averageTime - resultB.averageTime) / resultA.averageTime) * 100,
            throughputImprovement: ((resultB.throughput - resultA.throughput) / resultA.throughput) * 100,
            memoryImprovement: resultA.memoryUsage && resultB.memoryUsage
                ? ((resultA.memoryUsage.heapUsed - resultB.memoryUsage.heapUsed) /
                    resultA.memoryUsage.heapUsed) * 100
                : 0,
        };
        this.printComparison(labelA, labelB, resultA, resultB, comparison);
        return { a: resultA, b: resultB, comparison };
    }
    /**
     * Warmup phase to stabilize performance
     */
    async warmup(operation) {
        for (let i = 0; i < this.config.warmupIterations; i++) {
            await operation();
        }
        // Allow GC to run
        if (global.gc) {
            global.gc();
        }
        // Wait a bit for system to stabilize
        await this.sleep(100);
    }
    /**
     * Run benchmark sequentially
     */
    async runSequential(operation) {
        for (let i = 0; i < this.config.iterations; i++) {
            const start = performance.now();
            await operation();
            const duration = performance.now() - start;
            this.measurements.push(duration);
            // Progress indicator
            if (i % 10 === 0 && i > 0) {
                const progress = ((i / this.config.iterations) * 100).toFixed(1);
                process.stdout.write(`\rProgress: ${progress}%`);
            }
        }
        process.stdout.write('\r\n');
    }
    /**
     * Run benchmark with concurrency
     */
    async runConcurrent(operation) {
        const batches = Math.ceil(this.config.iterations / this.config.concurrency);
        for (let batch = 0; batch < batches; batch++) {
            const batchSize = Math.min(this.config.concurrency, this.config.iterations - batch * this.config.concurrency);
            const promises = [];
            for (let i = 0; i < batchSize; i++) {
                promises.push((async () => {
                    const start = performance.now();
                    await operation();
                    return performance.now() - start;
                })());
            }
            const durations = await Promise.all(promises);
            this.measurements.push(...durations);
            // Progress indicator
            const completed = (batch + 1) * this.config.concurrency;
            const progress = ((Math.min(completed, this.config.iterations) /
                this.config.iterations) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${progress}%`);
        }
        process.stdout.write('\r\n');
    }
    /**
     * Calculate comprehensive statistics
     */
    calculateStatistics(totalTime) {
        const sorted = this.measurements.slice().sort((a, b) => a - b);
        const sum = sorted.reduce((acc, val) => acc + val, 0);
        const mean = sum / sorted.length;
        // Standard deviation
        const squaredDiffs = sorted.map((val) => Math.pow(val - mean, 2));
        const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / sorted.length;
        const standardDeviation = Math.sqrt(variance);
        // Percentiles
        const p50 = this.percentile(sorted, 0.5);
        const p90 = this.percentile(sorted, 0.9);
        const p95 = this.percentile(sorted, 0.95);
        const p99 = this.percentile(sorted, 0.99);
        // Memory delta
        const memoryUsage = this.startMemory && this.endMemory
            ? {
                heapUsed: this.endMemory.heapUsed - this.startMemory.heapUsed,
                heapTotal: this.endMemory.heapTotal - this.startMemory.heapTotal,
                external: this.endMemory.external - this.startMemory.external,
                rss: this.endMemory.rss - this.startMemory.rss,
            }
            : undefined;
        const result = {
            iterations: this.measurements.length,
            totalTime,
            averageTime: mean,
            medianTime: p50,
            minTime: sorted[0],
            maxTime: sorted[sorted.length - 1],
            p90,
            p95,
            p99,
            standardDeviation,
            throughput: (this.measurements.length / totalTime) * 1000,
            memoryUsage,
        };
        this.printResults(result);
        return result;
    }
    /**
     * Calculate percentile value
     */
    percentile(sorted, p) {
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)];
    }
    /**
     * Print benchmark results
     */
    printResults(result) {
        console.log('\n=== Benchmark Results ===');
        console.log(`Iterations: ${result.iterations}`);
        console.log(`Total Time: ${result.totalTime.toFixed(2)} ms`);
        console.log(`\nLatency:`);
        console.log(`  Average: ${result.averageTime.toFixed(3)} ms`);
        console.log(`  Median (P50): ${result.medianTime.toFixed(3)} ms`);
        console.log(`  P90: ${result.p90.toFixed(3)} ms`);
        console.log(`  P95: ${result.p95.toFixed(3)} ms`);
        console.log(`  P99: ${result.p99.toFixed(3)} ms`);
        console.log(`  Min: ${result.minTime.toFixed(3)} ms`);
        console.log(`  Max: ${result.maxTime.toFixed(3)} ms`);
        console.log(`  StdDev: ${result.standardDeviation.toFixed(3)} ms`);
        console.log(`\nThroughput: ${result.throughput.toFixed(2)} ops/sec`);
        if (result.memoryUsage) {
            console.log(`\nMemory Delta:`);
            console.log(`  Heap Used: ${this.formatBytes(result.memoryUsage.heapUsed)}`);
            console.log(`  Heap Total: ${this.formatBytes(result.memoryUsage.heapTotal)}`);
            console.log(`  External: ${this.formatBytes(result.memoryUsage.external)}`);
            console.log(`  RSS: ${this.formatBytes(result.memoryUsage.rss)}`);
        }
        // Check if P99 meets target
        if (this.config.targetP99Latency && result.p99 > this.config.targetP99Latency) {
            console.log(`\n⚠️  WARNING: P99 latency (${result.p99.toFixed(2)}ms) exceeds target ` +
                `(${this.config.targetP99Latency}ms)`);
        }
        else if (this.config.targetP99Latency) {
            console.log(`\n✅ P99 latency (${result.p99.toFixed(2)}ms) meets target ` +
                `(${this.config.targetP99Latency}ms)`);
        }
        console.log('========================\n');
    }
    /**
     * Print comparison results
     */
    printComparison(labelA, labelB, resultA, resultB, comparison) {
        console.log('\n=== Comparison Results ===');
        console.log(`\n${labelA} vs ${labelB}:`);
        console.log(`  Speedup: ${comparison.speedup.toFixed(2)}x`);
        console.log(`  Performance: ${Math.abs(comparison.percentFaster).toFixed(1)}% ` +
            `${comparison.percentFaster > 0 ? 'faster' : 'slower'}`);
        console.log(`  Throughput: ${Math.abs(comparison.throughputImprovement).toFixed(1)}% ` +
            `${comparison.throughputImprovement > 0 ? 'better' : 'worse'}`);
        if (comparison.memoryImprovement !== 0) {
            console.log(`  Memory: ${Math.abs(comparison.memoryImprovement).toFixed(1)}% ` +
                `${comparison.memoryImprovement > 0 ? 'less' : 'more'}`);
        }
        console.log('\nDetailed Latency Comparison:');
        console.log(`  Average: ${resultA.averageTime.toFixed(3)}ms vs ` +
            `${resultB.averageTime.toFixed(3)}ms`);
        console.log(`  P99: ${resultA.p99.toFixed(3)}ms vs ${resultB.p99.toFixed(3)}ms`);
        console.log(`  Throughput: ${resultA.throughput.toFixed(2)} vs ` +
            `${resultB.throughput.toFixed(2)} ops/sec`);
        console.log('===========================\n');
    }
    /**
     * Format bytes to human-readable string
     */
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
/**
 * Quick benchmark function for one-off measurements
 */
export async function benchmark(operation, iterations = 100, warmup = 10) {
    const benchmarker = new PerformanceBenchmark({
        iterations,
        warmupIterations: warmup,
        concurrency: 1,
        targetP99Latency: 100,
        prompts: [],
    });
    return benchmarker.run(operation);
}
/**
 * Monitor continuous performance metrics
 */
export class PerformanceMonitor {
    samples = [];
    maxSamples;
    startTime;
    constructor(maxSamples = 1000) {
        this.maxSamples = maxSamples;
        this.startTime = Date.now();
    }
    /**
     * Record a measurement
     */
    record(value) {
        this.samples.push(value);
        // Keep only recent samples
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }
    /**
     * Get current statistics
     */
    getStats() {
        if (this.samples.length === 0) {
            return null;
        }
        const sorted = this.samples.slice().sort((a, b) => a - b);
        const sum = sorted.reduce((acc, val) => acc + val, 0);
        const mean = sum / sorted.length;
        return {
            count: this.samples.length,
            mean,
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            min: sorted[0],
            max: sorted[sorted.length - 1],
            duration: Date.now() - this.startTime,
        };
    }
    /**
     * Reset monitor
     */
    reset() {
        this.samples = [];
        this.startTime = Date.now();
    }
}
//# sourceMappingURL=benchmark.js.map