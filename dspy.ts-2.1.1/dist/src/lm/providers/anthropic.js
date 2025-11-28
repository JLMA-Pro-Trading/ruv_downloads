"use strict";
/**
 * Anthropic Language Model Provider
 *
 * Integrates with Anthropic's Claude API for text generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicLM = void 0;
const base_1 = require("../base");
/**
 * Anthropic language model driver
 */
class AnthropicLM {
    constructor(config) {
        this.initialized = false;
        this.config = {
            apiKey: config.apiKey,
            model: config.model || 'claude-3-sonnet-20240229',
            endpoint: config.endpoint || 'https://api.anthropic.com/v1',
            defaultOptions: config.defaultOptions || {},
        };
    }
    /**
     * Initialize the LM driver
     */
    async init() {
        if (this.initialized) {
            return;
        }
        // Validate API key
        if (!this.config.apiKey) {
            throw new base_1.LMError('Anthropic API key is required', 'INVALID_CONFIG');
        }
        this.initialized = true;
    }
    /**
     * Generate text completion
     */
    async generate(prompt, options) {
        var _a;
        if (!this.initialized) {
            throw new base_1.LMError('LM not initialized. Call init() first.', 'NOT_INITIALIZED');
        }
        const mergedOptions = Object.assign(Object.assign({}, this.config.defaultOptions), options);
        try {
            const response = await this.callAnthropic(prompt, mergedOptions);
            return ((_a = response.content[0]) === null || _a === void 0 ? void 0 : _a.text) || '';
        }
        catch (error) {
            throw new base_1.LMError(`Anthropic generation failed: ${error}`, 'GENERATION_ERROR');
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.initialized = false;
    }
    /**
     * Call Anthropic API
     */
    async callAnthropic(prompt, options) {
        var _a, _b;
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': '2023-06-01',
        };
        const body = {
            model: this.config.model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: (_a = options.temperature) !== null && _a !== void 0 ? _a : 0.7,
            max_tokens: (_b = options.maxTokens) !== null && _b !== void 0 ? _b : 500,
            top_p: options.topP,
            stop_sequences: options.stopSequences,
        };
        const response = await fetch(`${this.config.endpoint}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Anthropic API error: ${response.status} - ${JSON.stringify(error)}`);
        }
        return response.json();
    }
}
exports.AnthropicLM = AnthropicLM;
//# sourceMappingURL=anthropic.js.map