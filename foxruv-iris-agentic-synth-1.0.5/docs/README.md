# AgenticSynth Documentation

Standalone synthetic prompt generation system with streaming, genetic evolution, and multi-model routing.

## Features

- **Streaming Generation**: Real-time prompt generation with midstreamer integration
- **Genetic Evolution**: PromptBreeder pattern for evolving high-quality prompts
- **Multi-Model Routing**: Automatic fallback between models (Gemini, Claude, OpenRouter)
- **Vector Search**: Optional semantic search with ruvector
- **Workflow Automation**: Integration with agentic-robotics
- **Performance Optimized**: P99 latency targets, caching, metrics tracking

## Installation

```bash
npm install agentic-synth

# Optional dependencies
npm install midstreamer  # For streaming
npm install ruvector     # For vector search
npm install agentic-robotics  # For automation
```

## Quick Start

### CLI Usage

```bash
# Generate synthetic prompts
npx agentic-synth generate "You are an expert analyst" --count 10 --diversity 0.8

# Evolve prompts with genetic algorithm
npx agentic-synth evolve "You are a helpful assistant" --generations 10 --population 20

# Run benchmarks
npx agentic-synth benchmark --iterations 100 --concurrency 10

# Initialize configuration
npx agentic-synth init --output config.json
```

### SDK Usage

```typescript
import { AgenticSynth } from 'agentic-synth';

const synth = new AgenticSynth({
  streaming: true,
  models: ['gemini-flash', 'claude-sonnet'],
  cache: { enabled: true },
});

// Generate prompts
const result = await synth.generate({
  seedPrompt: 'You are an expert developer',
  count: 10,
  diversity: 0.8,
});

// Evolve prompts
const evolved = await synth.evolve({
  seedPrompts: ['You are a helpful assistant'],
  generations: 10,
  populationSize: 20,
  mutationRate: 0.1,
  crossoverRate: 0.7,
});
```

## Architecture

### Core Components

1. **SyntheticGenerator**: Main generation engine with caching and streaming
2. **PromptEvolutionEngine**: Genetic algorithm implementation
3. **ModelRouter**: Multi-model routing with automatic fallback
4. **StreamAggregator**: Streaming response aggregation
5. **VectorStore**: Semantic search and retrieval
6. **FitnessEvaluator**: Prompt quality evaluation

### Generation Flow

```
Seed Prompt → Model Router → Generate → Cache → Result
                    ↓
              Fallback Models
```

### Evolution Flow

```
Seed Prompts → Initialize Population → Evaluate Fitness
                                              ↓
                                         Selection
                                              ↓
                                    Crossover + Mutation
                                              ↓
                                       New Generation
```

## Configuration

### AgenticSynth Config

```typescript
{
  streaming: boolean;              // Enable streaming output
  models: string[];                // Available models
  primaryModel?: string;           // Primary model to use
  cache?: CacheConfig;             // Cache configuration
  vectorStore?: VectorStoreConfig; // Vector store config
  automation?: AutomationConfig;   // Automation config
  performance?: PerformanceConfig; // Performance tracking
}
```

### Cache Config

```typescript
{
  enabled: boolean;
  ttl: number;           // Time to live (ms)
  maxSize: number;       // Max cache entries
  strategy: 'lru' | 'lfu' | 'fifo';
}
```

### Evolution Config

```typescript
{
  seedPrompts: string[];
  generations: number;
  populationSize: number;
  mutationRate: number;      // 0-1
  crossoverRate: number;     // 0-1
  eliteCount: number;
  mutationStrategies: ('zero_order' | 'first_order' | 'semantic_rewrite' | 'hypermutation')[];
  crossoverOperations: ('uniform' | 'single_point' | 'semantic')[];
}
```

## Examples

See `/examples` directory for complete examples:

- `basic-generation.ts` - Simple prompt generation
- `streaming-generation.ts` - Streaming output
- `evolution.ts` - Genetic algorithm evolution
- `vector-search.ts` - Semantic search
- `custom-fitness.ts` - Custom fitness functions

## API Reference

### AgenticSynth Class

#### `generate(config: PromptGenerationConfig): Promise<SyntheticResult>`
Generate synthetic prompts from seed prompt.

#### `generateStream(config: PromptGenerationConfig): AsyncGenerator<string>`
Stream generation output in real-time.

#### `evolve(config: EvolutionConfig, customFitness?): Promise<EvolvedPrompt[]>`
Evolve prompts using genetic algorithm.

#### `searchSimilar(query: string, limit?: number): Promise<SearchResult[]>`
Search for similar prompts in vector store.

#### `getStats(): Stats`
Get performance statistics.

#### `reset(): void`
Reset caches and metrics.

## Performance

- **Target P99 Latency**: <100ms
- **Caching**: LRU/LFU/FIFO strategies
- **Concurrency**: Parallel generation support
- **Metrics**: Real-time performance tracking

## Genetic Algorithm

### Mutation Strategies

- **zero_order**: Simple word substitution
- **first_order**: Add/remove words
- **semantic_rewrite**: LLM-based rewriting
- **hypermutation**: Multiple aggressive changes

### Crossover Operations

- **uniform**: Random word selection from parents
- **single_point**: Split and combine at random point
- **semantic**: LLM-based semantic combination

### Fitness Evaluation

Default fitness evaluates:
- Length appropriateness
- Clarity and structure
- Specificity and detail
- Context relevance

Custom fitness functions supported for domain-specific optimization.

## Integrations

### Midstreamer
Real-time streaming for large-scale generation.

### Ruvector
Fast semantic search with HNSW indexing and quantization.

### Agentic Robotics
Workflow automation for batch processing and scheduling.

## Best Practices

1. **Use Caching**: Enable caching for repeated queries
2. **Tune Diversity**: Higher diversity (0.7-0.9) for creative variations
3. **Elite Preservation**: Keep 2-5 elite prompts per generation
4. **Fitness Tuning**: Use custom fitness for domain-specific needs
5. **Vector Search**: Enable for large prompt libraries
6. **Streaming**: Use for real-time applications

## Troubleshooting

### Low Quality Prompts
- Increase diversity parameter
- Use semantic mutation strategies
- Implement custom fitness function

### Slow Generation
- Enable caching
- Reduce population size
- Use faster models (gemini-flash)

### High Memory Usage
- Reduce cache size
- Enable vector quantization
- Clear caches periodically

## License

MIT
