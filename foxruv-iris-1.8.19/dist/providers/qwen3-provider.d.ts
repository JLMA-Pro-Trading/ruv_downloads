/**
 * Qwen3 Provider
 * Fetch-based wrapper for LM Studio OpenAI-compatible API
 *
 * Generic provider for any OpenAI-compatible local model endpoint
 */
export interface Signature {
    instructions: string;
    input: Record<string, string>;
    output: Record<string, string>;
}
export declare class Qwen3Provider {
    private endpoint;
    private model;
    private maxConcurrency;
    private requestQueue;
    private activeRequests;
    constructor(endpoint?: string, model?: string, maxConcurrency?: number);
    /**
     * Format signature into model prompt
     */
    private formatPrompt;
    /**
     * Parse JSON response from model
     */
    private parseResponse;
    /**
     * Make prediction using model
     */
    predict(signature: Signature, input: Record<string, any>, customInstructions?: string, temperature?: number, maxTokens?: number, schema?: Record<string, any>): Promise<Record<string, any>>;
    /**
     * Execute queued requests with concurrency control
     */
    private processQueue;
    /**
     * Queue a prediction request with concurrency control
     */
    private queuedPredict;
    /**
     * Batch predictions with parallel execution (5x throughput)
     * Processes multiple predictions concurrently while respecting rate limits
     */
    batchPredict(signature: Signature, inputs: Array<Record<string, any>>, customInstructions?: string, temperature?: number, maxTokens?: number): Promise<Array<Record<string, any>>>;
    /**
     * Batch predictions with error recovery
     * Retries failed predictions up to maxRetries times
     */
    batchPredictWithRetry(signature: Signature, inputs: Array<Record<string, any>>, customInstructions?: string, temperature?: number, maxTokens?: number, maxRetries?: number): Promise<Array<Record<string, any>>>;
    /**
     * Health check for endpoint availability
     */
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=qwen3-provider.d.ts.map