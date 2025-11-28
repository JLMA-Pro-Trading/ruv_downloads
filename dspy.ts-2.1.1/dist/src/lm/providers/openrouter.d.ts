/**
 * OpenRouter LM Provider
 *
 * Provides access to multiple LLM providers through OpenRouter's unified API
 * https://openrouter.ai/
 */
import { LMDriver, GenerationOptions } from '../base';
export interface OpenRouterConfig {
    /**
     * OpenRouter API key
     */
    apiKey: string;
    /**
     * Model identifier (e.g., 'anthropic/claude-3-opus', 'openai/gpt-4')
     */
    model: string;
    /**
     * Optional site URL for ranking
     */
    siteUrl?: string;
    /**
     * Optional site name for ranking
     */
    siteName?: string;
    /**
     * Base URL (defaults to OpenRouter API)
     */
    baseUrl?: string;
}
/**
 * OpenRouter Language Model Driver
 *
 * Supports multiple providers through OpenRouter:
 * - Anthropic (Claude)
 * - OpenAI (GPT-4, GPT-3.5)
 * - Google (PaLM, Gemini)
 * - Meta (Llama)
 * - Mistral
 * - And many more!
 *
 * @example
 * ```typescript
 * import { OpenRouterLM } from 'dspy.ts';
 *
 * const lm = new OpenRouterLM({
 *   apiKey: process.env.OPENROUTER_API_KEY!,
 *   model: 'anthropic/claude-3-opus',
 *   siteName: 'My DSPy App'
 * });
 *
 * await lm.init();
 * const response = await lm.generate('What is 2+2?');
 * ```
 */
export declare class OpenRouterLM implements LMDriver {
    private config;
    private baseUrl;
    constructor(config: OpenRouterConfig);
    init(): Promise<void>;
    generate(prompt: string, options?: GenerationOptions): Promise<string>;
    private callOpenRouter;
    cleanup(): Promise<void>;
}
/**
 * Popular OpenRouter model identifiers
 */
export declare const OpenRouterModels: {
    readonly CLAUDE_3_OPUS: "anthropic/claude-3-opus";
    readonly CLAUDE_3_SONNET: "anthropic/claude-3-sonnet";
    readonly CLAUDE_3_HAIKU: "anthropic/claude-3-haiku";
    readonly GPT_4_TURBO: "openai/gpt-4-turbo";
    readonly GPT_4: "openai/gpt-4";
    readonly GPT_3_5_TURBO: "openai/gpt-3.5-turbo";
    readonly GEMINI_PRO: "google/gemini-pro";
    readonly PALM_2: "google/palm-2-chat-bison";
    readonly LLAMA_2_70B: "meta-llama/llama-2-70b-chat";
    readonly LLAMA_3_70B: "meta-llama/llama-3-70b-instruct";
    readonly MISTRAL_LARGE: "mistralai/mistral-large";
    readonly MISTRAL_MEDIUM: "mistralai/mistral-medium";
    readonly MIXTRAL_8X7B: "mistralai/mixtral-8x7b-instruct";
    readonly COHERE_COMMAND: "cohere/command";
    readonly PERPLEXITY_70B: "perplexity/pplx-70b-chat";
};
