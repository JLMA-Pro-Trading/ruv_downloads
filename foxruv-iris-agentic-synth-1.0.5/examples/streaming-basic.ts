/**
 * Basic Midstreamer Integration Example
 *
 * Demonstrates basic streaming capabilities with NDJSON format,
 * backpressure handling, and error recovery.
 */

import { Readable } from 'stream';

// Mock midstreamer for demonstration
function createMidstreamer(config: any = {}): Readable {
  const stream = new Readable({
    objectMode: config.objectMode ?? true,
    highWaterMark: config.highWaterMark ?? 16,
    read() {
      // Simulate streaming data
      for (let i = 0; i < 20; i++) {
        this.push(JSON.stringify({
          id: `prompt-${i}`,
          text: `Generated prompt ${i}`,
          quality: 0.5 + Math.random() * 0.5,
          timestamp: Date.now()
        }) + '\n');
      }
      this.push(null); // End stream
    }
  });

  return stream;
}

// Example 1: Basic Streaming
async function basicStreaming() {
  console.log('=== Example 1: Basic Streaming ===\n');

  const stream = createMidstreamer();

  let count = 0;
  stream.on('data', (chunk) => {
    const prompt = JSON.parse(chunk.toString().trim());
    console.log(`Received prompt ${count++}:`, prompt.text);
  });

  stream.on('end', () => {
    console.log(`\nStream completed. Total prompts: ${count}\n`);
  });

  stream.on('error', (error) => {
    console.error('Stream error:', error);
  });

  // Wait for completion
  await new Promise(resolve => stream.on('end', resolve));
}

// Example 2: Batch Processing
async function batchProcessing() {
  console.log('=== Example 2: Batch Processing ===\n');

  const stream = createMidstreamer();
  const batchSize = 5;
  let batch: any[] = [];

  stream.on('data', (chunk) => {
    const prompt = JSON.parse(chunk.toString().trim());
    batch.push(prompt);

    if (batch.length === batchSize) {
      console.log(`Processing batch of ${batchSize} prompts:`);
      batch.forEach(p => console.log(`  - ${p.text}`));
      batch = [];
    }
  });

  stream.on('end', () => {
    if (batch.length > 0) {
      console.log(`\nProcessing final batch of ${batch.length} prompts:`);
      batch.forEach(p => console.log(`  - ${p.text}`));
    }
    console.log('\nBatch processing complete\n');
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Example 3: Filtering
async function filtering() {
  console.log('=== Example 3: Quality Filtering ===\n');

  const stream = createMidstreamer();
  const qualityThreshold = 0.8;
  let highQuality = 0;
  let lowQuality = 0;

  stream.on('data', (chunk) => {
    const prompt = JSON.parse(chunk.toString().trim());

    if (prompt.quality >= qualityThreshold) {
      console.log(`✅ High quality: ${prompt.text} (${prompt.quality.toFixed(2)})`);
      highQuality++;
    } else {
      lowQuality++;
    }
  });

  stream.on('end', () => {
    console.log(`\nQuality Report:`);
    console.log(`  High quality (>= ${qualityThreshold}): ${highQuality}`);
    console.log(`  Low quality (< ${qualityThreshold}): ${lowQuality}`);
    console.log('');
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Example 4: Backpressure Handling
async function backpressure() {
  console.log('=== Example 4: Backpressure Handling ===\n');

  const stream = createMidstreamer({
    highWaterMark: 5  // Small buffer to trigger backpressure
  });

  let processed = 0;

  stream.on('data', async (chunk) => {
    const prompt = JSON.parse(chunk.toString().trim());

    // Simulate slow processing
    if (processed % 3 === 0) {
      console.log(`Pausing stream for slow processing...`);
      stream.pause();

      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(`Resuming stream`);
      stream.resume();
    }

    console.log(`Processed: ${prompt.text}`);
    processed++;
  });

  stream.on('end', () => {
    console.log(`\nBackpressure handling complete. Processed: ${processed}\n`);
  });

  await new Promise(resolve => stream.on('end', resolve));
}

// Example 5: Error Handling
async function errorHandling() {
  console.log('=== Example 5: Error Handling ===\n');

  const stream = new Readable({
    objectMode: true,
    read() {
      for (let i = 0; i < 10; i++) {
        if (i === 5) {
          // Simulate error
          this.destroy(new Error('Simulated stream error'));
          return;
        }
        this.push(JSON.stringify({ id: i, text: `Prompt ${i}` }) + '\n');
      }
      this.push(null);
    }
  });

  let processed = 0;

  stream.on('data', (chunk) => {
    processed++;
  });

  stream.on('error', (error) => {
    console.log(`❌ Stream error occurred: ${error.message}`);
    console.log(`Processed ${processed} prompts before error\n`);
  });

  stream.on('end', () => {
    console.log('Stream ended normally\n');
  });

  await new Promise(resolve => {
    stream.on('error', resolve);
    stream.on('end', resolve);
  });
}

// Example 6: Stream Cancellation
async function cancellation() {
  console.log('=== Example 6: Stream Cancellation ===\n');

  const stream = createMidstreamer();

  let processed = 0;
  stream.on('data', (chunk) => {
    processed++;
    console.log(`Processed ${processed} prompts`);
  });

  // Cancel after 50ms
  setTimeout(() => {
    console.log('\nCancelling stream...');
    stream.destroy();
  }, 50);

  stream.on('close', () => {
    console.log(`Stream cancelled. Total processed: ${processed}\n`);
  });

  await new Promise(resolve => stream.on('close', resolve));
}

// Run all examples
async function main() {
  await basicStreaming();
  await batchProcessing();
  await filtering();
  await backpressure();
  await errorHandling();
  await cancellation();

  console.log('All examples completed!');
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicStreaming,
  batchProcessing,
  filtering,
  backpressure,
  errorHandling,
  cancellation
};
