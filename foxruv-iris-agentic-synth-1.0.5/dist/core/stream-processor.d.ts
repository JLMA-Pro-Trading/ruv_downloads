/**
 * Optimized stream processor for constant memory usage during generation
 * Features:
 * - Backpressure handling
 * - Efficient buffering
 * - Zero-copy operations where possible
 * - Memory pooling for chunks
 */
export interface StreamOptions {
    highWaterMark?: number;
    chunkSize?: number;
    enableBackpressure?: boolean;
    bufferStrategy?: 'fixed' | 'dynamic';
}
export interface StreamChunk {
    data: string;
    sequence: number;
    timestamp: number;
    metadata?: Record<string, any>;
}
/**
 * High-performance stream processor with constant memory footprint
 */
export declare class StreamProcessor {
    private readonly highWaterMark;
    private readonly chunkSize;
    private readonly enableBackpressure;
    private readonly bufferStrategy;
    private buffer;
    private sequence;
    private bytesProcessed;
    private chunksProcessed;
    private chunkPool;
    private readonly poolSize;
    constructor(options?: StreamOptions);
    /**
     * Process stream with constant memory usage
     * Uses async generator for efficient memory management
     */
    process(source: AsyncIterable<string> | ReadableStream<string>, transform?: (chunk: string) => string | Promise<string>): AsyncGenerator<StreamChunk, void, unknown>;
    /**
     * Batch process multiple streams in parallel with memory limits
     */
    processBatch(sources: (AsyncIterable<string> | ReadableStream<string>)[], concurrency?: number): AsyncGenerator<{
        sourceIndex: number;
        chunk: StreamChunk;
    }, void, unknown>;
    /**
     * Create efficient pipeline of transformations
     */
    pipeline(source: AsyncIterable<string> | ReadableStream<string>, ...transforms: ((chunk: string) => string | Promise<string>)[]): AsyncGenerator<StreamChunk, void, unknown>;
    /**
     * Collect stream into array with memory limit
     */
    collect(source: AsyncIterable<string> | ReadableStream<string>, maxItems?: number, maxBytes?: number): Promise<string[]>;
    /**
     * Get stream statistics
     */
    getStats(): {
        bytesProcessed: number;
        chunksProcessed: number;
        bufferSize: number;
        poolSize: number;
        averageChunkSize: number;
    };
    /**
     * Reset processor state
     */
    reset(): void;
    private initializePool;
    private allocateChunk;
    private recycleChunk;
    private splitIntoChunks;
    private getReader;
}
/**
 * Utility function to create optimized transform stream
 */
export declare function createTransformStream(transform: (chunk: string) => string | Promise<string>, options?: StreamOptions): TransformStream<string, StreamChunk>;
/**
 * Create batching transform stream to reduce overhead
 */
export declare function createBatchingStream(batchSize: number, batchTimeout?: number): TransformStream<string, string[]>;
//# sourceMappingURL=stream-processor.d.ts.map