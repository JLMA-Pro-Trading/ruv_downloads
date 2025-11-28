/**
 * Retrieve Module - DSPy.ts
 *
 * Implements the Retrieve module for Retrieval-Augmented Generation (RAG).
 * Compatible with DSPy Python's dspy.Retrieve module.
 *
 * Usage:
 *   const retriever = new Retrieve({ k: 3 });
 *   await retriever.init(agentDBClient);
 *   const results = await retriever.run({ query: "What is machine learning?" });
 */
import { Module } from '../core/module';
import { AgentDBClient } from '../memory/agentdb/client';
export interface RetrieveConfig {
    /**
     * Number of passages to retrieve (default: 3)
     */
    k?: number;
    /**
     * Minimum similarity score threshold (0-1)
     */
    threshold?: number;
    /**
     * Whether to rerank results (default: false)
     */
    rerank?: boolean;
    /**
     * Custom retrieval function
     */
    retrieveFunction?: (query: string, k: number) => Promise<RetrieveResult[]>;
}
export interface RetrieveResult {
    /**
     * The retrieved passage text
     */
    passage: string;
    /**
     * Similarity score (0-1)
     */
    score: number;
    /**
     * Optional metadata
     */
    metadata?: Record<string, any>;
    /**
     * Passage ID
     */
    id?: string;
}
export interface RetrieveInput {
    query: string | string[];
}
export interface RetrieveOutput {
    passages: RetrieveResult[];
}
/**
 * Retrieve Module for RAG (Retrieval-Augmented Generation)
 *
 * This module retrieves relevant passages from a knowledge base
 * given a query. It can be used standalone or composed into larger
 * pipelines for question answering, summarization, etc.
 *
 * @example
 * ```typescript
 * // Initialize retriever
 * const retriever = new Retrieve({ k: 5, threshold: 0.7 });
 * await retriever.init(agentDB);
 *
 * // Retrieve passages
 * const result = await retriever.run({
 *   query: "What is the capital of France?"
 * });
 *
 * console.log(result.passages); // Top 5 relevant passages
 * ```
 */
export declare class Retrieve extends Module<RetrieveInput, RetrieveOutput> {
    private k;
    private threshold;
    private rerank;
    private retrieveFunction?;
    private agentDB?;
    private inMemoryStore;
    constructor(config?: RetrieveConfig);
    /**
     * Initialize the retriever with a database client
     */
    init(agentDB?: AgentDBClient): Promise<void>;
    /**
     * Store passages in the retrieval index
     *
     * @param passages - Array of passages to store
     * @param embedFunction - Function to generate embeddings
     */
    store(passages: Array<{
        text: string;
        metadata?: any;
    }>, embedFunction: (text: string) => Promise<number[]>): Promise<void>;
    /**
     * Run the retrieval
     */
    run(input: RetrieveInput): Promise<RetrieveOutput>;
    /**
     * Retrieve from AgentDB
     */
    private retrieveFromAgentDB;
    /**
     * Retrieve from in-memory store
     */
    private retrieveFromMemory;
    /**
     * Simple embedding function (for demonstration)
     * In production, use a proper embedding model
     */
    private simpleEmbed;
    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity;
    /**
     * Rerank passages (placeholder for more sophisticated reranking)
     */
    private rerankPassages;
    /**
     * Deduplicate passages based on content similarity
     */
    private deduplicatePassages;
}
