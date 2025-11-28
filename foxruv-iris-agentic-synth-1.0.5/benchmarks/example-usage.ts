#!/usr/bin/env node
/**
 * Example usage of benchmark suite
 * Demonstrates how to run benchmarks with mock implementations
 */

import { runAllBenchmarks, generateReports } from './benchmark-runner';
import { createRealisticMock } from './mocks/mock-implementations';

async function main() {
  console.log('🚀 Running AgenticSynth Benchmarks with Mock Implementations\n');

  // Create mock implementations
  const mocks = createRealisticMock();

  try {
    // Run all benchmarks
    const results = await runAllBenchmarks(mocks, {
      suites: ['latency', 'throughput', 'memory', 'evolution', 'cache', 'routing'],
      verbose: true,
    });

    // Generate reports
    await generateReports(results);

    // Save results to file
    const fs = require('fs');
    const path = require('path');

    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const resultsFile = path.join(reportsDir, 'benchmark-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));

    console.log(`\n📊 Results saved to: ${resultsFile}\n`);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
