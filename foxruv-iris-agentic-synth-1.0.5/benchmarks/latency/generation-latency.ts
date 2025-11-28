/**
 * Generation latency benchmarks
 * Tests P50, P95, P99 latency for prompt generation
 */

import { performance } from 'perf_hooks';
import { MetricsCollector } from '../../src/utils/metrics';
import { BENCHMARK_CONFIG, PERFORMANCE_TARGETS, TEST_PROMPTS } from '../config';

export interface LatencyBenchmarkResult {
  scenario: string;
  iterations: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  passesTarget: boolean;
}

/**
 * Benchmark single prompt generation latency
 */
export async function benchmarkSingleGeneration(
  generateFn: (prompt: string) => Promise<any>,
  iterations: number = BENCHMARK_CONFIG.testIterations
): Promise<LatencyBenchmarkResult> {
  const metrics = new MetricsCollector();
  const latencies: number[] = [];

  console.log(`\n🔍 Benchmarking single generation (${iterations} iterations)...`);

  // Warmup
  for (let i = 0; i < BENCHMARK_CONFIG.warmupIterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    await generateFn(prompt);
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const start = performance.now();

    try {
      await generateFn(prompt);
      const latency = performance.now() - start;
      latencies.push(latency);
      metrics.recordRequest(latency, true);
    } catch (error) {
      const latency = performance.now() - start;
      metrics.recordRequest(latency, false);
    }

    // Progress indicator
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\r  ✓ Complete');

  const stats = metrics.getStats();

  return {
    scenario: 'Single Prompt Generation',
    iterations,
    p50Latency: stats.p50Latency,
    p95Latency: stats.p95Latency,
    p99Latency: stats.p99Latency,
    avgLatency: stats.avgLatency,
    minLatency: stats.minLatency,
    maxLatency: stats.maxLatency,
    passesTarget: stats.p99Latency <= PERFORMANCE_TARGETS.p99LatencyMs,
  };
}

/**
 * Benchmark batch generation latency
 */
export async function benchmarkBatchGeneration(
  generateBatchFn: (prompts: string[]) => Promise<any>,
  batchSize: number
): Promise<LatencyBenchmarkResult> {
  const metrics = new MetricsCollector();
  const iterations = Math.max(10, Math.floor(BENCHMARK_CONFIG.testIterations / batchSize));

  console.log(`\n🔍 Benchmarking batch generation (batch size: ${batchSize})...`);

  // Warmup
  const warmupBatch = TEST_PROMPTS.slice(0, Math.min(batchSize, TEST_PROMPTS.length));
  await generateBatchFn(warmupBatch);

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const batch = Array(batchSize).fill(0).map((_, idx) =>
      TEST_PROMPTS[(i * batchSize + idx) % TEST_PROMPTS.length]
    );

    const start = performance.now();

    try {
      await generateBatchFn(batch);
      const latency = performance.now() - start;
      const perPromptLatency = latency / batchSize;
      metrics.recordRequest(perPromptLatency, true);
    } catch (error) {
      const latency = performance.now() - start;
      const perPromptLatency = latency / batchSize;
      metrics.recordRequest(perPromptLatency, false);
    }

    if ((i + 1) % 5 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\r  ✓ Complete');

  const stats = metrics.getStats();

  return {
    scenario: `Batch Generation (${batchSize} prompts)`,
    iterations,
    p50Latency: stats.p50Latency,
    p95Latency: stats.p95Latency,
    p99Latency: stats.p99Latency,
    avgLatency: stats.avgLatency,
    minLatency: stats.minLatency,
    maxLatency: stats.maxLatency,
    passesTarget: stats.p99Latency <= PERFORMANCE_TARGETS.p99LatencyMs,
  };
}

/**
 * Benchmark streaming vs non-streaming latency
 */
export async function benchmarkStreamingLatency(
  streamingFn: (prompt: string) => AsyncIterable<any>,
  nonStreamingFn: (prompt: string) => Promise<any>
): Promise<{
  streaming: LatencyBenchmarkResult;
  nonStreaming: LatencyBenchmarkResult;
  streamingOverhead: number;
}> {
  const streamingMetrics = new MetricsCollector();
  const nonStreamingMetrics = new MetricsCollector();
  const iterations = 50;

  console.log('\n🔍 Benchmarking streaming vs non-streaming...');

  // Test streaming
  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const start = performance.now();

    try {
      let chunkCount = 0;
      for await (const chunk of streamingFn(prompt)) {
        chunkCount++;
      }
      const latency = performance.now() - start;
      streamingMetrics.recordRequest(latency, true);
    } catch (error) {
      const latency = performance.now() - start;
      streamingMetrics.recordRequest(latency, false);
    }
  }

  // Test non-streaming
  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const start = performance.now();

    try {
      await nonStreamingFn(prompt);
      const latency = performance.now() - start;
      nonStreamingMetrics.recordRequest(latency, true);
    } catch (error) {
      const latency = performance.now() - start;
      nonStreamingMetrics.recordRequest(latency, false);
    }
  }

  console.log('  ✓ Complete');

  const streamingStats = streamingMetrics.getStats();
  const nonStreamingStats = nonStreamingMetrics.getStats();

  return {
    streaming: {
      scenario: 'Streaming Generation',
      iterations,
      p50Latency: streamingStats.p50Latency,
      p95Latency: streamingStats.p95Latency,
      p99Latency: streamingStats.p99Latency,
      avgLatency: streamingStats.avgLatency,
      minLatency: streamingStats.minLatency,
      maxLatency: streamingStats.maxLatency,
      passesTarget: streamingStats.p99Latency <= PERFORMANCE_TARGETS.p99LatencyMs,
    },
    nonStreaming: {
      scenario: 'Non-Streaming Generation',
      iterations,
      p50Latency: nonStreamingStats.p50Latency,
      p95Latency: nonStreamingStats.p95Latency,
      p99Latency: nonStreamingStats.p99Latency,
      avgLatency: nonStreamingStats.avgLatency,
      minLatency: nonStreamingStats.minLatency,
      maxLatency: nonStreamingStats.maxLatency,
      passesTarget: nonStreamingStats.p99Latency <= PERFORMANCE_TARGETS.p99LatencyMs,
    },
    streamingOverhead: ((streamingStats.avgLatency - nonStreamingStats.avgLatency) / nonStreamingStats.avgLatency) * 100,
  };
}

/**
 * Run all latency benchmarks
 */
export async function runLatencyBenchmarks(
  generateFn: (prompt: string) => Promise<any>,
  generateBatchFn: (prompts: string[]) => Promise<any>,
  streamingFn: (prompt: string) => AsyncIterable<any>
): Promise<LatencyBenchmarkResult[]> {
  console.log('\n📊 Starting Latency Benchmarks\n');
  console.log('='.repeat(60));

  const results: LatencyBenchmarkResult[] = [];

  // Single generation
  results.push(await benchmarkSingleGeneration(generateFn));

  // Batch generations
  for (const batchSize of BENCHMARK_CONFIG.batchSizes) {
    results.push(await benchmarkBatchGeneration(generateBatchFn, batchSize));
  }

  // Streaming comparison
  const streamingResults = await benchmarkStreamingLatency(streamingFn, generateFn);
  results.push(streamingResults.streaming);
  results.push(streamingResults.nonStreaming);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Latency Benchmarks Complete\n');

  return results;
}
