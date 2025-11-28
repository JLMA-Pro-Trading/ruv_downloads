# AgenticSynth Performance Benchmarks

Comprehensive benchmark suite for measuring and optimizing agentic-synth performance.

## Overview

This benchmark suite provides detailed performance analysis across multiple dimensions:

- **Latency Benchmarks**: P50, P95, P99 latency measurements
- **Throughput Benchmarks**: Concurrent request handling and sustained load
- **Memory Benchmarks**: Memory usage profiling and leak detection
- **Evolution Benchmarks**: Genetic algorithm performance optimization
- **Cache Benchmarks**: Cache effectiveness and hit rate analysis
- **Model Routing Benchmarks**: Multi-model routing and fallback performance

## Performance Targets

Based on analysis from [midstreamer](https://gist.github.com/ruvnet/d47a31ebcba46e0b51e88cd0a2d7f7cd):

| Metric | Target | Current |
|--------|--------|---------|
| P99 Latency | < 100ms | TBD |
| Throughput | > 4,000 req/min | TBD |
| Peak Memory | < 512MB | TBD |
| Cache Hit Rate | > 70% | TBD |
| Memory Leaks | None | TBD |

## Quick Start

### Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run specific suites
npm run benchmark -- --suites=latency,throughput

# Run with mock implementations (for testing)
tsx benchmarks/example-usage.ts

# Run with verbose output
npm run benchmark -- --verbose
```

### Example Usage

```typescript
import { runAllBenchmarks, generateReports } from './benchmark-runner';
import { createRealisticMock } from './mocks/mock-implementations';

// Create mock implementations
const mocks = createRealisticMock();

// Run benchmarks
const results = await runAllBenchmarks(mocks, {
  suites: ['latency', 'throughput', 'memory'],
  outputDir: './reports',
});

// Generate reports
await generateReports(results, './reports');
```

## Benchmark Suites

### 1. Latency Benchmarks

Tests response time across different scenarios:

- **Single Generation**: Individual prompt generation
- **Batch Generation**: Multiple prompts in batches (10, 50, 100, 500, 1000)
- **Streaming vs Non-Streaming**: Comparison of streaming overhead

**Files:**
- `latency/generation-latency.ts`: Generation latency tests
- `latency/evolution-latency.ts`: Evolution algorithm tests

**Key Metrics:**
- P50, P95, P99 latency
- Average and min/max latency
- Streaming overhead percentage

### 2. Throughput Benchmarks

Measures system capacity under load:

- **Concurrent Requests**: 1, 5, 10, 20, 50 concurrent users
- **Sustained Throughput**: 60-second sustained load test
- **Burst Traffic**: Sudden spike of 100 simultaneous requests

**Files:**
- `throughput/concurrent-requests.ts`: Concurrency tests

**Key Metrics:**
- Requests per second
- Requests per minute
- Success rate
- Latency under load

### 3. Memory Benchmarks

Profiles memory usage and detects leaks:

- **Streaming Memory**: Memory during streaming operations
- **Batch Memory**: Memory for different batch sizes
- **Leak Detection**: 1,000 iteration leak detection

**Files:**
- `memory/memory-profiling.ts`: Memory profiling and leak detection

**Key Metrics:**
- Initial, peak, and final memory
- Memory growth rate
- Leak detection (MB per iteration)

**Usage:**
```bash
# Run with garbage collection exposure for accurate results
node --expose-gc benchmarks/memory-test.js
```

### 4. Evolution Benchmarks

Tests genetic algorithm performance:

- **Population Sizes**: 10, 20, 50, 100 individuals
- **Mutation Strategies**: zero_order, first_order, semantic_rewrite, hypermutation
- **Crossover Operations**: uniform, single_point, semantic
- **Fitness Evaluation**: Multi-context evaluation speed

**Files:**
- `latency/evolution-latency.ts`: Evolution performance tests

**Key Metrics:**
- Time per generation
- Efficiency score (individuals/ms)
- Strategy comparison

### 5. Cache Benchmarks

Analyzes cache effectiveness:

- **Access Patterns**: Random, sequential, Zipfian
- **Cache Strategies**: LRU, LFU, FIFO
- **TTL Effectiveness**: With and without TTL

**Files:**
- `optimization/cache-effectiveness.ts`: Cache performance tests

**Key Metrics:**
- Hit rate percentage
- Cache miss latency
- Speedup factor

### 6. Model Routing Benchmarks

Tests multi-model orchestration:

- **Primary Model**: Baseline performance
- **Fallback Performance**: Fallback latency and overhead
- **Load Balancing**: Round-robin, random, least-latency strategies
- **Model Comparison**: Side-by-side model performance

**Files:**
- `optimization/model-routing.ts`: Routing and fallback tests

**Key Metrics:**
- Fallback overhead
- Load distribution
- Strategy effectiveness

## Reports

The benchmark suite generates two comprehensive reports:

### Performance Report

Detailed metrics across all benchmark suites:

- Executive summary with pass/fail status
- Latency breakdown by scenario
- Throughput analysis
- Memory profiling results
- Evolution performance metrics
- Cache effectiveness data
- Model routing statistics

**Location:** `benchmarks/reports/performance-report.md`

### Optimization Report

Actionable recommendations for improvement:

- **Critical Issues**: Must-fix performance problems
- **High Priority**: Important optimizations
- **Medium Priority**: Beneficial improvements
- **Low Priority**: Nice-to-have enhancements

Each recommendation includes:
- Issue description
- Performance impact
- Detailed implementation steps
- Estimated improvement

**Location:** `benchmarks/reports/optimization-recommendations.md`

## Mock Implementations

For testing the benchmark suite without actual model calls:

```typescript
import { createRealisticMock, createMockImplementations } from './mocks/mock-implementations';

// Realistic mock with simulated latencies
const realistic = createRealisticMock();

// Custom mock with configurable performance
const custom = createMockImplementations({
  baseLatency: 30,
  latencyVariance: 10,
  failureRate: 0.05,
});
```

## Architecture

```
benchmarks/
├── config.ts                          # Performance targets and test data
├── benchmark-runner.ts                # Main orchestrator
├── latency/
│   ├── generation-latency.ts         # Generation latency tests
│   └── evolution-latency.ts          # Evolution algorithm tests
├── throughput/
│   └── concurrent-requests.ts        # Concurrency and load tests
├── memory/
│   └── memory-profiling.ts           # Memory profiling and leak detection
├── optimization/
│   ├── cache-effectiveness.ts        # Cache performance tests
│   └── model-routing.ts              # Model routing and fallback tests
├── reports/
│   ├── performance-report.ts         # Report generator
│   └── optimization-report.ts        # Recommendation generator
├── mocks/
│   └── mock-implementations.ts       # Mock implementations for testing
└── README.md                          # This file
```

## Best Practices

### Running Benchmarks

1. **Close other applications** to minimize interference
2. **Run multiple times** to establish baseline variance
3. **Use --expose-gc** for memory benchmarks
4. **Monitor system resources** during tests
5. **Document system specs** with results

### Interpreting Results

1. **Focus on P95/P99** rather than averages
2. **Look for patterns** across different scenarios
3. **Compare to targets** not just previous runs
4. **Consider real-world usage** when prioritizing
5. **Validate improvements** with follow-up benchmarks

### Optimization Workflow

1. Run baseline benchmarks
2. Identify critical bottlenecks
3. Implement targeted optimizations
4. Re-run specific benchmark suites
5. Validate improvements
6. Document changes and results

## Continuous Integration

Add to CI/CD pipeline:

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmarks

on:
  pull_request:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run benchmark
      - uses: actions/upload-artifact@v3
        with:
          name: benchmark-results
          path: benchmarks/reports/
```

## Troubleshooting

### High Variance in Results

- Close background applications
- Run warmup iterations
- Increase test iterations
- Check for resource constraints

### Memory Benchmarks Inaccurate

- Use `--expose-gc` flag
- Increase heap size if needed
- Run with isolated test cases
- Check for external memory pressure

### Benchmarks Taking Too Long

- Reduce iteration counts
- Run specific suites only
- Use mock implementations
- Parallelize where possible

## Contributing

When adding new benchmarks:

1. Follow existing patterns
2. Add to appropriate suite
3. Update this README
4. Include in benchmark runner
5. Add mock implementations
6. Document expected results

## License

MIT

## References

- [midstreamer Performance Analysis](https://gist.github.com/ruvnet/d47a31ebcba46e0b51e88cd0a2d7f7cd)
- [AgenticSynth Repository](https://github.com/ruvnet/agentic-synth)
- [Performance Testing Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
