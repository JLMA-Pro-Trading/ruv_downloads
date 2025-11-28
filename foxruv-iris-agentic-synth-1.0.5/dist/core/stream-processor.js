/**
 * Optimized stream processor for constant memory usage during generation
 * Features:
 * - Backpressure handling
 * - Efficient buffering
 * - Zero-copy operations where possible
 * - Memory pooling for chunks
 */
/**
 * High-performance stream processor with constant memory footprint
 */
export class StreamProcessor {
    highWaterMark;
    chunkSize;
    enableBackpressure;
    bufferStrategy;
    buffer = [];
    sequence = 0;
    bytesProcessed = 0;
    chunksProcessed = 0;
    // Memory pooling for reduced allocations
    chunkPool = [];
    poolSize = 100;
    constructor(options = {}) {
        this.highWaterMark = options.highWaterMark || 16 * 1024; // 16KB
        this.chunkSize = options.chunkSize || 1024; // 1KB chunks
        this.enableBackpressure = options.enableBackpressure ?? true;
        this.bufferStrategy = options.bufferStrategy || 'dynamic';
        // Pre-allocate chunk pool
        this.initializePool();
    }
    /**
     * Process stream with constant memory usage
     * Uses async generator for efficient memory management
     */
    async *process(source, transform) {
        const reader = this.getReader(source);
        try {
            while (true) {
                // Check backpressure
                if (this.enableBackpressure && this.buffer.length >= this.highWaterMark / this.chunkSize) {
                    // Yield buffered chunks to relieve pressure
                    while (this.buffer.length > 0) {
                        const chunk = this.buffer.shift();
                        yield chunk;
                        this.recycleChunk(chunk);
                    }
                }
                const { done, value } = await reader.read();
                if (done)
                    break;
                // Process value in chunks to maintain constant memory
                const chunks = this.splitIntoChunks(value);
                for (const chunkData of chunks) {
                    const transformedData = transform ? await transform(chunkData) : chunkData;
                    const chunk = this.allocateChunk(transformedData);
                    this.bytesProcessed += transformedData.length;
                    this.chunksProcessed++;
                    // Yield immediately or buffer based on strategy
                    if (this.bufferStrategy === 'fixed' || this.buffer.length === 0) {
                        yield chunk;
                        this.recycleChunk(chunk);
                    }
                    else {
                        this.buffer.push(chunk);
                    }
                }
            }
            // Flush remaining buffer
            while (this.buffer.length > 0) {
                const chunk = this.buffer.shift();
                yield chunk;
                this.recycleChunk(chunk);
            }
        }
        finally {
            if ('cancel' in reader) {
                await reader.cancel();
            }
        }
    }
    /**
     * Batch process multiple streams in parallel with memory limits
     */
    async *processBatch(sources, concurrency = 3) {
        const activeStreams = new Map();
        const pending = new Set();
        // Initialize streams with concurrency limit
        for (let i = 0; i < Math.min(sources.length, concurrency); i++) {
            const generator = this.process(sources[i]);
            activeStreams.set(i, generator);
        }
        let nextSourceIndex = concurrency;
        while (activeStreams.size > 0) {
            // Create promises for next chunk from each active stream
            pending.clear();
            for (const [sourceIndex, generator] of activeStreams) {
                pending.add(generator.next().then((result) => ({ sourceIndex, result })));
            }
            // Wait for the first chunk to arrive
            const { sourceIndex, result } = await Promise.race(pending);
            if (result.done) {
                // Stream finished, remove it and start next source if available
                activeStreams.delete(sourceIndex);
                if (nextSourceIndex < sources.length) {
                    const generator = this.process(sources[nextSourceIndex]);
                    activeStreams.set(nextSourceIndex, generator);
                    nextSourceIndex++;
                }
            }
            else {
                // Yield the chunk
                yield { sourceIndex, chunk: result.value };
            }
        }
    }
    /**
     * Create efficient pipeline of transformations
     */
    async *pipeline(source, ...transforms) {
        // Compose transforms into single function to avoid intermediate allocations
        const composedTransform = transforms.reduce((composed, transform) => async (value) => {
            const result = await composed(value);
            return await transform(result);
        }, async (value) => value);
        yield* this.process(source, composedTransform);
    }
    /**
     * Collect stream into array with memory limit
     */
    async collect(source, maxItems, maxBytes) {
        const results = [];
        let totalBytes = 0;
        for await (const chunk of this.process(source)) {
            if (maxItems && results.length >= maxItems)
                break;
            if (maxBytes && totalBytes + chunk.data.length > maxBytes)
                break;
            results.push(chunk.data);
            totalBytes += chunk.data.length;
        }
        return results;
    }
    /**
     * Get stream statistics
     */
    getStats() {
        return {
            bytesProcessed: this.bytesProcessed,
            chunksProcessed: this.chunksProcessed,
            bufferSize: this.buffer.length,
            poolSize: this.chunkPool.length,
            averageChunkSize: this.chunksProcessed > 0 ? this.bytesProcessed / this.chunksProcessed : 0,
        };
    }
    /**
     * Reset processor state
     */
    reset() {
        this.buffer = [];
        this.sequence = 0;
        this.bytesProcessed = 0;
        this.chunksProcessed = 0;
        // Return all chunks to pool
        this.chunkPool = [];
        this.initializePool();
    }
    // Private helper methods
    initializePool() {
        for (let i = 0; i < this.poolSize; i++) {
            this.chunkPool.push({
                data: '',
                sequence: 0,
                timestamp: 0,
            });
        }
    }
    allocateChunk(data) {
        const chunk = this.chunkPool.pop() || {
            data: '',
            sequence: 0,
            timestamp: 0,
        };
        chunk.data = data;
        chunk.sequence = this.sequence++;
        chunk.timestamp = Date.now();
        return chunk;
    }
    recycleChunk(chunk) {
        if (this.chunkPool.length < this.poolSize) {
            // Clear data to allow garbage collection
            chunk.data = '';
            chunk.metadata = undefined;
            this.chunkPool.push(chunk);
        }
    }
    splitIntoChunks(data) {
        if (data.length <= this.chunkSize) {
            return [data];
        }
        const chunks = [];
        for (let i = 0; i < data.length; i += this.chunkSize) {
            chunks.push(data.slice(i, i + this.chunkSize));
        }
        return chunks;
    }
    getReader(source) {
        if ('getReader' in source) {
            return source.getReader();
        }
        else {
            return source[Symbol.asyncIterator]();
        }
    }
}
/**
 * Utility function to create optimized transform stream
 */
export function createTransformStream(transform, options) {
    const processor = new StreamProcessor(options);
    return new TransformStream({
        async transform(chunk, controller) {
            const source = (async function* () { yield chunk; })();
            const generator = processor.process(source, transform);
            for await (const processed of generator) {
                controller.enqueue(processed);
            }
        },
    });
}
/**
 * Create batching transform stream to reduce overhead
 */
export function createBatchingStream(batchSize, batchTimeout = 100) {
    let batch = [];
    let timer = null;
    return new TransformStream({
        transform(chunk, controller) {
            batch.push(chunk);
            if (batch.length >= batchSize) {
                controller.enqueue([...batch]);
                batch = [];
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            }
            else if (!timer) {
                timer = setTimeout(() => {
                    if (batch.length > 0) {
                        controller.enqueue([...batch]);
                        batch = [];
                    }
                    timer = null;
                }, batchTimeout);
            }
        },
        flush(controller) {
            if (timer) {
                clearTimeout(timer);
            }
            if (batch.length > 0) {
                controller.enqueue(batch);
            }
        },
    });
}
//# sourceMappingURL=stream-processor.js.map