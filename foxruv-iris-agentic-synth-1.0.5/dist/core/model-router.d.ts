import { ModelConfig } from '../schemas/prompt-schema.js';
/**
 * Optimized model router with:
 * - Request batching
 * - Connection pooling
 * - Context caching
 * - Automatic failover
 * - Rate limit handling
 */
export interface RouterConfig {
    maxRetries?: number;
    retryDelay?: number;
    requestTimeout?: number;
    maxConcurrentRequests?: number;
    enableBatching?: boolean;
    batchSize?: number;
    batchTimeout?: number;
}
export interface ModelRequest {
    id: string;
    prompt: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    [key: string]: any;
}
export interface ModelResponse {
    id: string;
    content: string;
    model: string;
    tokensUsed?: number;
    latency: number;
    cached: boolean;
}
/**
 * High-performance model router with optimizations
 */
export declare class ModelRouter {
    private routerConfig;
    private models;
    private primaryModel;
    private fallbackModels;
    private responseCache;
    private contextCache;
    private pendingBatch;
    private batchTimer;
    private activeRequests;
    private requestQueue;
    private metrics;
    constructor(models: ModelConfig[], primaryModel: string, fallbackModels?: string[], routerConfig?: RouterConfig);
    /**
     * Route request to appropriate model with optimizations
     */
    route(request: ModelRequest): Promise<ModelResponse>;
    /**
     * Batch multiple requests for efficiency
     */
    routeBatch(requests: ModelRequest[]): Promise<ModelResponse[]>;
    /**
     * Execute single request with failover and retry logic
     */
    private executeRequest;
    /**
     * Execute request with automatic retry
     */
    private executeWithRetry;
    /**
     * Try fallback models on failure
     */
    private tryFallback;
    /**
     * Execute batch of requests efficiently
     */
    private executeBatch;
    /**
     * Add request to batch queue
     */
    private batchRequest;
    /**
     * Flush pending batch
     */
    private flushBatch;
    /**
     * Wait for available connection slot
     */
    private waitForSlot;
    /**
     * Process queued requests
     */
    private processQueue;
    /**
     * Simulate model API call (replace with actual implementation)
     */
    private callModel;
    /**
     * Get router statistics
     */
    getStats(): {
        averageLatency: number;
        cacheHitRate: number;
        responseCache: {
            size: number;
            hits: number;
            misses: number;
            evictions: number;
            hitRate: number;
            maxSize: number;
            strategy: "lru" | "lfu" | "fifo";
        };
        contextCache: {
            size: number;
            hits: number;
            misses: number;
            evictions: number;
            hitRate: number;
            maxSize: number;
            strategy: "lru" | "lfu" | "fifo";
        };
        activeConnections: number;
        queueLength: number;
        totalRequests: number;
        cacheHits: number;
        cacheMisses: number;
        batchedRequests: number;
        failovers: number;
        errors: number;
        totalLatency: number;
    };
    private generateCacheKey;
    private hashPrompt;
    private sleep;
}
//# sourceMappingURL=model-router.d.ts.map