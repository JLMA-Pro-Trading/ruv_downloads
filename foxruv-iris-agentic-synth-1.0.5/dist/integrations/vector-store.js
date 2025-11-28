/**
 * Vector store integration with ruvector for semantic search
 */
/**
 * Vector store client for semantic prompt retrieval
 */
export class VectorStore {
    config;
    isAvailable;
    entries;
    nextId;
    constructor(config = {}) {
        this.config = {
            enabled: config.enabled ?? false,
            dimensions: config.dimensions ?? 384,
            indexType: config.indexType ?? 'hnsw',
            quantization: config.quantization ?? 'none',
            similarityMetric: config.similarityMetric ?? 'cosine',
            maxResults: config.maxResults ?? 10,
        };
        this.isAvailable = this.checkAvailability();
        this.entries = new Map();
        this.nextId = 0;
    }
    /**
     * Check if ruvector is available
     */
    checkAvailability() {
        if (!this.config.enabled)
            return false;
        try {
            require.resolve('ruvector');
            return true;
        }
        catch {
            console.warn('ruvector not installed. Vector search disabled.');
            return false;
        }
    }
    /**
     * Add prompt to vector store
     */
    async add(content, metadata) {
        const id = `vector-${this.nextId++}`;
        const vector = await this.embed(content);
        const entry = {
            id,
            content,
            vector,
            metadata,
        };
        this.entries.set(id, entry);
        return id;
    }
    /**
     * Add multiple prompts
     */
    async addBatch(prompts, metadata) {
        const ids = [];
        for (let i = 0; i < prompts.length; i++) {
            const meta = metadata?.[i] || {};
            const id = await this.add(prompts[i], meta);
            ids.push(id);
        }
        return ids;
    }
    /**
     * Search for similar prompts
     */
    async search(query, limit) {
        const maxResults = limit || this.config.maxResults;
        const queryVector = await this.embed(query);
        const results = [];
        for (const [id, entry] of this.entries.entries()) {
            const score = this.calculateSimilarity(queryVector, entry.vector);
            results.push({
                id,
                content: entry.content,
                score,
                metadata: entry.metadata,
            });
        }
        // Sort by score and limit results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }
    /**
     * Get entry by ID
     */
    get(id) {
        return this.entries.get(id);
    }
    /**
     * Delete entry
     */
    delete(id) {
        return this.entries.delete(id);
    }
    /**
     * Clear all entries
     */
    clear() {
        this.entries.clear();
    }
    /**
     * Get store size
     */
    size() {
        return this.entries.size;
    }
    /**
     * Embed text to vector
     */
    async embed(text) {
        if (this.isAvailable) {
            try {
                // TODO: Implement actual ruvector embedding
                // const ruvector = require('ruvector');
                // return await ruvector.embed(text);
            }
            catch (error) {
                console.error('Embedding failed:', error);
            }
        }
        // Fallback: simple hash-based embedding
        return this.fallbackEmbed(text);
    }
    /**
     * Fallback embedding using simple hashing
     */
    fallbackEmbed(text) {
        const vector = new Array(this.config.dimensions).fill(0);
        const words = text.toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length; i++) {
            const hash = this.simpleHash(words[i]);
            const idx = hash % this.config.dimensions;
            vector[idx] += 1;
        }
        // Normalize
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return vector.map(val => magnitude > 0 ? val / magnitude : 0);
    }
    /**
     * Simple hash function
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    /**
     * Calculate similarity between vectors
     */
    calculateSimilarity(vec1, vec2) {
        switch (this.config.similarityMetric) {
            case 'cosine':
                return this.cosineSimilarity(vec1, vec2);
            case 'euclidean':
                return 1 / (1 + this.euclideanDistance(vec1, vec2));
            case 'dot':
                return this.dotProduct(vec1, vec2);
            default:
                return this.cosineSimilarity(vec1, vec2);
        }
    }
    /**
     * Cosine similarity
     */
    cosineSimilarity(vec1, vec2) {
        const dot = this.dotProduct(vec1, vec2);
        const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
        const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
        return mag1 > 0 && mag2 > 0 ? dot / (mag1 * mag2) : 0;
    }
    /**
     * Euclidean distance
     */
    euclideanDistance(vec1, vec2) {
        let sum = 0;
        for (let i = 0; i < vec1.length; i++) {
            const diff = vec1[i] - vec2[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }
    /**
     * Dot product
     */
    dotProduct(vec1, vec2) {
        return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
    }
    /**
     * Check if vector store is available
     */
    available() {
        return this.config.enabled && this.isAvailable;
    }
    /**
     * Get store statistics
     */
    getStats() {
        return {
            size: this.entries.size,
            dimensions: this.config.dimensions,
            indexType: this.config.indexType,
            similarityMetric: this.config.similarityMetric,
            available: this.isAvailable,
        };
    }
}
/**
 * Create vector store with defaults
 */
export function createVectorStore(config) {
    return new VectorStore(config);
}
//# sourceMappingURL=vector-store.js.map