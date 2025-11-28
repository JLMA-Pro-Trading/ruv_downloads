/**
 * Custom fitness function example
 */

import { AgenticSynth, CustomFitnessFunction } from '../src/index';

async function main() {
  const synth = new AgenticSynth({
    streaming: false,
    models: ['gemini-flash'],
  });

  console.log('💪 AgenticSynth - Custom Fitness Example\n');

  // Define custom fitness function
  const customFitness: CustomFitnessFunction = async (prompt: string): Promise<number> => {
    let score = 0;

    // Check for specific keywords
    const keywords = ['expert', 'professional', 'detailed', 'comprehensive'];
    for (const keyword of keywords) {
      if (prompt.toLowerCase().includes(keyword)) {
        score += 0.2;
      }
    }

    // Check length
    const words = prompt.split(/\s+/).length;
    if (words >= 10 && words <= 50) {
      score += 0.3;
    }

    // Check for action verbs
    const actionVerbs = ['analyze', 'create', 'develop', 'implement', 'design'];
    for (const verb of actionVerbs) {
      if (prompt.toLowerCase().includes(verb)) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  };

  // Evolve with custom fitness
  const results = await synth.evolve(
    {
      seedPrompts: ['You are a software developer'],
      generations: 5,
      populationSize: 15,
      mutationRate: 0.15,
      crossoverRate: 0.7,
      eliteCount: 3,
    },
    customFitness
  );

  console.log('🏆 Top 5 Prompts (Custom Fitness):\n');
  results.slice(0, 5).forEach((prompt, i) => {
    console.log(`${i + 1}. [Fitness: ${prompt.fitness.toFixed(3)}]`);
    console.log(`   ${prompt.content}\n`);
  });

  console.log('\n✅ Custom fitness successfully applied!');
}

main().catch(console.error);
