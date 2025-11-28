import { z } from 'zod';
/**
 * Schema for prompt generation configuration
 */
export const PromptGenerationConfigSchema = z.object({
    seedPrompt: z.string().min(1, 'Seed prompt is required'),
    count: z.number().int().positive().default(10),
    diversity: z.number().min(0).max(1).default(0.8),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    streaming: z.boolean().default(true),
    model: z.string().optional(),
    fallbackModels: z.array(z.string()).optional(),
});
/**
 * Schema for evolution configuration
 */
export const EvolutionConfigSchema = z.object({
    seedPrompts: z.array(z.string()).min(1, 'At least one seed prompt required'),
    generations: z.number().int().positive().default(10),
    populationSize: z.number().int().positive().default(20),
    mutationRate: z.number().min(0).max(1).default(0.1),
    crossoverRate: z.number().min(0).max(1).default(0.7),
    eliteCount: z.number().int().nonnegative().default(2),
    mutationStrategies: z.array(z.enum(['zero_order', 'first_order', 'semantic_rewrite', 'hypermutation'])).default(['zero_order', 'first_order']),
    crossoverOperations: z.array(z.enum(['uniform', 'single_point', 'semantic'])).default(['uniform']),
    fitnessContexts: z.array(z.string()).optional(),
    maxFitnessEvaluations: z.number().int().positive().optional(),
    convergenceThreshold: z.number().min(0).max(1).optional(),
});
/**
 * Schema for evolved prompt with metadata
 */
export const EvolvedPromptSchema = z.object({
    id: z.string(),
    content: z.string(),
    generation: z.number().int().nonnegative(),
    fitness: z.number(),
    parentIds: z.array(z.string()),
    mutations: z.array(z.string()),
    timestamp: z.number(),
    metadata: z.record(z.any()).optional(),
});
/**
 * Schema for synthetic generation result
 */
export const SyntheticResultSchema = z.object({
    prompts: z.array(z.string()),
    metadata: z.object({
        seedPrompt: z.string(),
        count: z.number(),
        model: z.string(),
        timestamp: z.number(),
        latency: z.number().optional(),
        tokensUsed: z.number().optional(),
    }),
});
/**
 * Schema for model configuration
 */
export const ModelConfigSchema = z.object({
    name: z.string(),
    provider: z.enum(['gemini', 'claude', 'openrouter', 'openai']),
    apiKey: z.string().optional(),
    endpoint: z.string().url().optional(),
    maxTokens: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
});
/**
 * Schema for benchmark configuration
 */
export const BenchmarkConfigSchema = z.object({
    iterations: z.number().int().positive().default(100),
    concurrency: z.number().int().positive().default(10),
    warmupIterations: z.number().int().nonnegative().default(10),
    targetP99Latency: z.number().positive().default(100), // ms
    prompts: z.array(z.string()).min(1),
});
/**
 * Schema for cache configuration
 */
export const CacheConfigSchema = z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().int().positive().default(3600000), // 1 hour in ms
    maxSize: z.number().int().positive().default(1000),
    strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
});
/**
 * Schema for vector store configuration
 */
export const VectorStoreConfigSchema = z.object({
    enabled: z.boolean().default(false),
    dimensions: z.number().int().positive().default(384),
    indexType: z.enum(['hnsw', 'flat']).default('hnsw'),
    quantization: z.enum(['none', 'scalar', 'product']).default('none'),
    similarityMetric: z.enum(['cosine', 'euclidean', 'dot']).default('cosine'),
    maxResults: z.number().int().positive().default(10),
});
/**
 * Main AgenticSynth configuration schema
 */
export const AgenticSynthConfigSchema = z.object({
    streaming: z.boolean().default(true),
    models: z.array(z.string()).min(1, 'At least one model required'),
    primaryModel: z.string().optional(),
    cache: CacheConfigSchema.optional(),
    vectorStore: VectorStoreConfigSchema.optional(),
    automation: z.object({
        enabled: z.boolean().default(false),
        workflows: z.array(z.string()).optional(),
    }).optional(),
    performance: z.object({
        enableMetrics: z.boolean().default(true),
        trackLatency: z.boolean().default(true),
        trackTokens: z.boolean().default(true),
    }).optional(),
});
//# sourceMappingURL=prompt-schema.js.map