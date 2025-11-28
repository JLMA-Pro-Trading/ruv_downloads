/**
 * Embedding Service for Vector Storage
 *
 * Generates vector embeddings for trading strategies and prompts
 * Compatible with OpenAI, local models, and custom embedding services
 */
/**
 * Embedding Service
 */
export class EmbeddingService {
    config;
    constructor(config = {}) {
        this.config = {
            provider: config.provider ?? 'openai',
            model: config.model ?? 'text-embedding-ada-002',
            dimension: config.dimension ?? 1536,
            apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? '',
            endpoint: config.endpoint ?? 'https://api.openai.com/v1/embeddings',
        };
    }
    /**
     * Generate embedding for text
     */
    async embed(text) {
        switch (this.config.provider) {
            case 'openai':
                return this.embedOpenAI(text);
            case 'local':
                return this.embedLocal(text);
            case 'custom':
                return this.embedCustom(text);
            default:
                throw new Error(`Unknown provider: ${this.config.provider}`);
        }
    }
    /**
     * Generate embeddings for multiple texts (batched)
     */
    async embedBatch(texts) {
        // For now, process sequentially
        // TODO: Implement true batching for OpenAI
        const results = [];
        for (const text of texts) {
            results.push(await this.embed(text));
        }
        return results;
    }
    /**
     * OpenAI embedding
     */
    async embedOpenAI(text) {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key required. Set OPENAI_API_KEY environment variable.');
        }
        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify({
                input: text,
                model: this.config.model,
            }),
        });
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.statusText}`);
        }
        const data = (await response.json());
        return {
            embedding: data.data[0].embedding,
            dimension: data.data[0].embedding.length,
            model: this.config.model,
            tokens: data.usage?.total_tokens,
        };
    }
    /**
     * Local embedding (simple TF-IDF approximation)
     */
    async embedLocal(text) {
        // Simple word-based embedding for testing
        // In production, use a proper local embedding model
        const words = text.toLowerCase().split(/\s+/);
        const embedding = new Array(this.config.dimension).fill(0);
        // Simple hash-based embedding
        for (const word of words) {
            const hash = this.simpleHash(word);
            const idx = hash % this.config.dimension;
            embedding[idx] += 1;
        }
        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        if (magnitude > 0) {
            for (let i = 0; i < embedding.length; i++) {
                embedding[i] /= magnitude;
            }
        }
        return {
            embedding,
            dimension: this.config.dimension,
            model: 'local-tfidf',
        };
    }
    /**
     * Custom embedding endpoint
     */
    async embedCustom(text) {
        const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                model: this.config.model,
            }),
        });
        if (!response.ok) {
            throw new Error(`Custom embedding API error: ${response.statusText}`);
        }
        const data = (await response.json());
        return {
            embedding: data.embedding,
            dimension: data.embedding.length,
            model: this.config.model,
        };
    }
    /**
     * Simple hash function for local embeddings
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }
}
/**
 * Create embedding service
 */
export function createEmbeddingService(config) {
    return new EmbeddingService(config);
}
//# sourceMappingURL=embeddings.js.map