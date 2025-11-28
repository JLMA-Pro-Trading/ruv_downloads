"use strict";
/**
 * OpenRouter LM Provider
 *
 * Provides access to multiple LLM providers through OpenRouter's unified API
 * https://openrouter.ai/
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenRouterModels = exports.OpenRouterLM = void 0;
const base_1 = require("../base");
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
class OpenRouterLM {
    constructor(config) {
        this.config = config;
        this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    }
    async init() {
        // Validate API key
        if (!this.config.apiKey) {
            throw new base_1.LMError('OpenRouter API key is required');
        }
        // Test connection
        try {
            await this.generate('test', { maxTokens: 1 });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('401')) {
                throw new base_1.LMError('Invalid OpenRouter API key');
            }
            // Other errors are acceptable during init
        }
    }
    async generate(prompt, options = {}) {
        var _a, _b;
        try {
            const response = await this.callOpenRouter(prompt, options);
            return ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
        }
        catch (error) {
            if (error instanceof base_1.LMError) {
                throw error;
            }
            throw new base_1.LMError(error);
        }
    }
    async callOpenRouter(prompt, options) {
        var _a, _b;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
        };
        // Add optional headers for better ranking
        if (this.config.siteUrl) {
            headers['HTTP-Referer'] = this.config.siteUrl;
        }
        if (this.config.siteName) {
            headers['X-Title'] = this.config.siteName;
        }
        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: options.maxTokens || 1000,
            temperature: (_a = options.temperature) !== null && _a !== void 0 ? _a : 0.7,
            top_p: (_b = options.topP) !== null && _b !== void 0 ? _b : 1.0,
            stop: options.stopSequences,
        };
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new base_1.LMError(`OpenRouter API error: ${response.status} ${response.statusText}\n${errorText}`, `OPENROUTER_${response.status}`);
        }
        return await response.json();
    }
    async cleanup() {
        // No cleanup needed
    }
}
exports.OpenRouterLM = OpenRouterLM;
/**
 * Popular OpenRouter model identifiers
 */
exports.OpenRouterModels = {
    // Anthropic
    CLAUDE_3_OPUS: 'anthropic/claude-3-opus',
    CLAUDE_3_SONNET: 'anthropic/claude-3-sonnet',
    CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku',
    // OpenAI
    GPT_4_TURBO: 'openai/gpt-4-turbo',
    GPT_4: 'openai/gpt-4',
    GPT_3_5_TURBO: 'openai/gpt-3.5-turbo',
    // Google
    GEMINI_PRO: 'google/gemini-pro',
    PALM_2: 'google/palm-2-chat-bison',
    // Meta
    LLAMA_2_70B: 'meta-llama/llama-2-70b-chat',
    LLAMA_3_70B: 'meta-llama/llama-3-70b-instruct',
    // Mistral
    MISTRAL_LARGE: 'mistralai/mistral-large',
    MISTRAL_MEDIUM: 'mistralai/mistral-medium',
    MIXTRAL_8X7B: 'mistralai/mixtral-8x7b-instruct',
    // Other popular models
    COHERE_COMMAND: 'cohere/command',
    PERPLEXITY_70B: 'perplexity/pplx-70b-chat',
};
//# sourceMappingURL=openrouter.js.map