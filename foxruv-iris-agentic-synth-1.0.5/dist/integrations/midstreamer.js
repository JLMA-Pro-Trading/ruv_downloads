/**
 * Midstreamer integration for real-time streaming
 */
/**
 * Midstreamer client wrapper
 */
export class MidstreamerClient {
    // private config: MidstreamerConfig; // Removed unused config property
    isAvailable;
    constructor(_config = {}) {
        // this.config = { // Removed assignment
        //   timeout: config.timeout || 30000,
        //   retries: config.retries || 3,
        //   ...config,
        // };
        this.isAvailable = this.checkAvailability();
    }
    /**
     * Check if midstreamer is available
     */
    checkAvailability() {
        try {
            require.resolve('midstreamer');
            return true;
        }
        catch {
            // console.warn('midstreamer not installed. Streaming features limited.');
            return false;
        }
    }
    /**
     * Stream generation with midstreamer
     */
    async *stream(prompt, _model, _options = {}) {
        if (!this.isAvailable) {
            yield* this.fallbackStream(prompt);
            return;
        }
        try {
            // TODO: Implement actual midstreamer integration
            // const midstreamer = require('midstreamer');
            // const stream = midstreamer.stream(prompt, model, options);
            // yield* stream;
            // For now, use fallback
            yield* this.fallbackStream(prompt);
        }
        catch (error) {
            console.error('Midstreamer streaming failed:', error);
            yield* this.fallbackStream(prompt);
        }
    }
    /**
     * Fallback streaming implementation
     */
    async *fallbackStream(prompt) {
        const response = `Generated response for: ${prompt}`;
        const words = response.split(' ');
        for (const word of words) {
            await this.delay(50);
            yield word + ' ';
        }
    }
    /**
     * Batch streaming for multiple prompts
     */
    async *batchStream(prompts, model, options = {}) {
        for (let i = 0; i < prompts.length; i++) {
            const stream = this.stream(prompts[i], model, options);
            for await (const chunk of stream) {
                yield { index: i, chunk };
            }
        }
    }
    /**
     * Check if midstreamer is available
     */
    available() {
        return this.isAvailable;
    }
    /**
     * Utility delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
/**
 * Create midstreamer client with defaults
 */
export function createMidstreamerClient(config) {
    return new MidstreamerClient(config);
}
//# sourceMappingURL=midstreamer.js.map