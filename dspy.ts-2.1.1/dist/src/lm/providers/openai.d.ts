/**
 * OpenAI Language Model Provider
 *
 * Integrates with OpenAI's API for text generation
 */
import { LMDriver, GenerationOptions } from '../base';
/**
 * OpenAI API configuration
 */
export interface OpenAIConfig {
    /**
     * OpenAI API key
     */
    apiKey: string;
    /**
     * Model to use (default: gpt-3.5-turbo)
     */
    model?: string;
    /**
     * API endpoint (default: https://api.openai.com/v1)
     */
    endpoint?: string;
    /**
     * Organization ID (optional)
     */
    organization?: string;
    /**
     * Default generation options
     */
    defaultOptions?: Partial<GenerationOptions>;
}
/**
 * OpenAI language model driver
 */
export declare class OpenAILM implements LMDriver {
    private config;
    private initialized;
    constructor(config: OpenAIConfig);
    /**
     * Initialize the LM driver
     */
    init(): Promise<void>;
    /**
     * Generate text completion
     */
    generate(prompt: string, options?: GenerationOptions): Promise<string>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Call OpenAI API
     */
    private callOpenAI;
    /**
     * Test API connection
     */
    private testConnection;
}
