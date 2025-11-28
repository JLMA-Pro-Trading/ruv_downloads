/**
 * Streaming generation example
 */

import { AgenticSynth } from '../src/index';

async function main() {
  const synth = new AgenticSynth({
    streaming: true,
    models: ['gemini-flash'],
  });

  console.log('🔄 AgenticSynth - Streaming Generation Example\n');
  console.log('Streaming output:\n');

  // Stream generation
  for await (const chunk of synth.generateStream({
    seedPrompt: 'You are a helpful coding assistant',
    count: 3,
    diversity: 0.7,
    streaming: true,
  })) {
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ Streaming complete!');
}

main().catch(console.error);
