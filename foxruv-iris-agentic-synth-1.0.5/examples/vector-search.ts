/**
 * Vector search example (requires ruvector)
 */

import { AgenticSynth } from '../src/index';

async function main() {
  const synth = new AgenticSynth({
    streaming: false,
    models: ['gemini-flash'],
    vectorStore: {
      enabled: true,
      dimensions: 384,
      indexType: 'hnsw',
      similarityMetric: 'cosine',
    },
  });

  console.log('🔍 AgenticSynth - Vector Search Example\n');

  // Generate and store prompts
  console.log('Generating prompts...\n');
  const result = await synth.generate({
    seedPrompt: 'You are an expert machine learning engineer',
    count: 10,
    diversity: 0.9,
  });

  console.log(`✅ Generated and stored ${result.prompts.length} prompts\n`);

  // Search for similar prompts
  console.log('Searching for similar prompts...\n');
  const searchResults = await synth.searchSimilar('expert in deep learning', 5);

  console.log('🎯 Search Results:\n');
  searchResults.forEach((result, i) => {
    console.log(`${i + 1}. [Score: ${result.score.toFixed(3)}]`);
    console.log(`   ${result.content}\n`);
  });

  // Get vector store stats
  const stats = synth.getStats();
  console.log('\n📊 Vector Store Statistics:');
  console.log(`  Size: ${stats.vectorStore?.size}`);
  console.log(`  Dimensions: ${stats.vectorStore?.dimensions}`);
  console.log(`  Index Type: ${stats.vectorStore?.indexType}`);
  console.log(`  Similarity Metric: ${stats.vectorStore?.similarityMetric}`);
}

main().catch(console.error);
