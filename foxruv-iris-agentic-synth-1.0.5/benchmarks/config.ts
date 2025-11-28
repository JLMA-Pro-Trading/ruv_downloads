/**
 * Benchmark configuration
 */

export interface BenchmarkTargets {
  p99LatencyMs: number;
  p95LatencyMs: number;
  p50LatencyMs: number;
  throughputPerMinute: number;
  maxMemoryMB: number;
  minCacheHitRate: number;
}

export const PERFORMANCE_TARGETS: BenchmarkTargets = {
  p99LatencyMs: 100,
  p95LatencyMs: 75,
  p50LatencyMs: 50,
  throughputPerMinute: 4000, // Minimum 4,000 prompts/min
  maxMemoryMB: 512, // Maximum memory during streaming
  minCacheHitRate: 0.7, // 70% cache hit rate
};

export const BENCHMARK_CONFIG = {
  warmupIterations: 10,
  testIterations: 100,
  concurrentUsers: [1, 5, 10, 20, 50],
  batchSizes: [10, 50, 100, 500, 1000],
  populationSizes: [10, 20, 50, 100],
  generationCounts: [5, 10, 20, 50],
};

export const TEST_PROMPTS = [
  'Write a function to calculate fibonacci numbers',
  'Create a REST API endpoint for user authentication',
  'Implement a binary search tree',
  'Design a database schema for an e-commerce platform',
  'Write a sorting algorithm',
  'Create a React component for a todo list',
  'Implement a caching layer',
  'Design a microservices architecture',
  'Write unit tests for a login function',
  'Create a GraphQL schema',
];
