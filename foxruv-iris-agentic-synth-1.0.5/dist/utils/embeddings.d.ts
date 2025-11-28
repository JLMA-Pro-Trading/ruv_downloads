/**
 * Embedding Service for Vector Storage
 *
 * Generates vector embeddings for trading strategies and prompts
 * Compatible with OpenAI, local models, and custom embedding services
 */
export interface EmbeddingConfig {
    provider?: 'openai' | 'local' | 'custom';
    model?: string;
    dimension?: number;
    apiKey?: string;
    endpoint?: string;
}
export interface EmbeddingResult {
    embedding: number[];
    dimension: number;
    model: string;
    tokens?: number;
}
/**
 * Embedding Service
 */
export declare class EmbeddingService {
    private config;
    constructor(config?: EmbeddingConfig);
    /**
     * Generate embedding for text
     */
    embed(text: string): Promise<EmbeddingResult>;
    /**
     * Generate embeddings for multiple texts (batched)
     */
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
    /**
     * OpenAI embedding
     */
    private embedOpenAI;
    /**
     * Local embedding (simple TF-IDF approximation)
     */
    private embedLocal;
    /**
     * Custom embedding endpoint
     */
    private embedCustom;
    /**
     * Simple hash function for local embeddings
     */
    private simpleHash;
}
/**
 * Create embedding service
 */
export declare function createEmbeddingService(config?: EmbeddingConfig): EmbeddingService;
//# sourceMappingURL=embeddings.d.ts.map