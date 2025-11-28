/**
 * Basic synthetic prompt generation example
 */

import { AgenticSynth } from '../src/index';

async function main() {
  // Create AgenticSynth instance
  const synth = new AgenticSynth({
    streaming: true,
    models: ['gemini-flash', 'claude-sonnet'],
    cache: { enabled: true },
  });

  console.log('🚀 AgenticSynth - Basic Generation Example\n');

  // Generate synthetic prompts
  const result = await synth.generate({
    seedPrompt: 'You are an expert data analyst specializing in business intelligence',
    count: 5,
    diversity: 0.8,
  });

  console.log('✨ Generated Prompts:\n');
  result.prompts.forEach((prompt, i) => {
    console.log(`${i + 1}. ${prompt}\n`);
  });

  console.log('\n📊 Metadata:');
  console.log(`  Model: ${result.metadata.model}`);
  console.log(`  Latency: ${result.metadata.latency?.toFixed(2)}ms`);
  console.log(`  Timestamp: ${new Date(result.metadata.timestamp).toISOString()}`);

  // Get statistics
  const stats = synth.getStats();
  console.log('\n📈 Statistics:');
  console.log(`  Total Requests: ${stats.metrics.requests}`);
  console.log(`  Success Rate: ${(stats.metrics.successRate * 100).toFixed(2)}%`);
  console.log(`  Avg Latency: ${stats.metrics.avgLatency.toFixed(2)}ms`);
  console.log(`  Cache Hit Rate: ${(stats.cache.hitRate * 100).toFixed(2)}%`);
}

main().catch(console.error);
