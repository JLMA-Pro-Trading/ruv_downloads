import { PerformanceCache } from './cache.js';
/**
 * High-performance model router with optimizations
 */
export class ModelRouter {
    routerConfig;
    models;
    primaryModel;
    fallbackModels;
    // Caching layers
    responseCache;
    contextCache;
    // Request batching
    pendingBatch = [];
    batchTimer = null;
    // Connection pooling
    activeRequests = new Map();
    requestQueue = [];
    // Performance metrics
    metrics = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        batchedRequests: 0,
        failovers: 0,
        errors: 0,
        totalLatency: 0,
    };
    constructor(models, primaryModel, fallbackModels = [], routerConfig = {}) {
        this.routerConfig = routerConfig;
        this.models = new Map(models.map((m) => [m.name, m]));
        this.primaryModel = primaryModel;
        this.fallbackModels = fallbackModels;
        // Set defaults
        this.routerConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            requestTimeout: 30000,
            maxConcurrentRequests: 10,
            enableBatching: true,
            batchSize: 5,
            batchTimeout: 100,
            ...routerConfig,
        };
        // Initialize caches
        this.responseCache = new PerformanceCache({
            enabled: true,
            maxSize: 1000,
            ttl: 3600000, // 1 hour
            strategy: 'lru',
        });
        this.contextCache = new PerformanceCache({
            enabled: true,
            maxSize: 100,
            ttl: 3600000,
            strategy: 'lru',
        });
    }
    /**
     * Route request to appropriate model with optimizations
     */
    async route(request) {
        this.metrics.totalRequests++;
        const startTime = Date.now();
        // Check response cache first
        const cacheKey = this.generateCacheKey(request);
        const cached = this.responseCache.get(cacheKey);
        if (cached) {
            this.metrics.cacheHits++;
            return {
                id: request.id,
                content: cached,
                model: request.model || this.primaryModel,
                latency: Date.now() - startTime,
                cached: true,
            };
        }
        this.metrics.cacheMisses++;
        // Use batching if enabled
        if (this.routerConfig.enableBatching) {
            return this.batchRequest(request);
        }
        // Direct request with connection pooling
        return this.executeRequest(request, startTime);
    }
    /**
     * Batch multiple requests for efficiency
     */
    async routeBatch(requests) {
        // Check cache for each request
        const uncachedRequests = [];
        const responses = new Map();
        for (const request of requests) {
            const cacheKey = this.generateCacheKey(request);
            const cached = this.responseCache.get(cacheKey);
            if (cached) {
                this.metrics.cacheHits++;
                responses.set(request.id, {
                    id: request.id,
                    content: cached,
                    model: request.model || this.primaryModel,
                    latency: 0,
                    cached: true,
                });
            }
            else {
                uncachedRequests.push(request);
            }
        }
        // Execute uncached requests in parallel with concurrency limit
        if (uncachedRequests.length > 0) {
            const batchResponses = await this.executeBatch(uncachedRequests);
            batchResponses.forEach((response) => {
                responses.set(response.id, response);
            });
        }
        // Return in original order
        return requests.map((req) => responses.get(req.id));
    }
    /**
     * Execute single request with failover and retry logic
     */
    async executeRequest(request, startTime) {
        const modelName = request.model || this.primaryModel;
        const modelConfig = this.models.get(modelName);
        if (!modelConfig) {
            throw new Error(`Model not found: ${modelName}`);
        }
        // Wait for available connection slot
        await this.waitForSlot(modelName);
        try {
            // Increment active requests
            this.activeRequests.set(modelName, (this.activeRequests.get(modelName) || 0) + 1);
            // Execute with retry logic
            const content = await this.executeWithRetry(request, modelConfig);
            // Cache the response
            const cacheKey = this.generateCacheKey(request);
            this.responseCache.set(cacheKey, content);
            const latency = Date.now() - startTime;
            this.metrics.totalLatency += latency;
            return {
                id: request.id,
                content,
                model: modelName,
                latency,
                cached: false,
            };
        }
        catch (error) {
            // Try fallback models
            return this.tryFallback(request, startTime, error);
        }
        finally {
            // Decrement active requests
            const current = this.activeRequests.get(modelName) || 0;
            this.activeRequests.set(modelName, Math.max(0, current - 1));
            // Process queue
            this.processQueue();
        }
    }
    /**
     * Execute request with automatic retry
     */
    async executeWithRetry(request, modelConfig, attempt = 1) {
        try {
            // Check context cache for similar prompts
            const contextKey = this.hashPrompt(request.prompt);
            const cachedContext = this.contextCache.get(contextKey);
            // Simulate model call (replace with actual implementation)
            const response = await this.callModel(request, modelConfig, cachedContext);
            // Cache context for future requests
            if (response.context) {
                this.contextCache.set(contextKey, response.context);
            }
            return response.content;
        }
        catch (error) {
            if (attempt >= this.routerConfig.maxRetries) {
                throw error;
            }
            // Exponential backoff
            const delay = this.routerConfig.retryDelay * Math.pow(2, attempt - 1);
            await this.sleep(delay);
            return this.executeWithRetry(request, modelConfig, attempt + 1);
        }
    }
    /**
     * Try fallback models on failure
     */
    async tryFallback(request, startTime, originalError) {
        for (const fallbackModel of this.fallbackModels) {
            try {
                this.metrics.failovers++;
                const fallbackRequest = { ...request, model: fallbackModel };
                return await this.executeRequest(fallbackRequest, startTime);
            }
            catch (error) {
                // Continue to next fallback
                continue;
            }
        }
        // All fallbacks failed
        this.metrics.errors++;
        throw new Error(`All models failed. Original error: ${originalError.message}`);
    }
    /**
     * Execute batch of requests efficiently
     */
    async executeBatch(requests) {
        this.metrics.batchedRequests += requests.length;
        // Group by model for efficient batching
        const modelGroups = new Map();
        for (const request of requests) {
            const model = request.model || this.primaryModel;
            if (!modelGroups.has(model)) {
                modelGroups.set(model, []);
            }
            modelGroups.get(model).push(request);
        }
        // Execute each model group in parallel
        const groupPromises = Array.from(modelGroups.entries()).map(async ([_model, modelRequests]) => {
            return Promise.all(modelRequests.map((request) => this.executeRequest(request, Date.now())));
        });
        const groupResults = await Promise.all(groupPromises);
        return groupResults.flat();
    }
    /**
     * Add request to batch queue
     */
    batchRequest(request) {
        return new Promise((resolve, reject) => {
            this.pendingBatch.push(request);
            // Set timeout to flush batch
            if (!this.batchTimer) {
                this.batchTimer = setTimeout(() => {
                    this.flushBatch();
                }, this.routerConfig.batchTimeout);
            }
            // Flush immediately if batch is full
            if (this.pendingBatch.length >= this.routerConfig.batchSize) {
                if (this.batchTimer) {
                    clearTimeout(this.batchTimer);
                    this.batchTimer = null;
                }
                this.flushBatch();
            }
            // Store resolver
            this.requestQueue.push({ request, resolve, reject });
        });
    }
    /**
     * Flush pending batch
     */
    async flushBatch() {
        if (this.pendingBatch.length === 0)
            return;
        const batch = [...this.pendingBatch];
        const queue = [...this.requestQueue];
        this.pendingBatch = [];
        this.requestQueue = [];
        this.batchTimer = null;
        try {
            const responses = await this.executeBatch(batch);
            // Resolve all pending promises
            queue.forEach(({ request, resolve }) => {
                const response = responses.find((r) => r.id === request.id);
                if (response) {
                    resolve(response);
                }
            });
        }
        catch (error) {
            queue.forEach(({ reject }) => reject(error));
        }
    }
    /**
     * Wait for available connection slot
     */
    async waitForSlot(modelName) {
        const maxConcurrent = this.routerConfig.maxConcurrentRequests;
        while ((this.activeRequests.get(modelName) || 0) >= maxConcurrent) {
            await this.sleep(10);
        }
    }
    /**
     * Process queued requests
     */
    processQueue() {
        // Implementation would process any queued requests
        // when slots become available
    }
    /**
     * Simulate model API call (replace with actual implementation)
     */
    async callModel(request, _config, cachedContext) {
        // This would be replaced with actual model API calls
        // For now, simulate with delay
        await this.sleep(100);
        return {
            content: `Response for: ${request.prompt.slice(0, 50)}...`,
            context: cachedContext || {},
        };
    }
    /**
     * Get router statistics
     */
    getStats() {
        return {
            ...this.metrics,
            averageLatency: this.metrics.totalRequests > 0
                ? this.metrics.totalLatency / this.metrics.totalRequests
                : 0,
            cacheHitRate: this.metrics.totalRequests > 0
                ? this.metrics.cacheHits / this.metrics.totalRequests
                : 0,
            responseCache: this.responseCache.getStats(),
            contextCache: this.contextCache.getStats(),
            activeConnections: Array.from(this.activeRequests.values()).reduce((sum, count) => sum + count, 0),
            queueLength: this.requestQueue.length,
        };
    }
    // Utility methods
    generateCacheKey(request) {
        return `${request.model || this.primaryModel}:${this.hashPrompt(request.prompt)}`;
    }
    hashPrompt(prompt) {
        let hash = 0;
        for (let i = 0; i < prompt.length; i++) {
            const char = prompt.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
//# sourceMappingURL=model-router.js.map