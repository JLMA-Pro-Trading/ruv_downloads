/**
 * Streaming integration with midstreamer
 */
export interface StreamConfig {
    bufferSize?: number;
    flushInterval?: number;
    onChunk?: (chunk: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
}
/**
 * Stream aggregator for collecting streaming responses
 */
export declare class StreamAggregator {
    private buffer;
    private config;
    private fullText;
    constructor(config?: StreamConfig);
    /**
     * Process streaming chunks
     */
    stream(source: AsyncGenerator<string>): AsyncGenerator<string>;
    /**
     * Get accumulated text
     */
    getFullText(): string;
    /**
     * Reset aggregator
     */
    reset(): void;
}
/**
 * Batch streaming for multiple requests
 */
export declare class BatchStreamProcessor {
    private concurrency;
    private activeStreams;
    constructor(concurrency?: number);
    /**
     * Process multiple streams with concurrency control
     */
    processBatch(sources: AsyncGenerator<string>[]): AsyncGenerator<{
        index: number;
        chunk: string;
    }>;
    private delay;
}
/**
 * Stream transformer for applying transformations to chunks
 */
export declare class StreamTransformer {
    private transformFn;
    constructor(transformFn: (chunk: string) => string);
    /**
     * Transform streaming chunks
     */
    transform(source: AsyncGenerator<string>): AsyncGenerator<string>;
}
/**
 * Midstreamer integration wrapper
 */
export declare class MidstreamerIntegration {
    private midstreamerAvailable;
    constructor();
    /**
     * Check if midstreamer is available
     */
    private checkMidstreamerAvailable;
    /**
     * Create streaming session with midstreamer
     */
    createSession(_config?: any): Promise<any>;
    /**
     * Stream with midstreamer if available, fallback to basic streaming
     */
    stream(source: AsyncGenerator<string>): AsyncGenerator<string>;
    /**
     * Check availability
     */
    isAvailable(): boolean;
}
/**
 * Create async generator from array
 */
export declare function fromArray<T>(items: T[]): AsyncGenerator<T>;
/**
 * Collect all chunks from async generator
 */
export declare function collectStream(source: AsyncGenerator<string>): Promise<string>;
//# sourceMappingURL=streaming.d.ts.map