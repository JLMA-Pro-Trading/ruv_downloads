"use strict";
/**
 * OpenAI Language Model Provider
 *
 * Integrates with OpenAI's API for text generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAILM = void 0;
const base_1 = require("../base");
/**
 * OpenAI language model driver
 */
class OpenAILM {
    constructor(config) {
        this.initialized = false;
        this.config = {
            apiKey: config.apiKey,
            model: config.model || 'gpt-3.5-turbo',
            endpoint: config.endpoint || 'https://api.openai.com/v1',
            organization: config.organization,
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
            throw new base_1.LMError('OpenAI API key is required', 'INVALID_CONFIG');
        }
        // Test API connection
        try {
            await this.testConnection();
            this.initialized = true;
        }
        catch (error) {
            throw new base_1.LMError(`Failed to initialize OpenAI LM: ${error}`, 'INIT_ERROR');
        }
    }
    /**
     * Generate text completion
     */
    async generate(prompt, options) {
        var _a, _b;
        if (!this.initialized) {
            throw new base_1.LMError('LM not initialized. Call init() first.', 'NOT_INITIALIZED');
        }
        const mergedOptions = Object.assign(Object.assign({}, this.config.defaultOptions), options);
        try {
            const response = await this.callOpenAI(prompt, mergedOptions);
            return ((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
        }
        catch (error) {
            throw new base_1.LMError(`OpenAI generation failed: ${error}`, 'GENERATION_ERROR');
        }
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        this.initialized = false;
    }
    /**
     * Call OpenAI API
     */
    async callOpenAI(prompt, options) {
        var _a, _b;
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.apiKey}`,
        };
        if (this.config.organization) {
            headers['OpenAI-Organization'] = this.config.organization;
        }
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
            stop: options.stopSequences,
        };
        const response = await fetch(`${this.config.endpoint}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`OpenAI API error: ${response.status} - ${JSON.stringify(error)}`);
        }
        return response.json();
    }
    /**
     * Test API connection
     */
    async testConnection() {
        try {
            // Make a minimal test call
            await this.callOpenAI('test', { maxTokens: 1 });
        }
        catch (error) {
            // Even if the test call fails, as long as we get a response from the API, we're good
            // This prevents initialization failures due to rate limits or minor errors
            const errorStr = String(error);
            if (errorStr.includes('401') || errorStr.includes('authentication')) {
                throw new Error('Invalid OpenAI API key');
            }
            // Otherwise, consider it initialized (API is reachable)
        }
    }
}
exports.OpenAILM = OpenAILM;
//# sourceMappingURL=openai.js.map