/**
 * Evolution algorithm latency benchmarks
 * Tests genetic algorithm performance with different configurations
 */

import { performance } from 'perf_hooks';
import { MetricsCollector } from '../../src/utils/metrics';
import { BENCHMARK_CONFIG, TEST_PROMPTS } from '../config';

export interface EvolutionBenchmarkResult {
  scenario: string;
  populationSize: number;
  generations: number;
  mutationStrategies: string[];
  totalTime: number;
  avgGenerationTime: number;
  fitnessEvaluationTime: number;
  mutationTime: number;
  crossoverTime: number;
  efficiencyScore: number;
}

/**
 * Benchmark evolution performance with different population sizes
 */
export async function benchmarkEvolutionPopulationSize(
  evolveFn: (config: any) => Promise<any>,
  populationSize: number
): Promise<EvolutionBenchmarkResult> {
  console.log(`\n🧬 Benchmarking evolution (population: ${populationSize})...`);

  const config = {
    seedPrompts: TEST_PROMPTS.slice(0, 3),
    generations: 10,
    populationSize,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    mutationStrategies: ['zero_order', 'first_order'],
  };

  const start = performance.now();
  const result = await evolveFn(config);
  const totalTime = performance.now() - start;

  const avgGenerationTime = totalTime / config.generations;
  const efficiencyScore = populationSize / avgGenerationTime; // Individuals processed per ms

  console.log('  ✓ Complete');

  return {
    scenario: `Evolution (Population ${populationSize})`,
    populationSize,
    generations: config.generations,
    mutationStrategies: config.mutationStrategies,
    totalTime,
    avgGenerationTime,
    fitnessEvaluationTime: 0, // To be measured separately
    mutationTime: 0, // To be measured separately
    crossoverTime: 0, // To be measured separately
    efficiencyScore,
  };
}

/**
 * Benchmark mutation strategies performance
 */
export async function benchmarkMutationStrategies(
  mutateFn: (prompt: string, strategy: string) => Promise<string>
): Promise<Record<string, { avgTime: number; iterations: number }>> {
  console.log('\n🔬 Benchmarking mutation strategies...');

  const strategies = ['zero_order', 'first_order', 'semantic_rewrite', 'hypermutation'];
  const iterations = 50;
  const results: Record<string, { avgTime: number; iterations: number }> = {};

  for (const strategy of strategies) {
    const metrics = new MetricsCollector();

    for (let i = 0; i < iterations; i++) {
      const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
      const start = performance.now();

      try {
        await mutateFn(prompt, strategy);
        const latency = performance.now() - start;
        metrics.recordRequest(latency, true);
      } catch (error) {
        const latency = performance.now() - start;
        metrics.recordRequest(latency, false);
      }
    }

    const stats = metrics.getStats();
    results[strategy] = {
      avgTime: stats.avgLatency,
      iterations,
    };

    console.log(`  ✓ ${strategy}: ${stats.avgLatency.toFixed(2)}ms avg`);
  }

  return results;
}

/**
 * Benchmark crossover operations performance
 */
export async function benchmarkCrossoverOperations(
  crossoverFn: (prompt1: string, prompt2: string, operation: string) => Promise<string>
): Promise<Record<string, { avgTime: number; iterations: number }>> {
  console.log('\n🔀 Benchmarking crossover operations...');

  const operations = ['uniform', 'single_point', 'semantic'];
  const iterations = 50;
  const results: Record<string, { avgTime: number; iterations: number }> = {};

  for (const operation of operations) {
    const metrics = new MetricsCollector();

    for (let i = 0; i < iterations; i++) {
      const prompt1 = TEST_PROMPTS[i % TEST_PROMPTS.length];
      const prompt2 = TEST_PROMPTS[(i + 1) % TEST_PROMPTS.length];
      const start = performance.now();

      try {
        await crossoverFn(prompt1, prompt2, operation);
        const latency = performance.now() - start;
        metrics.recordRequest(latency, true);
      } catch (error) {
        const latency = performance.now() - start;
        metrics.recordRequest(latency, false);
      }
    }

    const stats = metrics.getStats();
    results[operation] = {
      avgTime: stats.avgLatency,
      iterations,
    };

    console.log(`  ✓ ${operation}: ${stats.avgLatency.toFixed(2)}ms avg`);
  }

  return results;
}

/**
 * Benchmark fitness evaluation speed
 */
export async function benchmarkFitnessEvaluation(
  evaluateFn: (prompt: string, contexts: string[]) => Promise<number>
): Promise<{ avgTime: number; contextsCount: number; iterations: number }> {
  console.log('\n🎯 Benchmarking fitness evaluation...');

  const contexts = [
    'Generate clean, readable code',
    'Follow best practices',
    'Include error handling',
  ];
  const iterations = 100;
  const metrics = new MetricsCollector();

  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const start = performance.now();

    try {
      await evaluateFn(prompt, contexts);
      const latency = performance.now() - start;
      metrics.recordRequest(latency, true);
    } catch (error) {
      const latency = performance.now() - start;
      metrics.recordRequest(latency, false);
    }
  }

  const stats = metrics.getStats();
  console.log(`  ✓ Average: ${stats.avgLatency.toFixed(2)}ms`);

  return {
    avgTime: stats.avgLatency,
    contextsCount: contexts.length,
    iterations,
  };
}

/**
 * Run all evolution benchmarks
 */
export async function runEvolutionBenchmarks(
  evolveFn: (config: any) => Promise<any>,
  mutateFn: (prompt: string, strategy: string) => Promise<string>,
  crossoverFn: (prompt1: string, prompt2: string, operation: string) => Promise<string>,
  evaluateFn: (prompt: string, contexts: string[]) => Promise<number>
): Promise<{
  populationResults: EvolutionBenchmarkResult[];
  mutationResults: Record<string, { avgTime: number; iterations: number }>;
  crossoverResults: Record<string, { avgTime: number; iterations: number }>;
  fitnessResults: { avgTime: number; contextsCount: number; iterations: number };
}> {
  console.log('\n📊 Starting Evolution Benchmarks\n');
  console.log('='.repeat(60));

  const populationResults: EvolutionBenchmarkResult[] = [];

  // Test different population sizes
  for (const popSize of BENCHMARK_CONFIG.populationSizes) {
    populationResults.push(await benchmarkEvolutionPopulationSize(evolveFn, popSize));
  }

  // Test mutation strategies
  const mutationResults = await benchmarkMutationStrategies(mutateFn);

  // Test crossover operations
  const crossoverResults = await benchmarkCrossoverOperations(crossoverFn);

  // Test fitness evaluation
  const fitnessResults = await benchmarkFitnessEvaluation(evaluateFn);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Evolution Benchmarks Complete\n');

  return {
    populationResults,
    mutationResults,
    crossoverResults,
    fitnessResults,
  };
}
