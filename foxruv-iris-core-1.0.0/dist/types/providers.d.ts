/**
 * Provider Types
 *
 * Core type definitions for language model providers, signatures, and configurations.
 * These types are foundational and have no external dependencies.
 *
 * @module @iris/core/types/providers
 * @version 1.0.0
 */
/**
 * Supported language model providers
 *
 * - anthropic: Anthropic Claude models
 * - openai: OpenAI GPT models
 * - lmstudio: Local LM Studio instance
 */
export type ModelProvider = 'anthropic' | 'openai' | 'lmstudio';
/**
 * Language Model Provider Configuration
 *
 * Configures which provider and model to use for LM operations.
 * Environment-based selection with flexible override options.
 */
export interface LMProviderConfig {
    /** Provider to use (defaults to anthropic for production) */
    provider: ModelProvider;
    /** Model name (provider-specific) */
    model: string;
    /** API key (not needed for LM Studio) */
    apiKey?: string;
    /** Base URL for custom endpoints (LM Studio) */
    baseURL?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Performance tracking enabled */
    trackPerformance?: boolean;
}
/**
 * Signature Definition
 *
 * Defines the input/output structure and instructions for an expert agent.
 * Used by both Qwen3 and Claude providers for consistent prediction interfaces.
 */
export interface Signature {
    /** Task instructions for the model */
    instructions: string;
    /** Input field definitions (field name -> description) */
    input: Record<string, string>;
    /** Output field definitions (field name -> description) */
    output: Record<string, string>;
}
//# sourceMappingURL=providers.d.ts.map