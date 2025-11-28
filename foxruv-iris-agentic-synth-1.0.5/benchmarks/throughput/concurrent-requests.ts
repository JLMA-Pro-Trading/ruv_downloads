/**
 * Concurrent request throughput benchmarks
 * Tests system performance under various concurrency levels
 */

import { performance } from 'perf_hooks';
import { MetricsCollector } from '../../src/utils/metrics';
import { BENCHMARK_CONFIG, PERFORMANCE_TARGETS, TEST_PROMPTS } from '../config';

export interface ThroughputBenchmarkResult {
  scenario: string;
  concurrentUsers: number;
  totalRequests: number;
  duration: number;
  requestsPerSecond: number;
  requestsPerMinute: number;
  avgLatency: number;
  p99Latency: number;
  successRate: number;
  passesTarget: boolean;
}

/**
 * Benchmark concurrent request throughput
 */
export async function benchmarkConcurrentRequests(
  generateFn: (prompt: string) => Promise<any>,
  concurrentUsers: number
): Promise<ThroughputBenchmarkResult> {
  console.log(`\n⚡ Benchmarking concurrent requests (${concurrentUsers} users)...`);

  const metrics = new MetricsCollector();
  const requestsPerUser = Math.floor(100 / concurrentUsers);
  const totalRequests = concurrentUsers * requestsPerUser;

  const start = performance.now();

  // Simulate concurrent users
  const userPromises = Array(concurrentUsers).fill(0).map(async (_, userIndex) => {
    for (let i = 0; i < requestsPerUser; i++) {
      const prompt = TEST_PROMPTS[(userIndex * requestsPerUser + i) % TEST_PROMPTS.length];
      const reqStart = performance.now();

      try {
        await generateFn(prompt);
        const latency = performance.now() - reqStart;
        metrics.recordRequest(latency, true);
      } catch (error) {
        const latency = performance.now() - reqStart;
        metrics.recordRequest(latency, false);
      }
    }
  });

  await Promise.all(userPromises);

  const duration = performance.now() - start;
  const durationSeconds = duration / 1000;
  const stats = metrics.getStats();

  const requestsPerSecond = totalRequests / durationSeconds;
  const requestsPerMinute = requestsPerSecond * 60;

  console.log(`  ✓ Complete: ${requestsPerMinute.toFixed(0)} req/min`);

  return {
    scenario: `Concurrent Requests (${concurrentUsers} users)`,
    concurrentUsers,
    totalRequests,
    duration,
    requestsPerSecond,
    requestsPerMinute,
    avgLatency: stats.avgLatency,
    p99Latency: stats.p99Latency,
    successRate: stats.successRate,
    passesTarget: requestsPerMinute >= PERFORMANCE_TARGETS.throughputPerMinute,
  };
}

/**
 * Benchmark sustained throughput over time
 */
export async function benchmarkSustainedThroughput(
  generateFn: (prompt: string) => Promise<any>,
  durationSeconds: number = 60
): Promise<{
  overall: ThroughputBenchmarkResult;
  intervals: { second: number; requestsPerSecond: number }[];
}> {
  console.log(`\n📈 Benchmarking sustained throughput (${durationSeconds}s)...`);

  const metrics = new MetricsCollector();
  const intervals: { second: number; requestsPerSecond: number }[] = [];
  const startTime = performance.now();
  let currentSecond = 0;
  let requestsInCurrentSecond = 0;

  const generateContinuously = async () => {
    let requestIndex = 0;

    while (performance.now() - startTime < durationSeconds * 1000) {
      const prompt = TEST_PROMPTS[requestIndex % TEST_PROMPTS.length];
      const reqStart = performance.now();

      try {
        await generateFn(prompt);
        const latency = performance.now() - reqStart;
        metrics.recordRequest(latency, true);
        requestsInCurrentSecond++;
      } catch (error) {
        const latency = performance.now() - reqStart;
        metrics.recordRequest(latency, false);
      }

      // Track per-second metrics
      const elapsedSeconds = Math.floor((performance.now() - startTime) / 1000);
      if (elapsedSeconds > currentSecond) {
        intervals.push({
          second: currentSecond,
          requestsPerSecond: requestsInCurrentSecond,
        });
        currentSecond = elapsedSeconds;
        requestsInCurrentSecond = 0;

        process.stdout.write(`\r  Progress: ${currentSecond}/${durationSeconds}s`);
      }

      requestIndex++;
    }
  };

  await generateContinuously();

  console.log('\r  ✓ Complete');

  const totalDuration = performance.now() - startTime;
  const stats = metrics.getStats();
  const requestsPerSecond = stats.requests / (totalDuration / 1000);

  return {
    overall: {
      scenario: 'Sustained Throughput',
      concurrentUsers: 1,
      totalRequests: stats.requests,
      duration: totalDuration,
      requestsPerSecond,
      requestsPerMinute: requestsPerSecond * 60,
      avgLatency: stats.avgLatency,
      p99Latency: stats.p99Latency,
      successRate: stats.successRate,
      passesTarget: requestsPerSecond * 60 >= PERFORMANCE_TARGETS.throughputPerMinute,
    },
    intervals,
  };
}

/**
 * Benchmark burst traffic handling
 */
export async function benchmarkBurstTraffic(
  generateFn: (prompt: string) => Promise<any>,
  burstSize: number = 100
): Promise<ThroughputBenchmarkResult> {
  console.log(`\n💥 Benchmarking burst traffic (${burstSize} simultaneous requests)...`);

  const metrics = new MetricsCollector();
  const start = performance.now();

  // Send all requests simultaneously
  const promises = Array(burstSize).fill(0).map(async (_, i) => {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const reqStart = performance.now();

    try {
      await generateFn(prompt);
      const latency = performance.now() - reqStart;
      metrics.recordRequest(latency, true);
    } catch (error) {
      const latency = performance.now() - reqStart;
      metrics.recordRequest(latency, false);
    }
  });

  await Promise.all(promises);

  const duration = performance.now() - start;
  const durationSeconds = duration / 1000;
  const stats = metrics.getStats();

  console.log('  ✓ Complete');

  return {
    scenario: `Burst Traffic (${burstSize} simultaneous)`,
    concurrentUsers: burstSize,
    totalRequests: burstSize,
    duration,
    requestsPerSecond: burstSize / durationSeconds,
    requestsPerMinute: (burstSize / durationSeconds) * 60,
    avgLatency: stats.avgLatency,
    p99Latency: stats.p99Latency,
    successRate: stats.successRate,
    passesTarget: stats.p99Latency <= PERFORMANCE_TARGETS.p99LatencyMs * 2, // Allow 2x for burst
  };
}

/**
 * Run all throughput benchmarks
 */
export async function runThroughputBenchmarks(
  generateFn: (prompt: string) => Promise<any>
): Promise<{
  concurrentResults: ThroughputBenchmarkResult[];
  sustainedResults: {
    overall: ThroughputBenchmarkResult;
    intervals: { second: number; requestsPerSecond: number }[];
  };
  burstResult: ThroughputBenchmarkResult;
}> {
  console.log('\n📊 Starting Throughput Benchmarks\n');
  console.log('='.repeat(60));

  const concurrentResults: ThroughputBenchmarkResult[] = [];

  // Test different concurrency levels
  for (const concurrency of BENCHMARK_CONFIG.concurrentUsers) {
    concurrentResults.push(await benchmarkConcurrentRequests(generateFn, concurrency));
  }

  // Test sustained throughput
  const sustainedResults = await benchmarkSustainedThroughput(generateFn, 30);

  // Test burst traffic
  const burstResult = await benchmarkBurstTraffic(generateFn, 50);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Throughput Benchmarks Complete\n');

  return {
    concurrentResults,
    sustainedResults,
    burstResult,
  };
}
