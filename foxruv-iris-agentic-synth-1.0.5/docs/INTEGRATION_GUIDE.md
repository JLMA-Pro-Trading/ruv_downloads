# Agentic-Synth Integration Guide

## Overview

Agentic-Synth provides seamless integration with three key technologies:

1. **Midstreamer** (Required) - Streaming JSON output for real-time prompt generation
2. **Agentic-Robotics** (Required) - Automation workflows and task orchestration
3. **Ruvector** (Optional) - Vector database for semantic search and similarity matching

## Table of Contents

- [Installation](#installation)
- [Midstreamer Integration](#midstreamer-integration)
- [Agentic-Robotics Integration](#agentic-robotics-integration)
- [Ruvector Integration](#ruvector-integration-optional)
- [Cross-Integration Workflows](#cross-integration-workflows)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)

## Installation

### Required Dependencies

```bash
npm install @foxruv/agentic-synth midstreamer agentic-robotics
```

### Optional Dependencies

```bash
npm install ruvector  # Optional: For vector search capabilities
```

### Verify Installation

```bash
npm run validate:deps
```

This will check all dependencies and their compatibility.

## Midstreamer Integration

### Overview

Midstreamer provides real-time streaming capabilities for prompt generation, allowing you to process results as they are generated rather than waiting for completion.

### Basic Usage

```typescript
import { createMidstreamer } from '@foxruv/agentic-synth/integrations';

// Create a streaming connection
const stream = createMidstreamer({
  format: 'ndjson',
  backpressure: true
});

// Process chunks as they arrive
stream.on('data', (chunk) => {
  const prompt = JSON.parse(chunk);
  console.log('Generated prompt:', prompt);
});

stream.on('end', () => {
  console.log('Stream completed');
});

stream.on('error', (error) => {
  console.error('Stream error:', error);
});
```

### Advanced Features

#### NDJSON Format

```typescript
const stream = createMidstreamer({
  format: 'ndjson',
  batchSize: 10
});

let batch = [];
stream.on('data', (chunk) => {
  batch.push(JSON.parse(chunk));

  if (batch.length === 10) {
    processBatch(batch);
    batch = [];
  }
});
```

#### Backpressure Handling

```typescript
const stream = createMidstreamer({
  backpressure: true,
  highWaterMark: 100
});

stream.on('data', (chunk) => {
  // Slow processing
  const canContinue = processSlowly(chunk);

  if (!canContinue) {
    stream.pause();
    setTimeout(() => stream.resume(), 1000);
  }
});
```

#### Stream Cancellation

```typescript
const stream = createMidstreamer();

// Cancel after timeout
setTimeout(() => {
  stream.destroy();
  console.log('Stream cancelled');
}, 5000);
```

### WebSocket Support

```typescript
import { createMidstreamerWS } from '@foxruv/agentic-synth/integrations';

const ws = createMidstreamerWS({
  url: 'ws://localhost:8080',
  reconnect: true
});

ws.on('message', (data) => {
  console.log('Received:', data);
});
```

## Agentic-Robotics Integration

### Overview

Agentic-Robotics provides powerful automation capabilities for orchestrating complex workflows, managing task dependencies, and implementing event-driven automation.

### Basic Workflow

```typescript
import { createWorkflow } from '@foxruv/agentic-synth/integrations';

const workflow = createWorkflow({
  name: 'prompt-generation',
  steps: [
    {
      id: 'initialize',
      action: async (context) => {
        return { initialized: true };
      }
    },
    {
      id: 'generate',
      action: async (context) => {
        // Generate prompts
        return { prompts: [...] };
      },
      dependencies: ['initialize']
    },
    {
      id: 'validate',
      action: async (context) => {
        // Validate prompts
        return { valid: true };
      },
      dependencies: ['generate']
    }
  ]
});

const result = await workflow.execute();
console.log('Workflow result:', result);
```

### Task Orchestration

```typescript
import { orchestrate } from '@foxruv/agentic-synth/integrations';

const orchestration = orchestrate({
  tasks: [
    {
      id: 'A',
      priority: 10,
      action: async () => ({ result: 'A' }),
      dependencies: []
    },
    {
      id: 'B',
      priority: 5,
      action: async () => ({ result: 'B' }),
      dependencies: ['A']
    },
    {
      id: 'C',
      priority: 8,
      action: async () => ({ result: 'C' }),
      dependencies: ['A']
    },
    {
      id: 'D',
      priority: 3,
      action: async () => ({ result: 'D' }),
      dependencies: ['B', 'C']
    }
  ]
});

const results = await orchestration.run();
// Execution order: A -> C -> B -> D (prioritized)
```

### Event-Driven Automation

```typescript
import { createAutomation } from '@foxruv/agentic-synth/integrations';

const automation = createAutomation({
  triggers: [
    {
      event: 'prompt-generated',
      condition: (data) => data.quality > 0.8,
      action: async (data) => {
        await storePrompt(data);
      }
    },
    {
      event: 'error-occurred',
      action: async (error) => {
        await notifyAdmin(error);
      }
    }
  ]
});

// Emit events
automation.emit('prompt-generated', { quality: 0.9, text: '...' });
```

### State Management

```typescript
const statefulWorkflow = createWorkflow({
  name: 'evolution',
  initialState: {
    iteration: 0,
    bestScore: 0
  },
  steps: [
    {
      id: 'evolve',
      action: async (context) => {
        const newScore = await evaluatePrompt(context.state);

        return {
          state: {
            iteration: context.state.iteration + 1,
            bestScore: Math.max(context.state.bestScore, newScore)
          }
        };
      },
      repeat: (context) => context.state.iteration < 10
    }
  ]
});
```

### Error Recovery

```typescript
const resilientWorkflow = createWorkflow({
  name: 'resilient',
  errorHandling: {
    strategy: 'retry',
    maxRetries: 3,
    backoff: 'exponential'
  },
  steps: [
    {
      id: 'risky-operation',
      action: async () => {
        // May fail occasionally
        if (Math.random() < 0.3) throw new Error('Transient failure');
        return { success: true };
      },
      onError: async (error, context) => {
        console.log(`Attempt ${context.retries + 1} failed:`, error);
      }
    }
  ]
});
```

## Ruvector Integration (Optional)

### Overview

Ruvector provides high-performance vector database capabilities for semantic search, similarity matching, and deduplication of generated prompts.

### Basic Setup

```typescript
import { createVectorDB } from '@foxruv/agentic-synth/integrations';

const db = await createVectorDB({
  dimensions: 384,  // OpenAI text-embedding-3-small
  indexType: 'hnsw',
  metric: 'cosine'
});
```

### Storing Embeddings

```typescript
import { embed } from '@foxruv/agentic-synth/core';

// Single embedding
const vector = await embed('Generate a creative story');
await db.store({
  id: 'prompt-1',
  vector,
  metadata: {
    text: 'Generate a creative story',
    category: 'creative',
    timestamp: Date.now()
  }
});

// Batch storage
const prompts = [
  'Prompt 1',
  'Prompt 2',
  'Prompt 3'
];

const embeddings = await Promise.all(prompts.map(embed));
await db.batchStore(
  embeddings.map((vector, i) => ({
    id: `prompt-${i}`,
    vector,
    metadata: { text: prompts[i] }
  }))
);
```

### Similarity Search

```typescript
// Find similar prompts
const query = await embed('Write a creative narrative');
const results = await db.search(query, {
  topK: 5,
  threshold: 0.8
});

results.forEach(result => {
  console.log(`${result.metadata.text} (score: ${result.score})`);
});
```

### Filtered Search

```typescript
const results = await db.search(query, {
  topK: 10,
  filter: {
    category: 'creative',
    timestamp: { $gte: Date.now() - 86400000 } // Last 24 hours
  }
});
```

### HNSW Indexing

```typescript
const db = await createVectorDB({
  dimensions: 384,
  indexType: 'hnsw',
  indexConfig: {
    M: 16,              // Number of connections per layer
    efConstruction: 200, // Search quality during construction
    efSearch: 100       // Search quality during queries
  }
});

// HNSW provides 150x faster search compared to brute force
```

### Quantization for Memory Efficiency

```typescript
const db = await createVectorDB({
  dimensions: 384,
  quantization: {
    enabled: true,
    bits: 8  // 4x memory reduction
  }
});

// Trade-off: 4x less memory, ~95% accuracy retention
```

## Cross-Integration Workflows

### Stream + Automate

```typescript
import { createMidstreamer, createWorkflow } from '@foxruv/agentic-synth/integrations';

const stream = createMidstreamer();
const workflow = createWorkflow({
  name: 'process-stream',
  steps: [
    {
      id: 'validate',
      action: async (context) => {
        return { valid: validatePrompt(context.data) };
      }
    },
    {
      id: 'transform',
      action: async (context) => {
        return { transformed: transformPrompt(context.data) };
      }
    }
  ]
});

stream.on('data', async (chunk) => {
  const result = await workflow.execute({ data: chunk });
  console.log('Processed:', result);
});
```

### Stream + Vector Store

```typescript
const stream = createMidstreamer();
const db = await createVectorDB({ dimensions: 384 });

stream.on('data', async (chunk) => {
  const prompt = JSON.parse(chunk);

  // Check for duplicates
  const vector = await embed(prompt.text);
  const similar = await db.search(vector, { topK: 1, threshold: 0.95 });

  if (similar.length === 0) {
    // Not a duplicate, store it
    await db.store({
      id: prompt.id,
      vector,
      metadata: prompt
    });
  } else {
    console.log('Duplicate detected:', similar[0].metadata.text);
  }
});
```

### Automate + Vector Store

```typescript
const automation = createAutomation({
  triggers: [
    {
      event: 'prompt-generated',
      action: async (prompt) => {
        // Embed and store
        const vector = await embed(prompt.text);
        await db.store({
          id: prompt.id,
          vector,
          metadata: prompt
        });

        // Find similar prompts for evolution
        const similar = await db.search(vector, { topK: 5 });

        if (similar.length > 3) {
          // Enough similar prompts to evolve
          automation.emit('evolution-ready', { base: prompt, similar });
        }
      }
    },
    {
      event: 'evolution-ready',
      action: async ({ base, similar }) => {
        const evolved = await evolvePrompt(base, similar);
        automation.emit('prompt-generated', evolved);
      }
    }
  ]
});
```

### Full Integration: Stream + Automate + Store

```typescript
import {
  createMidstreamer,
  createWorkflow,
  createVectorDB
} from '@foxruv/agentic-synth/integrations';

async function setupFullPipeline() {
  // Setup components
  const stream = createMidstreamer({ format: 'ndjson' });
  const db = await createVectorDB({ dimensions: 384 });

  const workflow = createWorkflow({
    name: 'complete-pipeline',
    steps: [
      {
        id: 'validate',
        action: async (context) => {
          return { valid: validatePrompt(context.prompt) };
        }
      },
      {
        id: 'deduplicate',
        action: async (context) => {
          const vector = await embed(context.prompt.text);
          const similar = await db.search(vector, { topK: 1, threshold: 0.95 });
          return { isDuplicate: similar.length > 0 };
        }
      },
      {
        id: 'store',
        action: async (context) => {
          if (!context.results.deduplicate.isDuplicate) {
            const vector = await embed(context.prompt.text);
            await db.store({
              id: context.prompt.id,
              vector,
              metadata: context.prompt
            });
          }
          return { stored: !context.results.deduplicate.isDuplicate };
        },
        condition: (context) => context.results.validate.valid
      }
    ]
  });

  // Process stream
  stream.on('data', async (chunk) => {
    const prompt = JSON.parse(chunk);
    const result = await workflow.execute({ prompt });
    console.log('Pipeline result:', result);
  });

  return { stream, workflow, db };
}
```

## Error Handling

### Graceful Degradation

```typescript
import { canUseRuvector } from '@foxruv/agentic-synth/integrations';

async function setupWithFallback() {
  const useVectorDB = await canUseRuvector();

  if (useVectorDB) {
    const db = await createVectorDB({ dimensions: 384 });
    return { vectorDB: db, deduplication: 'semantic' };
  } else {
    console.log('Ruvector not available, using hash-based deduplication');
    return { vectorDB: null, deduplication: 'hash' };
  }
}
```

### Integration Error Handling

```typescript
const workflow = createWorkflow({
  name: 'resilient',
  steps: [
    {
      id: 'stream',
      action: async (context) => {
        try {
          return await fetchFromStream();
        } catch (error) {
          console.error('Stream error:', error);
          throw error;
        }
      },
      onError: async (error, context) => {
        // Attempt recovery
        if (context.retries < 3) {
          await wait(1000 * Math.pow(2, context.retries));
          return { retry: true };
        }
        return { fallback: true };
      }
    }
  ]
});
```

## Performance Optimization

### Streaming Optimization

```typescript
const stream = createMidstreamer({
  highWaterMark: 1000,      // Buffer size
  objectMode: false,        // Binary mode for efficiency
  backpressure: true        // Enable backpressure handling
});
```

### Batch Processing

```typescript
const db = await createVectorDB({ dimensions: 384 });

// Instead of individual stores
const embeddings = await Promise.all(prompts.map(embed));
await db.batchStore(embeddings);  // Much faster

// Enable HNSW for fast search
await db.buildIndex({
  type: 'hnsw',
  M: 16,
  efConstruction: 200
});
```

### Memory Management

```typescript
// Use quantization to reduce memory by 4x
const db = await createVectorDB({
  dimensions: 384,
  quantization: { enabled: true, bits: 8 }
});

// Set memory limits
const db = await createVectorDB({
  dimensions: 384,
  maxMemoryMB: 500  // Limit to 500MB
});
```

## Troubleshooting

### Dependency Issues

```bash
# Check installation
npm run validate:deps

# Reinstall if needed
npm install --force
```

### Streaming Issues

**Problem:** Stream not receiving data

```typescript
// Enable debugging
const stream = createMidstreamer({ debug: true });
stream.on('error', console.error);
stream.on('end', () => console.log('Stream ended'));
```

**Problem:** Backpressure causing delays

```typescript
// Increase buffer size
const stream = createMidstreamer({
  highWaterMark: 10000  // Larger buffer
});
```

### Automation Issues

**Problem:** Workflow not executing

```typescript
// Add logging
const workflow = createWorkflow({
  name: 'debug',
  debug: true,
  steps: [...]
});

workflow.on('step-start', (step) => console.log('Starting:', step.id));
workflow.on('step-complete', (step, result) => console.log('Completed:', step.id, result));
```

### Vector Database Issues

**Problem:** Slow search performance

```typescript
// Build HNSW index
await db.buildIndex({ type: 'hnsw' });

// Adjust search parameters
const results = await db.search(query, {
  topK: 10,
  efSearch: 50  // Lower = faster but less accurate
});
```

**Problem:** High memory usage

```typescript
// Enable quantization
const db = await createVectorDB({
  dimensions: 384,
  quantization: { enabled: true, bits: 8 }
});

// Or use memory limits
const db = await createVectorDB({
  dimensions: 384,
  maxMemoryMB: 200
});
```

## API Reference

See [API.md](./API.md) for complete API documentation.

## Examples

See [examples/](../examples/) directory for more examples:

- `examples/streaming-basic.ts` - Basic streaming
- `examples/automation-workflow.ts` - Workflow automation
- `examples/vector-search.ts` - Vector similarity search
- `examples/full-pipeline.ts` - Complete integration

## Support

For issues and questions:
- GitHub Issues: https://github.com/foxruv/agentic-synth/issues
- Documentation: https://github.com/foxruv/agentic-synth/docs
