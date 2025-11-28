"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Retrieve = void 0;
const module_1 = require("../core/module");
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
class Retrieve extends module_1.Module {
    constructor(config = {}) {
        const signature = {
            inputs: [
                {
                    name: 'query',
                    type: 'string',
                    description: 'The search query or queries',
                    required: true,
                },
            ],
            outputs: [
                {
                    name: 'passages',
                    type: 'object',
                    description: 'Retrieved passages with scores',
                    required: true,
                },
            ],
        };
        super({
            name: 'Retrieve',
            signature,
            strategy: 'Predict',
        });
        this.inMemoryStore = new Map();
        this.k = config.k || 3;
        this.threshold = config.threshold || 0.0;
        this.rerank = config.rerank || false;
        this.retrieveFunction = config.retrieveFunction;
    }
    /**
     * Initialize the retriever with a database client
     */
    async init(agentDB) {
        if (agentDB) {
            this.agentDB = agentDB;
            await this.agentDB.init();
        }
    }
    /**
     * Store passages in the retrieval index
     *
     * @param passages - Array of passages to store
     * @param embedFunction - Function to generate embeddings
     */
    async store(passages, embedFunction) {
        for (const passage of passages) {
            const vector = await embedFunction(passage.text);
            const id = `passage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            if (this.agentDB) {
                await this.agentDB.store(vector, Object.assign({ text: passage.text }, passage.metadata));
            }
            else {
                // Fallback to in-memory storage
                this.inMemoryStore.set(id, {
                    vector,
                    text: passage.text,
                    metadata: passage.metadata,
                });
            }
        }
    }
    /**
     * Run the retrieval
     */
    async run(input) {
        const queries = Array.isArray(input.query) ? input.query : [input.query];
        const allPassages = [];
        for (const query of queries) {
            let passages;
            if (this.retrieveFunction) {
                // Use custom retrieval function
                passages = await this.retrieveFunction(query, this.k);
            }
            else if (this.agentDB) {
                // Use AgentDB for retrieval
                passages = await this.retrieveFromAgentDB(query);
            }
            else {
                // Use in-memory retrieval
                passages = await this.retrieveFromMemory(query);
            }
            // Filter by threshold
            passages = passages.filter((p) => p.score >= this.threshold);
            // Optionally rerank
            if (this.rerank) {
                passages = await this.rerankPassages(query, passages);
            }
            allPassages.push(...passages);
        }
        // Deduplicate and take top-k
        const uniquePassages = this.deduplicatePassages(allPassages);
        const topK = uniquePassages.slice(0, this.k);
        return { passages: topK };
    }
    /**
     * Retrieve from AgentDB
     */
    async retrieveFromAgentDB(query) {
        if (!this.agentDB) {
            throw new Error('AgentDB not initialized');
        }
        // For AgentDB, we need to convert the query to a vector
        // This is a simplified approach - in production, use a proper embedding model
        const queryVector = this.simpleEmbed(query);
        const results = await this.agentDB.search(queryVector, {
            k: this.k,
            minScore: this.threshold,
        });
        return results.map((result) => {
            var _a;
            return ({
                passage: ((_a = result.data.metadata) === null || _a === void 0 ? void 0 : _a.text) || JSON.stringify(result.data.metadata),
                score: result.score,
                metadata: result.data.metadata,
                id: result.id,
            });
        });
    }
    /**
     * Retrieve from in-memory store
     */
    async retrieveFromMemory(query) {
        const queryVector = this.simpleEmbed(query);
        const results = [];
        for (const [id, entry] of this.inMemoryStore.entries()) {
            const score = this.cosineSimilarity(queryVector, entry.vector);
            results.push({
                passage: entry.text,
                score,
                metadata: entry.metadata,
                id,
            });
        }
        // Sort by score descending
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, this.k);
    }
    /**
     * Simple embedding function (for demonstration)
     * In production, use a proper embedding model
     */
    simpleEmbed(text) {
        const words = text.toLowerCase().split(/\s+/);
        const vector = new Array(384).fill(0); // Standard embedding size
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            for (let j = 0; j < word.length; j++) {
                const charCode = word.charCodeAt(j);
                vector[(i * word.length + j) % 384] += charCode / 1000;
            }
        }
        // Normalize
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map((val) => val / (magnitude || 1));
    }
    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) {
            throw new Error('Vectors must have the same length');
        }
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            magnitudeA += a[i] * a[i];
            magnitudeB += b[i] * b[i];
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }
        return dotProduct / (magnitudeA * magnitudeB);
    }
    /**
     * Rerank passages (placeholder for more sophisticated reranking)
     */
    async rerankPassages(query, passages) {
        // Simple reranking based on exact keyword matches
        const queryWords = query.toLowerCase().split(/\s+/);
        return passages
            .map((passage) => {
            const passageWords = passage.passage.toLowerCase().split(/\s+/);
            const matches = queryWords.filter((word) => passageWords.includes(word)).length;
            const rerankScore = (passage.score + matches / queryWords.length) / 2;
            return Object.assign(Object.assign({}, passage), { score: rerankScore });
        })
            .sort((a, b) => b.score - a.score);
    }
    /**
     * Deduplicate passages based on content similarity
     */
    deduplicatePassages(passages) {
        const unique = [];
        const seen = new Set();
        for (const passage of passages) {
            // Simple deduplication based on exact text match
            // In production, use fuzzy matching or semantic similarity
            const key = passage.passage.trim().toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(passage);
            }
        }
        return unique;
    }
}
exports.Retrieve = Retrieve;
//# sourceMappingURL=retrieve.js.map