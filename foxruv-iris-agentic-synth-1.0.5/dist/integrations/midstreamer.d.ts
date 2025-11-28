/**
 * Midstreamer integration for real-time streaming
 */
export interface MidstreamerConfig {
    endpoint?: string;
    apiKey?: string;
    timeout?: number;
    retries?: number;
}
/**
 * Midstreamer client wrapper
 */
export declare class MidstreamerClient {
    private isAvailable;
    constructor(_config?: MidstreamerConfig);
    /**
     * Check if midstreamer is available
     */
    private checkAvailability;
    /**
     * Stream generation with midstreamer
     */
    stream(prompt: string, _model: string, _options?: any): AsyncGenerator<string>;
    /**
     * Fallback streaming implementation
     */
    private fallbackStream;
    /**
     * Batch streaming for multiple prompts
     */
    batchStream(prompts: string[], model: string, options?: any): AsyncGenerator<{
        index: number;
        chunk: string;
    }>;
    /**
     * Check if midstreamer is available
     */
    available(): boolean;
    /**
     * Utility delay
     */
    private delay;
}
/**
 * Create midstreamer client with defaults
 */
export declare function createMidstreamerClient(config?: MidstreamerConfig): MidstreamerClient;
//# sourceMappingURL=midstreamer.d.ts.map