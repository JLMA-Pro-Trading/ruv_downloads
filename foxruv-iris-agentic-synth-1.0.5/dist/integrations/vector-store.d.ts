/**
 * Vector store integration with ruvector for semantic search
 */
import { VectorStoreConfig } from '../schemas/prompt-schema.js';
export interface VectorEntry {
    id: string;
    content: string;
    vector: number[];
    metadata?: Record<string, any>;
}
export interface SearchResult {
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, any>;
}
/**
 * Vector store client for semantic prompt retrieval
 */
export declare class VectorStore {
    private config;
    private isAvailable;
    private entries;
    private nextId;
    constructor(config?: Partial<VectorStoreConfig>);
    /**
     * Check if ruvector is available
     */
    private checkAvailability;
    /**
     * Add prompt to vector store
     */
    add(content: string, metadata?: Record<string, any>): Promise<string>;
    /**
     * Add multiple prompts
     */
    addBatch(prompts: string[], metadata?: Record<string, any>[]): Promise<string[]>;
    /**
     * Search for similar prompts
     */
    search(query: string, limit?: number): Promise<SearchResult[]>;
    /**
     * Get entry by ID
     */
    get(id: string): VectorEntry | undefined;
    /**
     * Delete entry
     */
    delete(id: string): boolean;
    /**
     * Clear all entries
     */
    clear(): void;
    /**
     * Get store size
     */
    size(): number;
    /**
     * Embed text to vector
     */
    private embed;
    /**
     * Fallback embedding using simple hashing
     */
    private fallbackEmbed;
    /**
     * Simple hash function
     */
    private simpleHash;
    /**
     * Calculate similarity between vectors
     */
    private calculateSimilarity;
    /**
     * Cosine similarity
     */
    private cosineSimilarity;
    /**
     * Euclidean distance
     */
    private euclideanDistance;
    /**
     * Dot product
     */
    private dotProduct;
    /**
     * Check if vector store is available
     */
    available(): boolean;
    /**
     * Get store statistics
     */
    getStats(): {
        size: number;
        dimensions: number;
        indexType: "flat" | "hnsw";
        similarityMetric: "cosine" | "euclidean" | "dot";
        available: boolean;
    };
}
/**
 * Create vector store with defaults
 */
export declare function createVectorStore(config?: Partial<VectorStoreConfig>): VectorStore;
//# sourceMappingURL=vector-store.d.ts.map