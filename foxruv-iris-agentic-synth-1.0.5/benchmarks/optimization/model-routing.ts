/**
 * Model routing benchmarks
 * Tests multi-model routing performance and fallback overhead
 */

import { performance } from 'perf_hooks';
import { MetricsCollector } from '../../src/utils/metrics';
import { TEST_PROMPTS } from '../config';

export interface ModelRoutingResult {
  scenario: string;
  primaryModelLatency: number;
  fallbackLatency: number;
  fallbackOverhead: number;
  fallbackRate: number;
  totalRequests: number;
  successRate: number;
}

/**
 * Benchmark primary model performance
 */
export async function benchmarkPrimaryModel(
  modelFn: (prompt: string) => Promise<string>,
  iterations: number = 100
): Promise<{ avgLatency: number; p99Latency: number; successRate: number }> {
  console.log('\n🎯 Benchmarking primary model...');

  const metrics = new MetricsCollector();

  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const start = performance.now();

    try {
      await modelFn(prompt);
      const latency = performance.now() - start;
      metrics.recordRequest(latency, true);
    } catch (error) {
      const latency = performance.now() - start;
      metrics.recordRequest(latency, false);
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\r  ✓ Complete');

  const stats = metrics.getStats();

  return {
    avgLatency: stats.avgLatency,
    p99Latency: stats.p99Latency,
    successRate: stats.successRate,
  };
}

/**
 * Benchmark fallback mechanism
 */
export async function benchmarkFallback(
  primaryFn: (prompt: string) => Promise<string>,
  fallbackFn: (prompt: string) => Promise<string>,
  primaryFailureRate: number = 0.2
): Promise<ModelRoutingResult> {
  console.log(`\n🔄 Benchmarking fallback (${primaryFailureRate * 100}% failure rate)...`);

  const metrics = new MetricsCollector();
  let primaryAttempts = 0;
  let fallbackAttempts = 0;
  let totalPrimaryLatency = 0;
  let totalFallbackLatency = 0;
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const shouldFail = Math.random() < primaryFailureRate;

    let start = performance.now();
    let success = false;

    // Try primary model
    primaryAttempts++;
    try {
      if (!shouldFail) {
        await primaryFn(prompt);
        const latency = performance.now() - start;
        totalPrimaryLatency += latency;
        metrics.recordRequest(latency, true);
        success = true;
      } else {
        throw new Error('Simulated failure');
      }
    } catch (error) {
      // Fallback to secondary model
      fallbackAttempts++;
      start = performance.now();

      try {
        await fallbackFn(prompt);
        const latency = performance.now() - start;
        totalFallbackLatency += latency;
        metrics.recordRequest(latency, true);
        success = true;
      } catch (fallbackError) {
        const latency = performance.now() - start;
        metrics.recordRequest(latency, false);
      }
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\r  ✓ Complete');

  const stats = metrics.getStats();
  const primaryAvgLatency = primaryAttempts > 0 ? totalPrimaryLatency / (primaryAttempts - fallbackAttempts) : 0;
  const fallbackAvgLatency = fallbackAttempts > 0 ? totalFallbackLatency / fallbackAttempts : 0;
  const fallbackOverhead = fallbackAvgLatency - primaryAvgLatency;

  return {
    scenario: `Fallback (${primaryFailureRate * 100}% failure)`,
    primaryModelLatency: primaryAvgLatency,
    fallbackLatency: fallbackAvgLatency,
    fallbackOverhead,
    fallbackRate: fallbackAttempts / iterations,
    totalRequests: iterations,
    successRate: stats.successRate,
  };
}

/**
 * Benchmark load balancing across models
 */
export async function benchmarkLoadBalancing(
  models: Array<(prompt: string) => Promise<string>>,
  strategy: 'round-robin' | 'random' | 'least-latency'
): Promise<{
  scenario: string;
  avgLatency: number;
  p99Latency: number;
  modelDistribution: Record<number, number>;
}> {
  console.log(`\n⚖️  Benchmarking load balancing (${strategy})...`);

  const metrics = new MetricsCollector();
  const modelLatencies: Map<number, number[]> = new Map();
  const modelRequestCounts: Map<number, number> = new Map();
  const iterations = 100;
  let currentModelIndex = 0;

  // Initialize tracking
  models.forEach((_, idx) => {
    modelLatencies.set(idx, []);
    modelRequestCounts.set(idx, 0);
  });

  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];

    // Select model based on strategy
    let modelIndex: number;
    switch (strategy) {
      case 'round-robin':
        modelIndex = currentModelIndex;
        currentModelIndex = (currentModelIndex + 1) % models.length;
        break;
      case 'random':
        modelIndex = Math.floor(Math.random() * models.length);
        break;
      case 'least-latency':
        // Select model with lowest average latency
        modelIndex = 0;
        let minAvgLatency = Infinity;
        modelLatencies.forEach((latencies, idx) => {
          const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
          if (avgLatency < minAvgLatency) {
            minAvgLatency = avgLatency;
            modelIndex = idx;
          }
        });
        break;
    }

    const start = performance.now();

    try {
      await models[modelIndex](prompt);
      const latency = performance.now() - start;
      metrics.recordRequest(latency, true);
      modelLatencies.get(modelIndex)!.push(latency);
      modelRequestCounts.set(modelIndex, (modelRequestCounts.get(modelIndex) || 0) + 1);
    } catch (error) {
      const latency = performance.now() - start;
      metrics.recordRequest(latency, false);
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\r  ✓ Complete');

  const stats = metrics.getStats();
  const modelDistribution: Record<number, number> = {};
  modelRequestCounts.forEach((count, idx) => {
    modelDistribution[idx] = count;
  });

  return {
    scenario: `Load Balancing (${strategy})`,
    avgLatency: stats.avgLatency,
    p99Latency: stats.p99Latency,
    modelDistribution,
  };
}

/**
 * Benchmark model comparison
 */
export async function benchmarkModelComparison(
  models: Record<string, (prompt: string) => Promise<string>>
): Promise<Record<string, { avgLatency: number; p99Latency: number; successRate: number }>> {
  console.log('\n🔬 Benchmarking model comparison...');

  const results: Record<string, { avgLatency: number; p99Latency: number; successRate: number }> = {};
  const iterations = 50;

  for (const [modelName, modelFn] of Object.entries(models)) {
    const metrics = new MetricsCollector();

    for (let i = 0; i < iterations; i++) {
      const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
      const start = performance.now();

      try {
        await modelFn(prompt);
        const latency = performance.now() - start;
        metrics.recordRequest(latency, true);
      } catch (error) {
        const latency = performance.now() - start;
        metrics.recordRequest(latency, false);
      }
    }

    const stats = metrics.getStats();
    results[modelName] = {
      avgLatency: stats.avgLatency,
      p99Latency: stats.p99Latency,
      successRate: stats.successRate,
    };

    console.log(`  ✓ ${modelName}: ${stats.avgLatency.toFixed(2)}ms avg`);
  }

  return results;
}

/**
 * Run all model routing benchmarks
 */
export async function runModelRoutingBenchmarks(
  primaryModel: (prompt: string) => Promise<string>,
  fallbackModel: (prompt: string) => Promise<string>,
  additionalModels: Record<string, (prompt: string) => Promise<string>>
): Promise<{
  primaryResult: { avgLatency: number; p99Latency: number; successRate: number };
  fallbackResults: ModelRoutingResult[];
  loadBalancingResults: Array<{
    scenario: string;
    avgLatency: number;
    p99Latency: number;
    modelDistribution: Record<number, number>;
  }>;
  comparisonResults: Record<string, { avgLatency: number; p99Latency: number; successRate: number }>;
}> {
  console.log('\n📊 Starting Model Routing Benchmarks\n');
  console.log('='.repeat(60));

  // Benchmark primary model
  const primaryResult = await benchmarkPrimaryModel(primaryModel);

  // Benchmark fallback with different failure rates
  const fallbackResults: ModelRoutingResult[] = [];
  for (const failureRate of [0.1, 0.2, 0.5]) {
    fallbackResults.push(await benchmarkFallback(primaryModel, fallbackModel, failureRate));
  }

  // Benchmark load balancing
  const models = [primaryModel, fallbackModel];
  const loadBalancingResults = [];

  for (const strategy of ['round-robin', 'random', 'least-latency'] as const) {
    loadBalancingResults.push(await benchmarkLoadBalancing(models, strategy));
  }

  // Compare different models
  const comparisonResults = await benchmarkModelComparison(additionalModels);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Model Routing Benchmarks Complete\n');

  return {
    primaryResult,
    fallbackResults,
    loadBalancingResults,
    comparisonResults,
  };
}
