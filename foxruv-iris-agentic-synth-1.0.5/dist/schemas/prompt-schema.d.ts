import { z } from 'zod';
/**
 * Schema for prompt generation configuration
 */
export declare const PromptGenerationConfigSchema: z.ZodObject<{
    seedPrompt: z.ZodString;
    count: z.ZodDefault<z.ZodNumber>;
    diversity: z.ZodDefault<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    streaming: z.ZodDefault<z.ZodBoolean>;
    model: z.ZodOptional<z.ZodString>;
    fallbackModels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    seedPrompt: string;
    count: number;
    diversity: number;
    streaming: boolean;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    model?: string | undefined;
    fallbackModels?: string[] | undefined;
}, {
    seedPrompt: string;
    count?: number | undefined;
    diversity?: number | undefined;
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    streaming?: boolean | undefined;
    model?: string | undefined;
    fallbackModels?: string[] | undefined;
}>;
export type PromptGenerationConfig = z.infer<typeof PromptGenerationConfigSchema>;
/**
 * Schema for evolution configuration
 */
export declare const EvolutionConfigSchema: z.ZodObject<{
    seedPrompts: z.ZodArray<z.ZodString, "many">;
    generations: z.ZodDefault<z.ZodNumber>;
    populationSize: z.ZodDefault<z.ZodNumber>;
    mutationRate: z.ZodDefault<z.ZodNumber>;
    crossoverRate: z.ZodDefault<z.ZodNumber>;
    eliteCount: z.ZodDefault<z.ZodNumber>;
    mutationStrategies: z.ZodDefault<z.ZodArray<z.ZodEnum<["zero_order", "first_order", "semantic_rewrite", "hypermutation"]>, "many">>;
    crossoverOperations: z.ZodDefault<z.ZodArray<z.ZodEnum<["uniform", "single_point", "semantic"]>, "many">>;
    fitnessContexts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxFitnessEvaluations: z.ZodOptional<z.ZodNumber>;
    convergenceThreshold: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    seedPrompts: string[];
    generations: number;
    populationSize: number;
    mutationRate: number;
    crossoverRate: number;
    eliteCount: number;
    mutationStrategies: ("zero_order" | "first_order" | "semantic_rewrite" | "hypermutation")[];
    crossoverOperations: ("uniform" | "single_point" | "semantic")[];
    fitnessContexts?: string[] | undefined;
    maxFitnessEvaluations?: number | undefined;
    convergenceThreshold?: number | undefined;
}, {
    seedPrompts: string[];
    generations?: number | undefined;
    populationSize?: number | undefined;
    mutationRate?: number | undefined;
    crossoverRate?: number | undefined;
    eliteCount?: number | undefined;
    mutationStrategies?: ("zero_order" | "first_order" | "semantic_rewrite" | "hypermutation")[] | undefined;
    crossoverOperations?: ("uniform" | "single_point" | "semantic")[] | undefined;
    fitnessContexts?: string[] | undefined;
    maxFitnessEvaluations?: number | undefined;
    convergenceThreshold?: number | undefined;
}>;
export type EvolutionConfig = z.infer<typeof EvolutionConfigSchema>;
/**
 * Schema for evolved prompt with metadata
 */
export declare const EvolvedPromptSchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodString;
    generation: z.ZodNumber;
    fitness: z.ZodNumber;
    parentIds: z.ZodArray<z.ZodString, "many">;
    mutations: z.ZodArray<z.ZodString, "many">;
    timestamp: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    content: string;
    generation: number;
    fitness: number;
    parentIds: string[];
    mutations: string[];
    timestamp: number;
    metadata?: Record<string, any> | undefined;
}, {
    id: string;
    content: string;
    generation: number;
    fitness: number;
    parentIds: string[];
    mutations: string[];
    timestamp: number;
    metadata?: Record<string, any> | undefined;
}>;
export type EvolvedPrompt = z.infer<typeof EvolvedPromptSchema>;
/**
 * Schema for synthetic generation result
 */
export declare const SyntheticResultSchema: z.ZodObject<{
    prompts: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodObject<{
        seedPrompt: z.ZodString;
        count: z.ZodNumber;
        model: z.ZodString;
        timestamp: z.ZodNumber;
        latency: z.ZodOptional<z.ZodNumber>;
        tokensUsed: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        seedPrompt: string;
        count: number;
        model: string;
        timestamp: number;
        latency?: number | undefined;
        tokensUsed?: number | undefined;
    }, {
        seedPrompt: string;
        count: number;
        model: string;
        timestamp: number;
        latency?: number | undefined;
        tokensUsed?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        seedPrompt: string;
        count: number;
        model: string;
        timestamp: number;
        latency?: number | undefined;
        tokensUsed?: number | undefined;
    };
    prompts: string[];
}, {
    metadata: {
        seedPrompt: string;
        count: number;
        model: string;
        timestamp: number;
        latency?: number | undefined;
        tokensUsed?: number | undefined;
    };
    prompts: string[];
}>;
export type SyntheticResult = z.infer<typeof SyntheticResultSchema>;
/**
 * Schema for model configuration
 */
export declare const ModelConfigSchema: z.ZodObject<{
    name: z.ZodString;
    provider: z.ZodEnum<["gemini", "claude", "openrouter", "openai"]>;
    apiKey: z.ZodOptional<z.ZodString>;
    endpoint: z.ZodOptional<z.ZodString>;
    maxTokens: z.ZodOptional<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
    topP: z.ZodOptional<z.ZodNumber>;
    frequencyPenalty: z.ZodOptional<z.ZodNumber>;
    presencePenalty: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    provider: "gemini" | "claude" | "openrouter" | "openai";
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    apiKey?: string | undefined;
    endpoint?: string | undefined;
    topP?: number | undefined;
    frequencyPenalty?: number | undefined;
    presencePenalty?: number | undefined;
}, {
    name: string;
    provider: "gemini" | "claude" | "openrouter" | "openai";
    temperature?: number | undefined;
    maxTokens?: number | undefined;
    apiKey?: string | undefined;
    endpoint?: string | undefined;
    topP?: number | undefined;
    frequencyPenalty?: number | undefined;
    presencePenalty?: number | undefined;
}>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
/**
 * Schema for benchmark configuration
 */
export declare const BenchmarkConfigSchema: z.ZodObject<{
    iterations: z.ZodDefault<z.ZodNumber>;
    concurrency: z.ZodDefault<z.ZodNumber>;
    warmupIterations: z.ZodDefault<z.ZodNumber>;
    targetP99Latency: z.ZodDefault<z.ZodNumber>;
    prompts: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    prompts: string[];
    iterations: number;
    concurrency: number;
    warmupIterations: number;
    targetP99Latency: number;
}, {
    prompts: string[];
    iterations?: number | undefined;
    concurrency?: number | undefined;
    warmupIterations?: number | undefined;
    targetP99Latency?: number | undefined;
}>;
export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;
/**
 * Schema for cache configuration
 */
export declare const CacheConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    ttl: z.ZodDefault<z.ZodNumber>;
    maxSize: z.ZodDefault<z.ZodNumber>;
    strategy: z.ZodDefault<z.ZodEnum<["lru", "lfu", "fifo"]>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    strategy: "lru" | "lfu" | "fifo";
}, {
    enabled?: boolean | undefined;
    ttl?: number | undefined;
    maxSize?: number | undefined;
    strategy?: "lru" | "lfu" | "fifo" | undefined;
}>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
/**
 * Schema for vector store configuration
 */
export declare const VectorStoreConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    dimensions: z.ZodDefault<z.ZodNumber>;
    indexType: z.ZodDefault<z.ZodEnum<["hnsw", "flat"]>>;
    quantization: z.ZodDefault<z.ZodEnum<["none", "scalar", "product"]>>;
    similarityMetric: z.ZodDefault<z.ZodEnum<["cosine", "euclidean", "dot"]>>;
    maxResults: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    dimensions: number;
    indexType: "flat" | "hnsw";
    quantization: "none" | "scalar" | "product";
    similarityMetric: "cosine" | "euclidean" | "dot";
    maxResults: number;
}, {
    enabled?: boolean | undefined;
    dimensions?: number | undefined;
    indexType?: "flat" | "hnsw" | undefined;
    quantization?: "none" | "scalar" | "product" | undefined;
    similarityMetric?: "cosine" | "euclidean" | "dot" | undefined;
    maxResults?: number | undefined;
}>;
export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;
/**
 * Main AgenticSynth configuration schema
 */
export declare const AgenticSynthConfigSchema: z.ZodObject<{
    streaming: z.ZodDefault<z.ZodBoolean>;
    models: z.ZodArray<z.ZodString, "many">;
    primaryModel: z.ZodOptional<z.ZodString>;
    cache: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        ttl: z.ZodDefault<z.ZodNumber>;
        maxSize: z.ZodDefault<z.ZodNumber>;
        strategy: z.ZodDefault<z.ZodEnum<["lru", "lfu", "fifo"]>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        ttl: number;
        maxSize: number;
        strategy: "lru" | "lfu" | "fifo";
    }, {
        enabled?: boolean | undefined;
        ttl?: number | undefined;
        maxSize?: number | undefined;
        strategy?: "lru" | "lfu" | "fifo" | undefined;
    }>>;
    vectorStore: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        dimensions: z.ZodDefault<z.ZodNumber>;
        indexType: z.ZodDefault<z.ZodEnum<["hnsw", "flat"]>>;
        quantization: z.ZodDefault<z.ZodEnum<["none", "scalar", "product"]>>;
        similarityMetric: z.ZodDefault<z.ZodEnum<["cosine", "euclidean", "dot"]>>;
        maxResults: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        dimensions: number;
        indexType: "flat" | "hnsw";
        quantization: "none" | "scalar" | "product";
        similarityMetric: "cosine" | "euclidean" | "dot";
        maxResults: number;
    }, {
        enabled?: boolean | undefined;
        dimensions?: number | undefined;
        indexType?: "flat" | "hnsw" | undefined;
        quantization?: "none" | "scalar" | "product" | undefined;
        similarityMetric?: "cosine" | "euclidean" | "dot" | undefined;
        maxResults?: number | undefined;
    }>>;
    automation: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        workflows: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        workflows?: string[] | undefined;
    }, {
        enabled?: boolean | undefined;
        workflows?: string[] | undefined;
    }>>;
    performance: z.ZodOptional<z.ZodObject<{
        enableMetrics: z.ZodDefault<z.ZodBoolean>;
        trackLatency: z.ZodDefault<z.ZodBoolean>;
        trackTokens: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enableMetrics: boolean;
        trackLatency: boolean;
        trackTokens: boolean;
    }, {
        enableMetrics?: boolean | undefined;
        trackLatency?: boolean | undefined;
        trackTokens?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    streaming: boolean;
    models: string[];
    primaryModel?: string | undefined;
    cache?: {
        enabled: boolean;
        ttl: number;
        maxSize: number;
        strategy: "lru" | "lfu" | "fifo";
    } | undefined;
    vectorStore?: {
        enabled: boolean;
        dimensions: number;
        indexType: "flat" | "hnsw";
        quantization: "none" | "scalar" | "product";
        similarityMetric: "cosine" | "euclidean" | "dot";
        maxResults: number;
    } | undefined;
    automation?: {
        enabled: boolean;
        workflows?: string[] | undefined;
    } | undefined;
    performance?: {
        enableMetrics: boolean;
        trackLatency: boolean;
        trackTokens: boolean;
    } | undefined;
}, {
    models: string[];
    streaming?: boolean | undefined;
    primaryModel?: string | undefined;
    cache?: {
        enabled?: boolean | undefined;
        ttl?: number | undefined;
        maxSize?: number | undefined;
        strategy?: "lru" | "lfu" | "fifo" | undefined;
    } | undefined;
    vectorStore?: {
        enabled?: boolean | undefined;
        dimensions?: number | undefined;
        indexType?: "flat" | "hnsw" | undefined;
        quantization?: "none" | "scalar" | "product" | undefined;
        similarityMetric?: "cosine" | "euclidean" | "dot" | undefined;
        maxResults?: number | undefined;
    } | undefined;
    automation?: {
        enabled?: boolean | undefined;
        workflows?: string[] | undefined;
    } | undefined;
    performance?: {
        enableMetrics?: boolean | undefined;
        trackLatency?: boolean | undefined;
        trackTokens?: boolean | undefined;
    } | undefined;
}>;
export type AgenticSynthConfig = z.infer<typeof AgenticSynthConfigSchema>;
//# sourceMappingURL=prompt-schema.d.ts.map