#!/usr/bin/env node
/**
 * Main benchmark runner
 * Orchestrates all benchmark suites and generates reports
 */

import { runLatencyBenchmarks } from './latency/generation-latency';
import { runEvolutionBenchmarks } from './latency/evolution-latency';
import { runThroughputBenchmarks } from './throughput/concurrent-requests';
import { runMemoryBenchmarks } from './memory/memory-profiling';
import { runCacheBenchmarks } from './optimization/cache-effectiveness';
import { runModelRoutingBenchmarks } from './optimization/model-routing';
import { generatePerformanceReport } from './reports/performance-report';
import { generateOptimizationReport } from './reports/optimization-report';

export interface BenchmarkOptions {
  suites?: string[];
  outputDir?: string;
  exportJson?: boolean;
  verbose?: boolean;
}

export interface BenchmarkResults {
  timestamp: number;
  latencyResults?: any;
  evolutionResults?: any;
  throughputResults?: any;
  memoryResults?: any;
  cacheResults?: any;
  modelRoutingResults?: any;
}

/**
 * Run all benchmarks
 */
export async function runAllBenchmarks(
  implementations: {
    generate: (prompt: string) => Promise<any>;
    generateBatch: (prompts: string[]) => Promise<any>;
    streaming: (prompt: string) => AsyncIterable<any>;
    evolve: (config: any) => Promise<any>;
    mutate: (prompt: string, strategy: string) => Promise<string>;
    crossover: (p1: string, p2: string, op: string) => Promise<string>;
    evaluateFitness: (prompt: string, contexts: string[]) => Promise<number>;
    primaryModel: (prompt: string) => Promise<string>;
    fallbackModel: (prompt: string) => Promise<string>;
    models: Record<string, (prompt: string) => Promise<string>>;
  },
  options: BenchmarkOptions = {}
): Promise<BenchmarkResults> {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 AgenticSynth Performance Benchmarks');
  console.log('='.repeat(80));

  const results: BenchmarkResults = {
    timestamp: Date.now(),
  };

  const suites = options.suites || [
    'latency',
    'evolution',
    'throughput',
    'memory',
    'cache',
    'routing',
  ];

  try {
    // Latency benchmarks
    if (suites.includes('latency')) {
      results.latencyResults = await runLatencyBenchmarks(
        implementations.generate,
        implementations.generateBatch,
        implementations.streaming
      );
    }

    // Evolution benchmarks
    if (suites.includes('evolution')) {
      results.evolutionResults = await runEvolutionBenchmarks(
        implementations.evolve,
        implementations.mutate,
        implementations.crossover,
        implementations.evaluateFitness
      );
    }

    // Throughput benchmarks
    if (suites.includes('throughput')) {
      results.throughputResults = await runThroughputBenchmarks(
        implementations.generate
      );
    }

    // Memory benchmarks
    if (suites.includes('memory')) {
      results.memoryResults = await runMemoryBenchmarks(
        implementations.streaming,
        implementations.generateBatch,
        implementations.generate
      );
    }

    // Cache benchmarks
    if (suites.includes('cache')) {
      results.cacheResults = await runCacheBenchmarks(
        implementations.primaryModel
      );
    }

    // Model routing benchmarks
    if (suites.includes('routing')) {
      results.modelRoutingResults = await runModelRoutingBenchmarks(
        implementations.primaryModel,
        implementations.fallbackModel,
        implementations.models
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All Benchmarks Complete!');
    console.log('='.repeat(80) + '\n');

    return results;
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    throw error;
  }
}

/**
 * Generate reports from benchmark results
 */
export async function generateReports(
  results: BenchmarkResults,
  outputDir: string = './benchmarks/reports'
): Promise<void> {
  console.log('\n📝 Generating reports...\n');

  // Performance report
  const perfReport = generatePerformanceReport(results);
  console.log(perfReport);

  // Optimization recommendations
  const optReport = generateOptimizationReport(results);
  console.log(optReport);

  console.log('\n✅ Reports generated\n');
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options: BenchmarkOptions = {
    suites: args.includes('--suites')
      ? args[args.indexOf('--suites') + 1].split(',')
      : undefined,
    outputDir: args.includes('--output')
      ? args[args.indexOf('--output') + 1]
      : './benchmarks/reports',
    exportJson: args.includes('--json'),
    verbose: args.includes('--verbose'),
  };

  console.log('\n⚠️  Note: Benchmarks require actual implementations to be provided');
  console.log('This runner is ready to use once core functionality is implemented.\n');
}

if (require.main === module) {
  main().catch(console.error);
}
