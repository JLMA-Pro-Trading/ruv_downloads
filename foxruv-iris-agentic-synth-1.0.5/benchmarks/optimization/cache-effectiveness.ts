/**
 * Cache effectiveness benchmarks
 * Tests cache performance and hit rates
 */

import { performance } from 'perf_hooks';
import { ContextCache } from '../../src/utils/cache';
import { PERFORMANCE_TARGETS, TEST_PROMPTS } from '../config';

export interface CacheBenchmarkResult {
  scenario: string;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  avgCacheHitLatency: number;
  avgCacheMissLatency: number;
  speedupFactor: number;
  passesTarget: boolean;
}

/**
 * Benchmark cache hit rate with different access patterns
 */
export async function benchmarkCacheHitRate(
  generateFn: (prompt: string) => Promise<string>,
  cache: ContextCache<string>,
  accessPattern: 'random' | 'sequential' | 'zipfian'
): Promise<CacheBenchmarkResult> {
  console.log(`\n🎯 Benchmarking cache (${accessPattern} access pattern)...`);

  let cacheHits = 0;
  let cacheMisses = 0;
  let totalCacheHitLatency = 0;
  let totalCacheMissLatency = 0;
  const iterations = 1000;

  cache.clear();

  for (let i = 0; i < iterations; i++) {
    let promptIndex: number;

    // Generate access pattern
    switch (accessPattern) {
      case 'random':
        promptIndex = Math.floor(Math.random() * TEST_PROMPTS.length);
        break;
      case 'sequential':
        promptIndex = i % TEST_PROMPTS.length;
        break;
      case 'zipfian':
        // Zipfian distribution - 80% of requests to 20% of items
        promptIndex = Math.random() < 0.8
          ? Math.floor(Math.random() * Math.ceil(TEST_PROMPTS.length * 0.2))
          : Math.floor(Math.random() * TEST_PROMPTS.length);
        break;
    }

    const prompt = TEST_PROMPTS[promptIndex];
    const cacheKey = `prompt:${prompt}`;

    const start = performance.now();
    const cached = cache.get(cacheKey);

    if (cached) {
      // Cache hit
      const latency = performance.now() - start;
      cacheHits++;
      totalCacheHitLatency += latency;
    } else {
      // Cache miss - generate and store
      const result = await generateFn(prompt);
      const latency = performance.now() - start;
      cache.set(cacheKey, result);
      cacheMisses++;
      totalCacheMissLatency += latency;
    }

    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r  Progress: ${i + 1}/${iterations}`);
    }
  }

  console.log('\r  ✓ Complete');

  const hitRate = cacheHits / (cacheHits + cacheMisses);
  const avgCacheHitLatency = cacheHits > 0 ? totalCacheHitLatency / cacheHits : 0;
  const avgCacheMissLatency = cacheMisses > 0 ? totalCacheMissLatency / cacheMisses : 0;
  const speedupFactor = avgCacheMissLatency / avgCacheHitLatency;

  return {
    scenario: `Cache (${accessPattern})`,
    totalRequests: iterations,
    cacheHits,
    cacheMisses,
    hitRate,
    avgCacheHitLatency,
    avgCacheMissLatency,
    speedupFactor,
    passesTarget: hitRate >= PERFORMANCE_TARGETS.minCacheHitRate,
  };
}

/**
 * Benchmark cache eviction strategies
 */
export async function benchmarkCacheStrategies(
  generateFn: (prompt: string) => Promise<string>
): Promise<Record<string, CacheBenchmarkResult>> {
  console.log('\n🔄 Benchmarking cache strategies...');

  const strategies = ['lru', 'lfu', 'fifo'] as const;
  const results: Record<string, CacheBenchmarkResult> = {};
  const iterations = 500;
  const cacheSize = 50;

  for (const strategy of strategies) {
    const cache = new ContextCache<string>({
      maxSize: cacheSize,
      strategy,
      enabled: true,
    });

    let cacheHits = 0;
    let cacheMisses = 0;
    let totalLatency = 0;

    // Use zipfian access pattern
    for (let i = 0; i < iterations; i++) {
      const promptIndex = Math.random() < 0.8
        ? Math.floor(Math.random() * Math.ceil(TEST_PROMPTS.length * 0.2))
        : Math.floor(Math.random() * TEST_PROMPTS.length);

      const prompt = TEST_PROMPTS[promptIndex];
      const cacheKey = `prompt:${prompt}`;

      const start = performance.now();
      const cached = cache.get(cacheKey);

      if (cached) {
        cacheHits++;
      } else {
        const result = await generateFn(prompt);
        cache.set(cacheKey, result);
        cacheMisses++;
      }

      totalLatency += performance.now() - start;
    }

    const hitRate = cacheHits / (cacheHits + cacheMisses);

    results[strategy] = {
      scenario: `Cache Strategy (${strategy.toUpperCase()})`,
      totalRequests: iterations,
      cacheHits,
      cacheMisses,
      hitRate,
      avgCacheHitLatency: totalLatency / cacheHits,
      avgCacheMissLatency: totalLatency / cacheMisses,
      speedupFactor: 0,
      passesTarget: hitRate >= PERFORMANCE_TARGETS.minCacheHitRate,
    };

    console.log(`  ✓ ${strategy.toUpperCase()}: ${(hitRate * 100).toFixed(1)}% hit rate`);
  }

  return results;
}

/**
 * Benchmark cache TTL effectiveness
 */
export async function benchmarkCacheTTL(
  generateFn: (prompt: string) => Promise<string>
): Promise<{
  withTTL: CacheBenchmarkResult;
  withoutTTL: CacheBenchmarkResult;
}> {
  console.log('\n⏰ Benchmarking cache TTL...');

  const iterations = 200;
  const ttlMs = 1000; // 1 second

  // Test with TTL
  const cacheWithTTL = new ContextCache<string>({
    maxSize: 100,
    ttl: ttlMs,
    enabled: true,
  });

  let hitsWithTTL = 0;
  let missesWithTTL = 0;

  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const cacheKey = `prompt:${prompt}`;

    const cached = cacheWithTTL.get(cacheKey);

    if (cached) {
      hitsWithTTL++;
    } else {
      const result = await generateFn(prompt);
      cacheWithTTL.set(cacheKey, result);
      missesWithTTL++;
    }

    // Wait occasionally to test TTL expiration
    if (i % 50 === 0 && i > 0) {
      await new Promise(resolve => setTimeout(resolve, ttlMs + 100));
    }
  }

  // Test without TTL
  const cacheWithoutTTL = new ContextCache<string>({
    maxSize: 100,
    ttl: Infinity,
    enabled: true,
  });

  let hitsWithoutTTL = 0;
  let missesWithoutTTL = 0;

  for (let i = 0; i < iterations; i++) {
    const prompt = TEST_PROMPTS[i % TEST_PROMPTS.length];
    const cacheKey = `prompt:${prompt}`;

    const cached = cacheWithoutTTL.get(cacheKey);

    if (cached) {
      hitsWithoutTTL++;
    } else {
      const result = await generateFn(prompt);
      cacheWithoutTTL.set(cacheKey, result);
      missesWithoutTTL++;
    }
  }

  console.log('  ✓ Complete');

  return {
    withTTL: {
      scenario: 'Cache with TTL',
      totalRequests: iterations,
      cacheHits: hitsWithTTL,
      cacheMisses: missesWithTTL,
      hitRate: hitsWithTTL / (hitsWithTTL + missesWithTTL),
      avgCacheHitLatency: 0,
      avgCacheMissLatency: 0,
      speedupFactor: 0,
      passesTarget: true,
    },
    withoutTTL: {
      scenario: 'Cache without TTL',
      totalRequests: iterations,
      cacheHits: hitsWithoutTTL,
      cacheMisses: missesWithoutTTL,
      hitRate: hitsWithoutTTL / (hitsWithoutTTL + missesWithoutTTL),
      avgCacheHitLatency: 0,
      avgCacheMissLatency: 0,
      speedupFactor: 0,
      passesTarget: true,
    },
  };
}

/**
 * Run all cache benchmarks
 */
export async function runCacheBenchmarks(
  generateFn: (prompt: string) => Promise<string>
): Promise<{
  hitRateResults: CacheBenchmarkResult[];
  strategyResults: Record<string, CacheBenchmarkResult>;
  ttlResults: {
    withTTL: CacheBenchmarkResult;
    withoutTTL: CacheBenchmarkResult;
  };
}> {
  console.log('\n📊 Starting Cache Benchmarks\n');
  console.log('='.repeat(60));

  const cache = new ContextCache<string>({
    maxSize: 100,
    strategy: 'lru',
    enabled: true,
  });

  const hitRateResults: CacheBenchmarkResult[] = [];

  // Test different access patterns
  for (const pattern of ['random', 'sequential', 'zipfian'] as const) {
    hitRateResults.push(await benchmarkCacheHitRate(generateFn, cache, pattern));
  }

  // Test different strategies
  const strategyResults = await benchmarkCacheStrategies(generateFn);

  // Test TTL effectiveness
  const ttlResults = await benchmarkCacheTTL(generateFn);

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Cache Benchmarks Complete\n');

  return {
    hitRateResults,
    strategyResults,
    ttlResults,
  };
}
