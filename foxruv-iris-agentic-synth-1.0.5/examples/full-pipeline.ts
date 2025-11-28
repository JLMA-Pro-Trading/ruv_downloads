/**
 * Full Integration Pipeline Example
 *
 * Demonstrates complete end-to-end workflow combining:
 * - Midstreamer (streaming)
 * - Agentic-Robotics (automation)
 * - Ruvector (vector storage - optional)
 */

import { Readable } from 'stream';

// Mock types
interface Prompt {
  id: string;
  text: string;
  quality: number;
  category: string;
  timestamp: number;
}

// Mock midstreamer
function createMidstreamer(): Readable {
  const stream = new Readable({
    objectMode: true,
    read() {
      for (let i = 0; i < 10; i++) {
        this.push({
          id: `prompt-${i}`,
          text: `Generated prompt ${i}`,
          quality: 0.3 + Math.random() * 0.7,
          category: i % 2 === 0 ? 'creative' : 'technical',
          timestamp: Date.now()
        });
      }
      this.push(null);
    }
  });
  return stream;
}

// Mock workflow
async function createWorkflow(config: any) {
  return {
    execute: async (input: any) => {
      const results: any = {};
      for (const step of config.steps) {
        const result = await step.action({ input, results });
        results[step.id] = result;
      }
      return results;
    }
  };
}

// Mock vector DB
async function createVectorDB(config: any) {
  const storage = new Map();
  return {
    store: async (item: any) => {
      storage.set(item.id, item);
    },
    search: async (vector: number[], options: any) => {
      return Array.from(storage.values())
        .filter((item: any) => Math.random() > 0.5)
        .slice(0, options.topK);
    }
  };
}

// Mock embed function
async function embed(text: string): Promise<number[]> {
  return Array.from({ length: 384 }, () => Math.random());
}

// Example 1: Basic Pipeline
async function basicPipeline() {
  console.log('=== Example 1: Basic Pipeline (Stream + Automate) ===\n');

  const stream = createMidstreamer();
  const workflow = await createWorkflow({
    name: 'validate-and-process',
    steps: [
      {
        id: 'validate',
        action: async ({ input }: any) => {
          const isValid = input.quality > 0.5;
          return { valid: isValid };
        }
      },
      {
        id: 'transform',
        action: async ({ input, results }: any) => {
          if (results.validate.valid) {
            return { transformed: input.text.toUpperCase() };
          }
          return { transformed: null };
        }
      }
    ]
  });

  let processed = 0;
  let valid = 0;

  stream.on('data', async (prompt: Prompt) => {
    const result = await workflow.execute(prompt);
    processed++;

    if (result.validate.valid) {
      valid++;
      console.log(`✅ Valid: ${prompt.text} (${prompt.quality.toFixed(2)})`);
    } else {
      console.log(`❌ Invalid: ${prompt.text} (${prompt.quality.toFixed(2)})`);
    }
  });

  stream.on('end', () => {
    console.log(`\nProcessed: ${processed}, Valid: ${valid}`);
    console.log('');
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Example 2: Full Pipeline with Vector Storage
async function fullPipeline() {
  console.log('=== Example 2: Full Pipeline (Stream + Automate + Store) ===\n');

  const stream = createMidstreamer();
  const db = await createVectorDB({ dimensions: 384 });

  const workflow = await createWorkflow({
    name: 'complete-pipeline',
    steps: [
      {
        id: 'validate',
        action: async ({ input }: any) => {
          return { valid: input.quality > 0.5 };
        }
      },
      {
        id: 'deduplicate',
        action: async ({ input }: any) => {
          const vector = await embed(input.text);
          const similar = await db.search(vector, { topK: 1, threshold: 0.95 });
          return { isDuplicate: similar.length > 0 };
        }
      },
      {
        id: 'store',
        action: async ({ input, results }: any) => {
          if (results.validate.valid && !results.deduplicate.isDuplicate) {
            const vector = await embed(input.text);
            await db.store({
              id: input.id,
              vector,
              metadata: input
            });
            return { stored: true };
          }
          return { stored: false };
        }
      }
    ]
  });

  const stats = {
    total: 0,
    valid: 0,
    duplicates: 0,
    stored: 0
  };

  stream.on('data', async (prompt: Prompt) => {
    stats.total++;
    const result = await workflow.execute(prompt);

    if (!result.validate.valid) {
      console.log(`❌ Invalid: ${prompt.text}`);
    } else {
      stats.valid++;
      if (result.deduplicate.isDuplicate) {
        stats.duplicates++;
        console.log(`⚠️  Duplicate: ${prompt.text}`);
      } else if (result.store.stored) {
        stats.stored++;
        console.log(`✅ Stored: ${prompt.text}`);
      }
    }
  });

  stream.on('end', () => {
    console.log('\n📊 Pipeline Statistics:');
    console.log(`  Total prompts: ${stats.total}`);
    console.log(`  Valid: ${stats.valid}`);
    console.log(`  Duplicates: ${stats.duplicates}`);
    console.log(`  Stored: ${stats.stored}`);
    console.log(`  Success rate: ${(stats.stored / stats.total * 100).toFixed(1)}%`);
    console.log('');
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Example 3: Evolution Pipeline
async function evolutionPipeline() {
  console.log('=== Example 3: Evolution Pipeline ===\n');

  const db = await createVectorDB({ dimensions: 384 });

  const workflow = await createWorkflow({
    name: 'evolution',
    steps: [
      {
        id: 'generate',
        action: async ({ input }: any) => {
          return {
            prompt: {
              id: `evolved-${Date.now()}`,
              text: `Evolved: ${input.text}`,
              quality: Math.min(input.quality + 0.1, 1.0)
            }
          };
        }
      },
      {
        id: 'embed-and-store',
        action: async ({ results }: any) => {
          const vector = await embed(results.generate.prompt.text);
          await db.store({
            id: results.generate.prompt.id,
            vector,
            metadata: results.generate.prompt
          });
          return { stored: true };
        }
      },
      {
        id: 'find-similar',
        action: async ({ results }: any) => {
          const vector = await embed(results.generate.prompt.text);
          const similar = await db.search(vector, { topK: 3 });
          return { similarCount: similar.length };
        }
      }
    ]
  });

  let currentPrompt = {
    text: 'Create a story',
    quality: 0.5
  };

  console.log(`Starting prompt: "${currentPrompt.text}" (quality: ${currentPrompt.quality})\n`);

  for (let i = 0; i < 5; i++) {
    const result = await workflow.execute(currentPrompt);
    currentPrompt = result.generate.prompt;

    console.log(`Iteration ${i + 1}:`);
    console.log(`  Prompt: "${currentPrompt.text}"`);
    console.log(`  Quality: ${currentPrompt.quality.toFixed(2)}`);
    console.log(`  Similar prompts: ${result['find-similar'].similarCount}`);
  }

  console.log('\n✅ Evolution complete!');
  console.log('');
}

// Example 4: Error Recovery Pipeline
async function errorRecoveryPipeline() {
  console.log('=== Example 4: Error Recovery Pipeline ===\n');

  const stream = new Readable({
    objectMode: true,
    read() {
      for (let i = 0; i < 5; i++) {
        this.push({
          id: `prompt-${i}`,
          text: `Prompt ${i}`,
          quality: 0.5 + Math.random() * 0.5,
          shouldFail: i === 2 // Simulate failure
        });
      }
      this.push(null);
    }
  });

  const workflow = await createWorkflow({
    name: 'resilient',
    steps: [
      {
        id: 'process',
        action: async ({ input }: any) => {
          if (input.shouldFail) {
            throw new Error('Processing failed');
          }
          return { success: true };
        }
      }
    ]
  });

  let succeeded = 0;
  let failed = 0;

  stream.on('data', async (prompt: any) => {
    try {
      await workflow.execute(prompt);
      succeeded++;
      console.log(`✅ Success: ${prompt.text}`);
    } catch (error) {
      failed++;
      console.log(`❌ Failed: ${prompt.text} - ${(error as Error).message}`);
      console.log(`   Recovering...`);
      // Recovery logic here
    }
  });

  stream.on('end', () => {
    console.log(`\nResults: ${succeeded} succeeded, ${failed} failed`);
    console.log('✅ All errors handled gracefully');
    console.log('');
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Example 5: Performance Monitoring Pipeline
async function performanceMonitoring() {
  console.log('=== Example 5: Performance Monitoring ===\n');

  const stream = createMidstreamer();
  const db = await createVectorDB({ dimensions: 384 });

  const workflow = await createWorkflow({
    name: 'monitored',
    steps: [
      { id: 'validate', action: async ({ input }: any) => ({ valid: true }) },
      { id: 'embed', action: async ({ input }: any) => ({ vector: await embed(input.text) }) },
      { id: 'store', action: async ({ results }: any) => ({ stored: true }) }
    ]
  });

  const metrics = {
    startTime: Date.now(),
    processed: 0,
    avgLatency: 0,
    totalLatency: 0
  };

  stream.on('data', async (prompt: Prompt) => {
    const stepStart = Date.now();
    await workflow.execute(prompt);
    const latency = Date.now() - stepStart;

    metrics.processed++;
    metrics.totalLatency += latency;
    metrics.avgLatency = metrics.totalLatency / metrics.processed;
  });

  stream.on('end', () => {
    const totalTime = Date.now() - metrics.startTime;
    const throughput = (metrics.processed / totalTime) * 1000;

    console.log('📊 Performance Metrics:');
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Prompts processed: ${metrics.processed}`);
    console.log(`  Average latency: ${metrics.avgLatency.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput.toFixed(2)} prompts/second`);
    console.log('');
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Run all examples
async function main() {
  console.log('🚀 Full Integration Pipeline Examples\n');
  console.log('Demonstrating Stream + Automate + Store workflows\n');
  console.log('='.repeat(60));
  console.log('');

  await basicPipeline();
  await fullPipeline();
  await evolutionPipeline();
  await errorRecoveryPipeline();
  await performanceMonitoring();

  console.log('✅ All pipeline examples completed!');
  console.log('\nNext steps:');
  console.log('  1. Install real dependencies: npm install midstreamer agentic-robotics');
  console.log('  2. Optional: npm install ruvector');
  console.log('  3. Run validation: npm run test:integration');
  console.log('  4. Read docs: docs/INTEGRATION_GUIDE.md');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicPipeline,
  fullPipeline,
  evolutionPipeline,
  errorRecoveryPipeline,
  performanceMonitoring
};
