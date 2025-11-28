/**
 * Anthropic Language Model Provider
 *
 * Integrates with Anthropic's Claude API for text generation
 */
import { LMDriver, GenerationOptions } from '../base';
/**
 * Anthropic API configuration
 */
export interface AnthropicConfig {
    /**
     * Anthropic API key
     */
    apiKey: string;
    /**
     * Model to use (default: claude-3-sonnet-20240229)
     */
    model?: string;
    /**
     * API endpoint (default: https://api.anthropic.com/v1)
     */
    endpoint?: string;
    /**
     * Default generation options
     */
    defaultOptions?: Partial<GenerationOptions>;
}
/**
 * Anthropic language model driver
 */
export declare class AnthropicLM implements LMDriver {
    private config;
    private initialized;
    constructor(config: AnthropicConfig);
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
     * Call Anthropic API
     */
    private callAnthropic;
}
