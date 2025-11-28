/**
 * Streaming integration with midstreamer
 */
/**
 * Stream aggregator for collecting streaming responses
 */
export class StreamAggregator {
    buffer;
    config;
    fullText;
    constructor(config = {}) {
        this.buffer = [];
        this.fullText = '';
        this.config = {
            bufferSize: config.bufferSize || 100,
            flushInterval: config.flushInterval || 100,
            onChunk: config.onChunk || (() => { }),
            onComplete: config.onComplete || (() => { }),
            onError: config.onError || ((err) => console.error(err)),
        };
    }
    /**
     * Process streaming chunks
     */
    async *stream(source) {
        try {
            for await (const chunk of source) {
                this.buffer.push(chunk);
                this.fullText += chunk;
                this.config.onChunk(chunk);
                // Flush buffer if needed
                if (this.buffer.length >= this.config.bufferSize) {
                    const flushed = this.buffer.join('');
                    this.buffer = [];
                    yield flushed;
                }
                else {
                    yield chunk;
                }
            }
            // Flush remaining buffer
            if (this.buffer.length > 0) {
                yield this.buffer.join('');
                this.buffer = [];
            }
            this.config.onComplete(this.fullText);
        }
        catch (error) {
            this.config.onError(error);
            throw error;
        }
    }
    /**
     * Get accumulated text
     */
    getFullText() {
        return this.fullText;
    }
    /**
     * Reset aggregator
     */
    reset() {
        this.buffer = [];
        this.fullText = '';
    }
}
/**
 * Batch streaming for multiple requests
 */
export class BatchStreamProcessor {
    concurrency;
    activeStreams;
    constructor(concurrency = 5) {
        this.concurrency = concurrency;
        this.activeStreams = 0;
    }
    /**
     * Process multiple streams with concurrency control
     */
    async *processBatch(sources) {
        const results = new Map();
        const pending = [];
        for (let i = 0; i < sources.length; i++) {
            results.set(i, []);
            const processStream = (async () => {
                while (this.activeStreams >= this.concurrency) {
                    await this.delay(10);
                }
                this.activeStreams++;
                try {
                    for await (const chunk of sources[i]) {
                        results.get(i).push(chunk);
                    }
                }
                finally {
                    this.activeStreams--;
                }
            })();
            pending.push(processStream);
        }
        // Yield results as they complete
        let completed = 0;
        while (completed < sources.length) {
            for (const [index, chunks] of results.entries()) {
                if (chunks.length > 0) {
                    const chunk = chunks.shift();
                    yield { index, chunk };
                }
            }
            await this.delay(5);
            completed = Array.from(results.values()).filter(chunks => chunks.length === 0).length;
        }
        await Promise.all(pending);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
/**
 * Stream transformer for applying transformations to chunks
 */
export class StreamTransformer {
    transformFn;
    constructor(transformFn) {
        this.transformFn = transformFn;
    }
    /**
     * Transform streaming chunks
     */
    async *transform(source) {
        for await (const chunk of source) {
            yield this.transformFn(chunk);
        }
    }
}
/**
 * Midstreamer integration wrapper
 */
export class MidstreamerIntegration {
    midstreamerAvailable;
    constructor() {
        this.midstreamerAvailable = this.checkMidstreamerAvailable();
    }
    /**
     * Check if midstreamer is available
     */
    checkMidstreamerAvailable() {
        try {
            require.resolve('midstreamer');
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Create streaming session with midstreamer
     */
    async createSession(_config) {
        if (!this.midstreamerAvailable) {
            throw new Error('midstreamer is not installed. Install with: npm install midstreamer');
        }
        // TODO: Implement actual midstreamer integration
        // const midstreamer = require('midstreamer');
        // return midstreamer.createSession(config);
        return {
            stream: async function* (source) {
                yield* source;
            },
        };
    }
    /**
     * Stream with midstreamer if available, fallback to basic streaming
     */
    async *stream(source) {
        if (this.midstreamerAvailable) {
            const session = await this.createSession();
            yield* session.stream(source);
        }
        else {
            yield* source;
        }
    }
    /**
     * Check availability
     */
    isAvailable() {
        return this.midstreamerAvailable;
    }
}
/**
 * Create async generator from array
 */
export async function* fromArray(items) {
    for (const item of items) {
        yield item;
        await new Promise(resolve => setTimeout(resolve, 1));
    }
}
/**
 * Collect all chunks from async generator
 */
export async function collectStream(source) {
    const chunks = [];
    for await (const chunk of source) {
        chunks.push(chunk);
    }
    return chunks.join('');
}
//# sourceMappingURL=streaming.js.map