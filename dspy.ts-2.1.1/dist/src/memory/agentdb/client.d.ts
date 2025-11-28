/**
 * AgentDB Client
 *
 * Main client for interacting with AgentDB vector database
 */
import { AgentDBConfig } from './config';
import { VectorData, SearchResult, SearchOptions, BatchResult, AgentDBStats } from './types';
export declare class AgentDBClient {
    private config;
    private logger;
    private initialized;
    private db;
    private cache;
    private stats;
    constructor(config?: Partial<AgentDBConfig>);
    /**
     * Initialize AgentDB client
     */
    init(): Promise<void>;
    /**
     * Store a vector in the database
     */
    store(vector: number[], metadata?: Record<string, any>): Promise<string>;
    /**
     * Search for similar vectors
     */
    search(query: number[], options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Update a vector
     */
    update(id: string, data: Partial<Pick<VectorData, 'vector' | 'metadata'>>): Promise<void>;
    /**
     * Delete a vector
     */
    delete(id: string): Promise<void>;
    /**
     * Batch store vectors
     */
    batchStore(vectors: Array<{
        vector: number[];
        metadata?: Record<string, any>;
    }>): Promise<BatchResult<string>>;
    /**
     * Get statistics
     */
    getStats(): AgentDBStats;
    /**
     * Execute MCP tool
     */
    executeMCPTool(toolName: string, params: any): Promise<any>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Initialize MCP tools
     */
    private initializeMCPTools;
    /**
     * Start auto-save timer
     */
    private startAutoSave;
    /**
     * Ensure client is initialized
     */
    private ensureInitialized;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Get cache key for search
     */
    private getCacheKey;
    /**
     * Invalidate cache
     */
    private invalidateCache;
    /**
     * Update search statistics
     */
    private updateSearchStats;
    /**
     * Update cache hit rate
     */
    private updateCacheHitRate;
    /**
     * Create fallback in-memory database
     */
    private createFallbackDB;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
}
