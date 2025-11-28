/**
 * Performance report generator
 * Creates detailed markdown reports from benchmark results
 */

import { PERFORMANCE_TARGETS } from '../config';
import { BenchmarkResults } from '../benchmark-runner';

/**
 * Generate performance report
 */
export function generatePerformanceReport(results: BenchmarkResults): string {
  const sections: string[] = [];

  // Header
  sections.push('# AgenticSynth Performance Report\n');
  sections.push(`**Generated:** ${new Date(results.timestamp).toISOString()}\n`);
  sections.push('---\n');

  // Executive Summary
  sections.push('## Executive Summary\n');
  const summary = generateExecutiveSummary(results);
  sections.push(summary);

  // Latency Results
  if (results.latencyResults) {
    sections.push('## Latency Performance\n');
    sections.push(generateLatencySection(results.latencyResults));
  }

  // Throughput Results
  if (results.throughputResults) {
    sections.push('## Throughput Performance\n');
    sections.push(generateThroughputSection(results.throughputResults));
  }

  // Memory Results
  if (results.memoryResults) {
    sections.push('## Memory Performance\n');
    sections.push(generateMemorySection(results.memoryResults));
  }

  // Evolution Results
  if (results.evolutionResults) {
    sections.push('## Evolution Performance\n');
    sections.push(generateEvolutionSection(results.evolutionResults));
  }

  // Cache Results
  if (results.cacheResults) {
    sections.push('## Cache Performance\n');
    sections.push(generateCacheSection(results.cacheResults));
  }

  // Model Routing Results
  if (results.modelRoutingResults) {
    sections.push('## Model Routing Performance\n');
    sections.push(generateRoutingSection(results.modelRoutingResults));
  }

  return sections.join('\n');
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(results: BenchmarkResults): string {
  const lines: string[] = [];
  const issues: string[] = [];
  const achievements: string[] = [];

  // Analyze results
  if (results.latencyResults) {
    const p99Latencies = results.latencyResults.map((r: any) => r.p99Latency);
    const maxP99 = Math.max(...p99Latencies);

    if (maxP99 <= PERFORMANCE_TARGETS.p99LatencyMs) {
      achievements.push(`✅ P99 latency: ${maxP99.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.p99LatencyMs}ms)`);
    } else {
      issues.push(`❌ P99 latency: ${maxP99.toFixed(2)}ms exceeds target of ${PERFORMANCE_TARGETS.p99LatencyMs}ms`);
    }
  }

  if (results.throughputResults) {
    const maxThroughput = Math.max(
      ...results.throughputResults.concurrentResults.map((r: any) => r.requestsPerMinute)
    );

    if (maxThroughput >= PERFORMANCE_TARGETS.throughputPerMinute) {
      achievements.push(`✅ Throughput: ${maxThroughput.toFixed(0)} req/min (target: ${PERFORMANCE_TARGETS.throughputPerMinute})`);
    } else {
      issues.push(`❌ Throughput: ${maxThroughput.toFixed(0)} req/min below target of ${PERFORMANCE_TARGETS.throughputPerMinute}`);
    }
  }

  if (results.memoryResults) {
    const peakMemory = results.memoryResults.streamingResult.peakMemoryMB;

    if (peakMemory <= PERFORMANCE_TARGETS.maxMemoryMB) {
      achievements.push(`✅ Peak memory: ${peakMemory.toFixed(2)}MB (target: ${PERFORMANCE_TARGETS.maxMemoryMB}MB)`);
    } else {
      issues.push(`❌ Peak memory: ${peakMemory.toFixed(2)}MB exceeds target of ${PERFORMANCE_TARGETS.maxMemoryMB}MB`);
    }

    if (results.memoryResults.leakResult.hasLeak) {
      issues.push(`❌ Memory leak detected: ${results.memoryResults.leakResult.leakRateMBPerIteration.toFixed(4)} MB/iteration`);
    } else {
      achievements.push('✅ No memory leaks detected');
    }
  }

  if (results.cacheResults) {
    const bestHitRate = Math.max(
      ...results.cacheResults.hitRateResults.map((r: any) => r.hitRate)
    );

    if (bestHitRate >= PERFORMANCE_TARGETS.minCacheHitRate) {
      achievements.push(`✅ Cache hit rate: ${(bestHitRate * 100).toFixed(1)}% (target: ${PERFORMANCE_TARGETS.minCacheHitRate * 100}%)`);
    } else {
      issues.push(`❌ Cache hit rate: ${(bestHitRate * 100).toFixed(1)}% below target of ${PERFORMANCE_TARGETS.minCacheHitRate * 100}%`);
    }
  }

  // Summary
  if (achievements.length > 0) {
    lines.push('### Achievements\n');
    achievements.forEach(a => lines.push(`- ${a}`));
    lines.push('');
  }

  if (issues.length > 0) {
    lines.push('### Issues Identified\n');
    issues.forEach(i => lines.push(`- ${i}`));
    lines.push('');
  }

  lines.push(`**Overall Score:** ${achievements.length} / ${achievements.length + issues.length} targets met\n`);

  return lines.join('\n');
}

/**
 * Generate latency section
 */
function generateLatencySection(results: any[]): string {
  const lines: string[] = [];

  lines.push('| Scenario | Iterations | P50 (ms) | P95 (ms) | P99 (ms) | Avg (ms) | Pass |');
  lines.push('|----------|-----------|----------|----------|----------|----------|------|');

  results.forEach(r => {
    const pass = r.passesTarget ? '✅' : '❌';
    lines.push(
      `| ${r.scenario} | ${r.iterations} | ${r.p50Latency.toFixed(2)} | ${r.p95Latency.toFixed(2)} | ${r.p99Latency.toFixed(2)} | ${r.avgLatency.toFixed(2)} | ${pass} |`
    );
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate throughput section
 */
function generateThroughputSection(results: any): string {
  const lines: string[] = [];

  lines.push('### Concurrent Requests\n');
  lines.push('| Users | Requests | Duration (ms) | Req/s | Req/min | P99 (ms) | Success Rate | Pass |');
  lines.push('|-------|----------|--------------|-------|---------|----------|--------------|------|');

  results.concurrentResults.forEach((r: any) => {
    const pass = r.passesTarget ? '✅' : '❌';
    lines.push(
      `| ${r.concurrentUsers} | ${r.totalRequests} | ${r.duration.toFixed(0)} | ${r.requestsPerSecond.toFixed(1)} | ${r.requestsPerMinute.toFixed(0)} | ${r.p99Latency.toFixed(2)} | ${(r.successRate * 100).toFixed(1)}% | ${pass} |`
    );
  });

  lines.push('\n### Sustained Throughput\n');
  const sustained = results.sustainedResults.overall;
  lines.push(`- **Total Requests:** ${sustained.totalRequests}`);
  lines.push(`- **Duration:** ${(sustained.duration / 1000).toFixed(2)}s`);
  lines.push(`- **Throughput:** ${sustained.requestsPerMinute.toFixed(0)} req/min`);
  lines.push(`- **Avg Latency:** ${sustained.avgLatency.toFixed(2)}ms`);
  lines.push(`- **Pass:** ${sustained.passesTarget ? '✅' : '❌'}\n`);

  lines.push('### Burst Traffic\n');
  const burst = results.burstResult;
  lines.push(`- **Simultaneous Requests:** ${burst.concurrentUsers}`);
  lines.push(`- **Duration:** ${burst.duration.toFixed(2)}ms`);
  lines.push(`- **P99 Latency:** ${burst.p99Latency.toFixed(2)}ms`);
  lines.push(`- **Success Rate:** ${(burst.successRate * 100).toFixed(1)}%`);
  lines.push(`- **Pass:** ${burst.passesTarget ? '✅' : '❌'}\n`);

  return lines.join('\n');
}

/**
 * Generate memory section
 */
function generateMemorySection(results: any): string {
  const lines: string[] = [];

  lines.push('### Streaming Memory\n');
  const streaming = results.streamingResult;
  lines.push(`- **Initial:** ${streaming.initialMemoryMB.toFixed(2)} MB`);
  lines.push(`- **Peak:** ${streaming.peakMemoryMB.toFixed(2)} MB`);
  lines.push(`- **Final:** ${streaming.finalMemoryMB.toFixed(2)} MB`);
  lines.push(`- **Growth:** ${streaming.memoryGrowthMB.toFixed(2)} MB`);
  lines.push(`- **Average:** ${streaming.avgMemoryMB.toFixed(2)} MB`);
  lines.push(`- **Pass:** ${streaming.passesTarget ? '✅' : '❌'}\n`);

  lines.push('### Batch Memory\n');
  lines.push('| Batch Size | Initial (MB) | Peak (MB) | Growth (MB) | Pass |');
  lines.push('|-----------|-------------|----------|------------|------|');

  results.batchResults.forEach((r: any) => {
    const pass = r.passesTarget ? '✅' : '❌';
    lines.push(
      `| ${r.scenario.match(/\d+/)?.[0] || 'N/A'} | ${r.initialMemoryMB.toFixed(2)} | ${r.peakMemoryMB.toFixed(2)} | ${r.memoryGrowthMB.toFixed(2)} | ${pass} |`
    );
  });

  lines.push('\n### Memory Leak Detection\n');
  const leak = results.leakResult;
  lines.push(`- **Leak Detected:** ${leak.hasLeak ? '❌ Yes' : '✅ No'}`);
  lines.push(`- **Leak Rate:** ${leak.leakRateMBPerIteration.toFixed(4)} MB/iteration`);
  lines.push(`- **Memory Growth:** ${leak.result.memoryGrowthMB.toFixed(2)} MB over ${leak.result.iterations} iterations\n`);

  return lines.join('\n');
}

/**
 * Generate evolution section
 */
function generateEvolutionSection(results: any): string {
  const lines: string[] = [];

  lines.push('### Population Performance\n');
  lines.push('| Population | Generations | Total Time (ms) | Avg Gen Time (ms) | Efficiency |');
  lines.push('|-----------|------------|----------------|------------------|-----------|');

  results.populationResults.forEach((r: any) => {
    lines.push(
      `| ${r.populationSize} | ${r.generations} | ${r.totalTime.toFixed(0)} | ${r.avgGenerationTime.toFixed(2)} | ${r.efficiencyScore.toFixed(2)} |`
    );
  });

  lines.push('\n### Mutation Strategies\n');
  lines.push('| Strategy | Avg Time (ms) | Iterations |');
  lines.push('|---------|--------------|-----------|');

  Object.entries(results.mutationResults).forEach(([strategy, data]: [string, any]) => {
    lines.push(`| ${strategy} | ${data.avgTime.toFixed(2)} | ${data.iterations} |`);
  });

  lines.push('\n### Crossover Operations\n');
  lines.push('| Operation | Avg Time (ms) | Iterations |');
  lines.push('|----------|--------------|-----------|');

  Object.entries(results.crossoverResults).forEach(([operation, data]: [string, any]) => {
    lines.push(`| ${operation} | ${data.avgTime.toFixed(2)} | ${data.iterations} |`);
  });

  lines.push('\n### Fitness Evaluation\n');
  const fitness = results.fitnessResults;
  lines.push(`- **Average Time:** ${fitness.avgTime.toFixed(2)}ms`);
  lines.push(`- **Contexts:** ${fitness.contextsCount}`);
  lines.push(`- **Iterations:** ${fitness.iterations}\n`);

  return lines.join('\n');
}

/**
 * Generate cache section
 */
function generateCacheSection(results: any): string {
  const lines: string[] = [];

  lines.push('### Hit Rate by Access Pattern\n');
  lines.push('| Pattern | Requests | Hits | Misses | Hit Rate | Speedup | Pass |');
  lines.push('|---------|----------|------|--------|---------|---------|------|');

  results.hitRateResults.forEach((r: any) => {
    const pass = r.passesTarget ? '✅' : '❌';
    const pattern = r.scenario.match(/\((.*)\)/)?.[1] || 'unknown';
    lines.push(
      `| ${pattern} | ${r.totalRequests} | ${r.cacheHits} | ${r.cacheMisses} | ${(r.hitRate * 100).toFixed(1)}% | ${r.speedupFactor.toFixed(2)}x | ${pass} |`
    );
  });

  lines.push('\n### Cache Strategies\n');
  lines.push('| Strategy | Hit Rate | Requests | Pass |');
  lines.push('|---------|---------|----------|------|');

  Object.entries(results.strategyResults).forEach(([strategy, data]: [string, any]) => {
    const pass = data.passesTarget ? '✅' : '❌';
    lines.push(`| ${strategy.toUpperCase()} | ${(data.hitRate * 100).toFixed(1)}% | ${data.totalRequests} | ${pass} |`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate routing section
 */
function generateRoutingSection(results: any): string {
  const lines: string[] = [];

  lines.push('### Primary Model Performance\n');
  const primary = results.primaryResult;
  lines.push(`- **Avg Latency:** ${primary.avgLatency.toFixed(2)}ms`);
  lines.push(`- **P99 Latency:** ${primary.p99Latency.toFixed(2)}ms`);
  lines.push(`- **Success Rate:** ${(primary.successRate * 100).toFixed(1)}%\n`);

  lines.push('### Fallback Performance\n');
  lines.push('| Failure Rate | Primary Latency | Fallback Latency | Overhead | Success Rate |');
  lines.push('|-------------|----------------|-----------------|---------|-------------|');

  results.fallbackResults.forEach((r: any) => {
    lines.push(
      `| ${(r.fallbackRate * 100).toFixed(0)}% | ${r.primaryModelLatency.toFixed(2)}ms | ${r.fallbackLatency.toFixed(2)}ms | ${r.fallbackOverhead.toFixed(2)}ms | ${(r.successRate * 100).toFixed(1)}% |`
    );
  });

  lines.push('\n### Load Balancing\n');
  lines.push('| Strategy | Avg Latency | P99 Latency | Distribution |');
  lines.push('|---------|------------|------------|-------------|');

  results.loadBalancingResults.forEach((r: any) => {
    const dist = Object.values(r.modelDistribution).join(', ');
    lines.push(
      `| ${r.scenario.match(/\((.*)\)/)?.[1] || 'unknown'} | ${r.avgLatency.toFixed(2)}ms | ${r.p99Latency.toFixed(2)}ms | ${dist} |`
    );
  });

  lines.push('');
  return lines.join('\n');
}
