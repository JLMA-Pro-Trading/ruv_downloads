/**
 * Optimization recommendations generator
 * Analyzes benchmark results and provides actionable recommendations
 */

import { PERFORMANCE_TARGETS } from '../config';
import { BenchmarkResults } from '../benchmark-runner';

export interface OptimizationRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  impact: string;
  recommendation: string;
  estimatedImprovement: string;
}

/**
 * Generate optimization report
 */
export function generateOptimizationReport(results: BenchmarkResults): string {
  const recommendations = analyzeResults(results);

  const sections: string[] = [];

  sections.push('# AgenticSynth Optimization Recommendations\n');
  sections.push(`**Generated:** ${new Date(results.timestamp).toISOString()}\n`);
  sections.push('---\n');

  // Group by priority
  const critical = recommendations.filter(r => r.priority === 'critical');
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');

  if (critical.length > 0) {
    sections.push('## 🚨 Critical Issues\n');
    critical.forEach(r => sections.push(formatRecommendation(r)));
  }

  if (high.length > 0) {
    sections.push('## ⚠️  High Priority\n');
    high.forEach(r => sections.push(formatRecommendation(r)));
  }

  if (medium.length > 0) {
    sections.push('## 📊 Medium Priority\n');
    medium.forEach(r => sections.push(formatRecommendation(r)));
  }

  if (low.length > 0) {
    sections.push('## 💡 Low Priority\n');
    low.forEach(r => sections.push(formatRecommendation(r)));
  }

  // Implementation roadmap
  sections.push('## 🗺️  Implementation Roadmap\n');
  sections.push(generateRoadmap(recommendations));

  return sections.join('\n');
}

/**
 * Analyze results and generate recommendations
 */
function analyzeResults(results: BenchmarkResults): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Analyze latency
  if (results.latencyResults) {
    recommendations.push(...analyzeLatency(results.latencyResults));
  }

  // Analyze throughput
  if (results.throughputResults) {
    recommendations.push(...analyzeThroughput(results.throughputResults));
  }

  // Analyze memory
  if (results.memoryResults) {
    recommendations.push(...analyzeMemory(results.memoryResults));
  }

  // Analyze evolution
  if (results.evolutionResults) {
    recommendations.push(...analyzeEvolution(results.evolutionResults));
  }

  // Analyze cache
  if (results.cacheResults) {
    recommendations.push(...analyzeCache(results.cacheResults));
  }

  // Analyze routing
  if (results.modelRoutingResults) {
    recommendations.push(...analyzeRouting(results.modelRoutingResults));
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Analyze latency results
 */
function analyzeLatency(results: any[]): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  const maxP99 = Math.max(...results.map(r => r.p99Latency));

  if (maxP99 > PERFORMANCE_TARGETS.p99LatencyMs) {
    recommendations.push({
      priority: 'critical',
      category: 'Latency',
      issue: `P99 latency (${maxP99.toFixed(2)}ms) exceeds target of ${PERFORMANCE_TARGETS.p99LatencyMs}ms`,
      impact: 'Users will experience slow response times at high percentiles',
      recommendation: `
1. Implement request batching to reduce per-request overhead
2. Add connection pooling for model API calls
3. Enable response streaming to reduce perceived latency
4. Implement predictive caching for common patterns
5. Consider using faster model variants for simple prompts`,
      estimatedImprovement: '40-60% reduction in P99 latency',
    });
  }

  // Check batch performance
  const batchResults = results.filter(r => r.scenario.includes('Batch'));
  if (batchResults.length > 0) {
    const batchLatencies = batchResults.map(r => r.avgLatency);
    const worstBatch = Math.max(...batchLatencies);

    if (worstBatch > 100) {
      recommendations.push({
        priority: 'high',
        category: 'Latency',
        issue: `Batch processing has high latency (${worstBatch.toFixed(2)}ms avg)`,
        impact: 'Batch operations are not efficiently parallelized',
        recommendation: `
1. Implement parallel batch processing with worker threads
2. Use Promise.all() for concurrent model calls
3. Add batch size optimization based on available resources
4. Implement progressive batch loading`,
        estimatedImprovement: '50-70% reduction in batch processing time',
      });
    }
  }

  return recommendations;
}

/**
 * Analyze throughput results
 */
function analyzeThroughput(results: any): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  const maxThroughput = Math.max(
    ...results.concurrentResults.map((r: any) => r.requestsPerMinute)
  );

  if (maxThroughput < PERFORMANCE_TARGETS.throughputPerMinute) {
    recommendations.push({
      priority: 'critical',
      category: 'Throughput',
      issue: `Throughput (${maxThroughput.toFixed(0)} req/min) below target of ${PERFORMANCE_TARGETS.throughputPerMinute} req/min`,
      impact: 'System cannot handle required load',
      recommendation: `
1. Implement connection pooling and keep-alive connections
2. Add request queuing with priority scheduling
3. Enable HTTP/2 multiplexing for model API calls
4. Implement adaptive concurrency limiting
5. Use worker threads for CPU-intensive operations
6. Add request deduplication for identical prompts`,
      estimatedImprovement: '2-3x throughput increase',
    });
  }

  // Check sustained throughput stability
  const sustained = results.sustainedResults;
  if (sustained.intervals) {
    const throughputs = sustained.intervals.map((i: any) => i.requestsPerSecond);
    const variance = calculateVariance(throughputs);

    if (variance > 0.3) {
      recommendations.push({
        priority: 'medium',
        category: 'Throughput',
        issue: 'Throughput is unstable over time (high variance)',
        impact: 'Inconsistent performance under sustained load',
        recommendation: `
1. Implement rate limiting to prevent burst overload
2. Add backpressure handling for model API calls
3. Optimize garbage collection settings
4. Monitor and address memory pressure issues`,
        estimatedImprovement: '30-40% reduction in variance',
      });
    }
  }

  return recommendations;
}

/**
 * Analyze memory results
 */
function analyzeMemory(results: any): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  const peakMemory = results.streamingResult.peakMemoryMB;

  if (peakMemory > PERFORMANCE_TARGETS.maxMemoryMB) {
    recommendations.push({
      priority: 'critical',
      category: 'Memory',
      issue: `Peak memory (${peakMemory.toFixed(2)}MB) exceeds target of ${PERFORMANCE_TARGETS.maxMemoryMB}MB`,
      impact: 'High memory usage can lead to OOM errors and poor performance',
      recommendation: `
1. Implement streaming with backpressure to limit buffering
2. Add object pooling for frequently allocated objects
3. Use WeakMap for caching to allow garbage collection
4. Implement memory limits with circuit breakers
5. Profile and eliminate memory-intensive operations
6. Consider using smaller batch sizes`,
      estimatedImprovement: '40-50% reduction in peak memory',
    });
  }

  if (results.leakResult.hasLeak) {
    recommendations.push({
      priority: 'critical',
      category: 'Memory',
      issue: `Memory leak detected: ${results.leakResult.leakRateMBPerIteration.toFixed(4)} MB/iteration`,
      impact: 'Application will crash after extended use',
      recommendation: `
1. Review event listener cleanup in streaming operations
2. Audit cache implementations for proper eviction
3. Check for circular references in data structures
4. Implement proper cleanup in async operations
5. Use heap snapshots to identify leak sources
6. Add memory monitoring with automatic alerts`,
      estimatedImprovement: 'Eliminate memory growth over time',
    });
  }

  return recommendations;
}

/**
 * Analyze evolution results
 */
function analyzeEvolution(results: any): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Analyze mutation performance
  const mutationTimes = Object.values(results.mutationResults).map((r: any) => r.avgTime);
  const slowestMutation = Math.max(...mutationTimes);

  if (slowestMutation > 100) {
    recommendations.push({
      priority: 'high',
      category: 'Evolution',
      issue: `Mutation operations are slow (${slowestMutation.toFixed(2)}ms max)`,
      impact: 'Evolution algorithm performance is bottlenecked by mutation',
      recommendation: `
1. Implement mutation caching for common transformations
2. Parallelize mutation operations across population
3. Optimize semantic rewrite algorithm
4. Use faster mutation strategies for early generations
5. Add early termination for converged mutations`,
      estimatedImprovement: '50-60% faster mutation operations',
    });
  }

  // Analyze population efficiency
  const efficiencies = results.populationResults.map((r: any) => r.efficiencyScore);
  const lowestEfficiency = Math.min(...efficiencies);

  if (lowestEfficiency < 1.0) {
    recommendations.push({
      priority: 'medium',
      category: 'Evolution',
      issue: 'Large populations have poor efficiency',
      impact: 'Evolution scales poorly with population size',
      recommendation: `
1. Implement island model for parallel evolution
2. Use adaptive population sizing based on convergence
3. Add elitism to reduce redundant evaluations
4. Implement fitness caching for identical prompts
5. Use approximate fitness for initial filtering`,
      estimatedImprovement: '2-3x efficiency improvement',
    });
  }

  return recommendations;
}

/**
 * Analyze cache results
 */
function analyzeCache(results: any): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  const bestHitRate = Math.max(...results.hitRateResults.map((r: any) => r.hitRate));

  if (bestHitRate < PERFORMANCE_TARGETS.minCacheHitRate) {
    recommendations.push({
      priority: 'high',
      category: 'Cache',
      issue: `Cache hit rate (${(bestHitRate * 100).toFixed(1)}%) below target of ${PERFORMANCE_TARGETS.minCacheHitRate * 100}%`,
      impact: 'Poor cache performance negates optimization benefits',
      recommendation: `
1. Increase cache size to reduce evictions
2. Implement semantic caching for similar prompts
3. Use bloom filters for negative caching
4. Add warming for predictable patterns
5. Implement multi-tier caching (L1/L2)
6. Use Zipfian-aware cache strategy`,
      estimatedImprovement: '20-30% improvement in hit rate',
    });
  }

  // Compare strategies
  const strategies = results.strategyResults;
  const bestStrategy = Object.entries(strategies).reduce((best: any, [name, data]: [string, any]) => {
    return data.hitRate > (best?.hitRate || 0) ? { name, ...data } : best;
  }, null);

  if (bestStrategy) {
    recommendations.push({
      priority: 'low',
      category: 'Cache',
      issue: `Cache strategy can be optimized`,
      impact: 'Suboptimal eviction strategy',
      recommendation: `Use ${bestStrategy.name.toUpperCase()} strategy for best hit rate (${(bestStrategy.hitRate * 100).toFixed(1)}%)`,
      estimatedImprovement: `${((bestStrategy.hitRate - bestHitRate) * 100).toFixed(1)}% improvement`,
    });
  }

  return recommendations;
}

/**
 * Analyze routing results
 */
function analyzeRouting(results: any): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];

  // Analyze fallback overhead
  const fallbackResults = results.fallbackResults;
  const highestOverhead = Math.max(...fallbackResults.map((r: any) => r.fallbackOverhead));

  if (highestOverhead > 50) {
    recommendations.push({
      priority: 'medium',
      category: 'Routing',
      issue: `High fallback overhead (${highestOverhead.toFixed(2)}ms)`,
      impact: 'Failover takes too long, affecting reliability',
      recommendation: `
1. Implement pre-warmed fallback connections
2. Add parallel primary/fallback requests for critical paths
3. Use circuit breakers to fail fast
4. Implement request hedging for high latency
5. Cache model availability status`,
      estimatedImprovement: '60-70% reduction in fallback overhead',
    });
  }

  // Analyze load balancing
  const lbResults = results.loadBalancingResults;
  const bestLB = lbResults.reduce((best: any, current: any) => {
    return current.avgLatency < (best?.avgLatency || Infinity) ? current : best;
  }, null);

  if (bestLB) {
    recommendations.push({
      priority: 'low',
      category: 'Routing',
      issue: 'Load balancing can be optimized',
      impact: 'Inefficient request distribution',
      recommendation: `Use ${bestLB.scenario.match(/\((.*)\)/)?.[1]} strategy for optimal latency (${bestLB.avgLatency.toFixed(2)}ms avg)`,
      estimatedImprovement: '10-15% latency improvement',
    });
  }

  return recommendations;
}

/**
 * Format recommendation
 */
function formatRecommendation(rec: OptimizationRecommendation): string {
  return `
### ${rec.category}: ${rec.issue}

**Impact:** ${rec.impact}

**Recommendation:**
${rec.recommendation}

**Estimated Improvement:** ${rec.estimatedImprovement}

---

`;
}

/**
 * Generate implementation roadmap
 */
function generateRoadmap(recommendations: OptimizationRecommendation[]): string {
  const critical = recommendations.filter(r => r.priority === 'critical');
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');

  const lines: string[] = [];

  lines.push('### Phase 1: Critical Issues (Week 1)\n');
  if (critical.length > 0) {
    critical.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.category}: ${r.issue}`);
    });
  } else {
    lines.push('*No critical issues*');
  }

  lines.push('\n### Phase 2: High Priority (Week 2-3)\n');
  if (high.length > 0) {
    high.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.category}: ${r.issue}`);
    });
  } else {
    lines.push('*No high priority issues*');
  }

  lines.push('\n### Phase 3: Medium Priority (Week 4+)\n');
  if (medium.length > 0) {
    medium.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.category}: ${r.issue}`);
    });
  } else {
    lines.push('*No medium priority issues*');
  }

  lines.push('\n### Success Metrics\n');
  lines.push(`- P99 Latency: < ${PERFORMANCE_TARGETS.p99LatencyMs}ms`);
  lines.push(`- Throughput: > ${PERFORMANCE_TARGETS.throughputPerMinute} req/min`);
  lines.push(`- Peak Memory: < ${PERFORMANCE_TARGETS.maxMemoryMB}MB`);
  lines.push(`- Cache Hit Rate: > ${PERFORMANCE_TARGETS.minCacheHitRate * 100}%`);
  lines.push('- No memory leaks\n');

  return lines.join('\n');
}

/**
 * Calculate variance
 */
function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean; // Coefficient of variation
}
