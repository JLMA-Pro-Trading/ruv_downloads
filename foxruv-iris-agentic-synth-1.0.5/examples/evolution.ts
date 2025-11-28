/**
 * Genetic algorithm evolution example
 */

import { AgenticSynth } from '../src/index';

async function main() {
  const synth = new AgenticSynth({
    streaming: false,
    models: ['gemini-flash'],
  });

  console.log('🧬 AgenticSynth - Evolution Example\n');

  // Evolve prompts
  const results = await synth.evolve({
    seedPrompts: ['You are an expert software engineer'],
    generations: 5,
    populationSize: 10,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    eliteCount: 2,
    mutationStrategies: ['zero_order', 'first_order', 'semantic_rewrite'],
    crossoverOperations: ['uniform', 'semantic'],
  });

  console.log('🏆 Top 5 Evolved Prompts:\n');
  results.slice(0, 5).forEach((prompt, i) => {
    console.log(`${i + 1}. [Fitness: ${prompt.fitness.toFixed(3)}]`);
    console.log(`   ${prompt.content}`);
    console.log(`   Generation: ${prompt.generation}, Parents: ${prompt.parentIds.join(', ')}\n`);
  });

  console.log('\n📊 Evolution Statistics:');
  console.log(`  Total Prompts: ${results.length}`);
  console.log(`  Best Fitness: ${results[0].fitness.toFixed(3)}`);
  console.log(`  Worst Fitness: ${results[results.length - 1].fitness.toFixed(3)}`);
  console.log(`  Avg Fitness: ${(results.reduce((sum, p) => sum + p.fitness, 0) / results.length).toFixed(3)}`);
}

main().catch(console.error);
