"use strict";
/**
 * AgentDB Client
 *
 * Main client for interacting with AgentDB vector database
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentDBClient = void 0;
const pino_1 = __importDefault(require("pino"));
const async_retry_1 = __importDefault(require("async-retry"));
const config_1 = require("./config");
class AgentDBClient {
    constructor(config) {
        this.initialized = false;
        this.cache = new Map();
        this.stats = {
            totalVectors: 0,
            indexSize: 0,
            memoryUsage: 0,
            totalSearches: 0,
            avgSearchLatency: 0,
            cacheHitRate: 0,
        };
        this.config = (0, config_1.mergeConfig)(config || {});
        this.logger = (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info',
            name: 'agentdb-client',
        });
    }
    /**
     * Initialize AgentDB client
     */
    async init() {
        if (this.initialized) {
            this.logger.warn('AgentDB client already initialized');
            return;
        }
        try {
            this.logger.info('Initializing AgentDB client', {
                config: {
                    vectorDimension: this.config.vectorDimension,
                    indexType: this.config.indexType,
                    mcpEnabled: this.config.mcpEnabled,
                },
            });
            // Import AgentDB dynamically
            // Note: AgentDB integration is placeholder for now
            // In production, replace with actual AgentDB initialization
            try {
                const AgentDB = await Promise.resolve().then(() => __importStar(require('agentdb')));
                // Initialize database with proper type handling
                this.db = new AgentDB.default(Object.assign(Object.assign({ dimension: this.config.vectorDimension, indexType: this.config.indexType }, this.config.hnswParams), { storage: this.config.storage }));
                if (this.db && typeof this.db.init === 'function') {
                    await this.db.init();
                }
            }
            catch (error) {
                // AgentDB may not be available in all environments
                this.logger.warn('AgentDB not available, using in-memory fallback', { error });
                this.db = this.createFallbackDB();
            }
            // Initialize MCP tools if enabled
            if (this.config.mcpEnabled) {
                await this.initializeMCPTools();
            }
            // Start auto-save if configured
            if (this.config.storage.autoSaveInterval &&
                !this.config.storage.inMemory) {
                this.startAutoSave();
            }
            this.initialized = true;
            this.logger.info('AgentDB client initialized successfully');
        }
        catch (error) {
            this.logger.error('Failed to initialize AgentDB client', { error });
            throw new Error(`AgentDB initialization failed: ${error}`);
        }
    }
    /**
     * Store a vector in the database
     */
    async store(vector, metadata = {}) {
        this.ensureInitialized();
        if (vector.length !== this.config.vectorDimension) {
            throw new Error(`Vector dimension mismatch: expected ${this.config.vectorDimension}, got ${vector.length}`);
        }
        try {
            const id = this.generateId();
            const now = new Date();
            const data = {
                id,
                vector,
                metadata,
                createdAt: now,
                updatedAt: now,
            };
            await (0, async_retry_1.default)(async () => {
                await this.db.insert(id, vector, metadata);
            }, {
                retries: 3,
                minTimeout: 100,
                maxTimeout: 1000,
            });
            this.stats.totalVectors++;
            this.invalidateCache();
            this.logger.debug('Vector stored', { id, metadataKeys: Object.keys(metadata) });
            return id;
        }
        catch (error) {
            this.logger.error('Failed to store vector', { error });
            throw error;
        }
    }
    /**
     * Search for similar vectors
     */
    async search(query, options = {}) {
        this.ensureInitialized();
        const { k = 10, minScore = 0.0, filter = {}, includeVectors = false, metric = 'cosine', } = options;
        // Check cache
        const cacheKey = this.getCacheKey(query, options);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.stats.totalSearches++;
            this.updateCacheHitRate(true);
            return cached;
        }
        try {
            const startTime = Date.now();
            const results = await (0, async_retry_1.default)(async () => {
                return await this.db.search(query, {
                    k,
                    metric,
                    filter: Object.keys(filter).length > 0 ? filter : undefined,
                });
            }, {
                retries: 3,
                minTimeout: 100,
                maxTimeout: 1000,
            });
            // Transform results
            const searchResults = results
                .map((r) => ({
                id: r.id,
                score: r.score,
                distance: r.distance,
                data: {
                    id: r.id,
                    vector: includeVectors ? r.vector : [],
                    metadata: r.metadata || {},
                    createdAt: r.createdAt || new Date(),
                    updatedAt: r.updatedAt || new Date(),
                },
            }))
                .filter((r) => r.score >= minScore);
            // Update stats
            const latency = Date.now() - startTime;
            this.updateSearchStats(latency);
            // Cache results
            if (this.cache.size < this.config.performance.cacheSize) {
                this.cache.set(cacheKey, searchResults);
            }
            this.updateCacheHitRate(false);
            this.logger.debug('Search completed', {
                resultsCount: searchResults.length,
                latency,
            });
            return searchResults;
        }
        catch (error) {
            this.logger.error('Search failed', { error });
            throw error;
        }
    }
    /**
     * Update a vector
     */
    async update(id, data) {
        this.ensureInitialized();
        try {
            await (0, async_retry_1.default)(async () => {
                if (data.vector) {
                    await this.db.update(id, data.vector, data.metadata);
                }
                else if (data.metadata) {
                    await this.db.updateMetadata(id, data.metadata);
                }
            }, {
                retries: 3,
                minTimeout: 100,
                maxTimeout: 1000,
            });
            this.invalidateCache();
            this.logger.debug('Vector updated', { id });
        }
        catch (error) {
            this.logger.error('Failed to update vector', { id, error });
            throw error;
        }
    }
    /**
     * Delete a vector
     */
    async delete(id) {
        this.ensureInitialized();
        try {
            await (0, async_retry_1.default)(async () => {
                await this.db.delete(id);
            }, {
                retries: 3,
                minTimeout: 100,
                maxTimeout: 1000,
            });
            this.stats.totalVectors--;
            this.invalidateCache();
            this.logger.debug('Vector deleted', { id });
        }
        catch (error) {
            this.logger.error('Failed to delete vector', { id, error });
            throw error;
        }
    }
    /**
     * Batch store vectors
     */
    async batchStore(vectors) {
        this.ensureInitialized();
        if (!this.config.performance.batchEnabled) {
            throw new Error('Batch operations are disabled');
        }
        const success = [];
        const failed = [];
        for (let i = 0; i < vectors.length; i++) {
            try {
                const id = await this.store(vectors[i].vector, vectors[i].metadata);
                success.push(id);
            }
            catch (error) {
                failed.push({ index: i, error: error });
            }
        }
        this.logger.info('Batch store completed', {
            success: success.length,
            failed: failed.length,
        });
        return { success, failed };
    }
    /**
     * Get statistics
     */
    getStats() {
        return Object.assign({}, this.stats);
    }
    /**
     * Execute MCP tool
     */
    async executeMCPTool(toolName, params) {
        this.ensureInitialized();
        if (!this.config.mcpEnabled) {
            throw new Error('MCP tools are disabled');
        }
        try {
            const result = await this.db.executeTool(toolName, params);
            this.logger.debug('MCP tool executed', { toolName });
            return result;
        }
        catch (error) {
            this.logger.error('MCP tool execution failed', { toolName, error });
            throw error;
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (!this.initialized) {
            return;
        }
        try {
            this.logger.info('Cleaning up AgentDB client');
            if (this.db) {
                await this.db.close();
            }
            this.cache.clear();
            this.initialized = false;
            this.logger.info('AgentDB client cleaned up');
        }
        catch (error) {
            this.logger.error('Cleanup failed', { error });
            throw error;
        }
    }
    /**
     * Initialize MCP tools
     */
    async initializeMCPTools() {
        this.logger.info('Initializing MCP tools');
        if (this.db && typeof this.db.initializeMCP === 'function') {
            await this.db.initializeMCP({
                frontierMemory: this.config.frontierMemory,
            });
        }
    }
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        setInterval(async () => {
            try {
                if (this.db && typeof this.db.save === 'function') {
                    await this.db.save();
                    this.logger.debug('Auto-save completed');
                }
            }
            catch (error) {
                this.logger.error('Auto-save failed', { error });
            }
        }, this.config.storage.autoSaveInterval);
    }
    /**
     * Ensure client is initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('AgentDB client not initialized. Call init() first.');
        }
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get cache key for search
     */
    getCacheKey(query, options) {
        return JSON.stringify({ query, options });
    }
    /**
     * Invalidate cache
     */
    invalidateCache() {
        this.cache.clear();
    }
    /**
     * Update search statistics
     */
    updateSearchStats(latency) {
        this.stats.totalSearches++;
        this.stats.avgSearchLatency =
            (this.stats.avgSearchLatency * (this.stats.totalSearches - 1) + latency) /
                this.stats.totalSearches;
    }
    /**
     * Update cache hit rate
     */
    updateCacheHitRate(hit) {
        const total = this.stats.totalSearches;
        const currentHits = this.stats.cacheHitRate * (total - 1);
        this.stats.cacheHitRate = (currentHits + (hit ? 1 : 0)) / total;
    }
    /**
     * Create fallback in-memory database
     */
    createFallbackDB() {
        const storage = new Map();
        return {
            init: async () => { },
            insert: async (id, vector, metadata) => {
                storage.set(id, { vector, metadata });
            },
            search: async (query, options) => {
                // Simple cosine similarity search
                const results = [];
                for (const [id, data] of storage.entries()) {
                    const similarity = this.cosineSimilarity(query, data.vector);
                    results.push({
                        id,
                        score: similarity,
                        distance: 1 - similarity,
                        vector: data.vector,
                        metadata: data.metadata,
                    });
                }
                return results
                    .sort((a, b) => b.score - a.score)
                    .slice(0, options.k || 10);
            },
            update: async (id, vector, metadata) => {
                if (storage.has(id)) {
                    storage.set(id, { vector, metadata });
                }
            },
            updateMetadata: async (id, metadata) => {
                const existing = storage.get(id);
                if (existing) {
                    storage.set(id, Object.assign(Object.assign({}, existing), { metadata }));
                }
            },
            delete: async (id) => {
                storage.delete(id);
            },
            close: async () => {
                storage.clear();
            },
        };
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length)
            return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
exports.AgentDBClient = AgentDBClient;
//# sourceMappingURL=client.js.map