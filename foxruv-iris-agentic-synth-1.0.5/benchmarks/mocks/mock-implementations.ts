/**
 * Mock implementations for benchmark testing
 * Simulates agentic-synth operations without actual model calls
 */

import { TEST_PROMPTS } from '../config';

/**
 * Mock generation function
 */
export async function mockGenerate(prompt: string): Promise<string> {
  // Simulate network latency
  await delay(10 + Math.random() * 20);
  return `Generated: ${prompt.substring(0, 50)}...`;
}

/**
 * Mock batch generation
 */
export async function mockGenerateBatch(prompts: string[]): Promise<string[]> {
  // Batch processing is faster per-item
  await delay(5 * prompts.length + Math.random() * 10);
  return prompts.map(p => `Generated: ${p.substring(0, 50)}...`);
}

/**
 * Mock streaming generation
 */
export async function* mockStreaming(prompt: string): AsyncIterable<string> {
  const chunks = 10;
  const chunkDelay = 2 + Math.random() * 3;

  for (let i = 0; i < chunks; i++) {
    await delay(chunkDelay);
    yield `Chunk ${i + 1}: ${prompt.substring(i * 5, (i + 1) * 5)}`;
  }
}

/**
 * Mock evolution function
 */
export async function mockEvolve(config: any): Promise<any> {
  const { generations, populationSize } = config;

  // Simulate evolution processing
  const timePerIndividual = 2;
  const totalTime = generations * populationSize * timePerIndividual;

  await delay(totalTime);

  return {
    generations,
    populationSize,
    bestPrompt: 'Optimized: ' + config.seedPrompts[0],
    fitness: 0.95,
  };
}

/**
 * Mock mutation function
 */
export async function mockMutate(prompt: string, strategy: string): Promise<string> {
  // Different strategies have different latencies
  const latencies: Record<string, number> = {
    zero_order: 10,
    first_order: 20,
    semantic_rewrite: 50,
    hypermutation: 30,
  };

  await delay(latencies[strategy] || 15);
  return `Mutated[${strategy}]: ${prompt}`;
}

/**
 * Mock crossover function
 */
export async function mockCrossover(
  prompt1: string,
  prompt2: string,
  operation: string
): Promise<string> {
  const latencies: Record<string, number> = {
    uniform: 15,
    single_point: 10,
    semantic: 40,
  };

  await delay(latencies[operation] || 20);
  return `Crossover[${operation}]: ${prompt1.substring(0, 20)} + ${prompt2.substring(0, 20)}`;
}

/**
 * Mock fitness evaluation
 */
export async function mockEvaluateFitness(
  prompt: string,
  contexts: string[]
): Promise<number> {
  // Simulate evaluation based on contexts
  await delay(5 * contexts.length);
  return Math.random() * 0.3 + 0.7; // 0.7-1.0
}

/**
 * Mock primary model
 */
export async function mockPrimaryModel(prompt: string): Promise<string> {
  await delay(15 + Math.random() * 10);
  return `Primary: ${prompt}`;
}

/**
 * Mock fallback model
 */
export async function mockFallbackModel(prompt: string): Promise<string> {
  // Slightly slower than primary
  await delay(20 + Math.random() * 15);
  return `Fallback: ${prompt}`;
}

/**
 * Mock additional models
 */
export const mockModels: Record<string, (prompt: string) => Promise<string>> = {
  'model-fast': async (prompt: string) => {
    await delay(10 + Math.random() * 5);
    return `Fast: ${prompt}`;
  },
  'model-balanced': async (prompt: string) => {
    await delay(20 + Math.random() * 10);
    return `Balanced: ${prompt}`;
  },
  'model-quality': async (prompt: string) => {
    await delay(40 + Math.random() * 20);
    return `Quality: ${prompt}`;
  },
};

/**
 * Create mock implementations with configurable performance
 */
export function createMockImplementations(options: {
  baseLatency?: number;
  latencyVariance?: number;
  failureRate?: number;
} = {}) {
  const { baseLatency = 20, latencyVariance = 10, failureRate = 0 } = options;

  return {
    generate: async (prompt: string) => {
      if (Math.random() < failureRate) {
        throw new Error('Simulated failure');
      }
      await delay(baseLatency + Math.random() * latencyVariance);
      return `Generated: ${prompt}`;
    },

    generateBatch: async (prompts: string[]) => {
      if (Math.random() < failureRate) {
        throw new Error('Simulated failure');
      }
      await delay((baseLatency * prompts.length * 0.5) + Math.random() * latencyVariance);
      return prompts.map(p => `Generated: ${p}`);
    },

    streaming: async function* (prompt: string) {
      const chunks = 10;
      for (let i = 0; i < chunks; i++) {
        await delay(baseLatency / chunks + Math.random() * (latencyVariance / chunks));
        yield `Chunk ${i + 1}`;
      }
    },

    evolve: async (config: any) => {
      await delay(baseLatency * config.populationSize * config.generations / 10);
      return { bestPrompt: config.seedPrompts[0], fitness: 0.9 };
    },

    mutate: async (prompt: string, strategy: string) => {
      await delay(baseLatency + Math.random() * latencyVariance);
      return `Mutated: ${prompt}`;
    },

    crossover: async (p1: string, p2: string, op: string) => {
      await delay(baseLatency + Math.random() * latencyVariance);
      return `Crossover: ${p1} + ${p2}`;
    },

    evaluateFitness: async (prompt: string, contexts: string[]) => {
      await delay(baseLatency * contexts.length / 3);
      return Math.random() * 0.3 + 0.7;
    },

    primaryModel: async (prompt: string) => {
      if (Math.random() < failureRate) {
        throw new Error('Primary model failed');
      }
      await delay(baseLatency + Math.random() * latencyVariance);
      return `Primary: ${prompt}`;
    },

    fallbackModel: async (prompt: string) => {
      await delay(baseLatency * 1.2 + Math.random() * latencyVariance);
      return `Fallback: ${prompt}`;
    },

    models: {
      fast: async (prompt: string) => {
        await delay(baseLatency * 0.5 + Math.random() * latencyVariance);
        return `Fast: ${prompt}`;
      },
      balanced: async (prompt: string) => {
        await delay(baseLatency + Math.random() * latencyVariance);
        return `Balanced: ${prompt}`;
      },
      quality: async (prompt: string) => {
        await delay(baseLatency * 2 + Math.random() * latencyVariance);
        return `Quality: ${prompt}`;
      },
    },
  };
}

/**
 * Helper: delay function
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create mock with realistic performance characteristics
 */
export function createRealisticMock() {
  return {
    generate: mockGenerate,
    generateBatch: mockGenerateBatch,
    streaming: mockStreaming,
    evolve: mockEvolve,
    mutate: mockMutate,
    crossover: mockCrossover,
    evaluateFitness: mockEvaluateFitness,
    primaryModel: mockPrimaryModel,
    fallbackModel: mockFallbackModel,
    models: mockModels,
  };
}
