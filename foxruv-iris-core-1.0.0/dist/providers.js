/**
 * LM Provider implementations for @iris/core
 */
// ============================================================================
// Claude Provider
// ============================================================================
export class ClaudeProvider {
    apiKey;
    model;
    constructor(apiKey, model = 'claude-sonnet-4-5-20250929') {
        this.apiKey = apiKey;
        this.model = model;
    }
    async predict(_signature, input, temperature = 0.7) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [{ role: 'user', content: JSON.stringify(input) }],
                temperature,
                max_tokens: 2048
            })
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        return JSON.parse(data.content[0].text);
    }
}
// ============================================================================
// Qwen3 Provider
// ============================================================================
export class Qwen3Provider {
    endpoint;
    model;
    maxConcurrency = 5;
    requestQueue = [];
    activeRequests = 0;
    constructor(endpoint = 'http://192.168.254.246:1234', model = 'qwen2.5-32b-instruct', maxConcurrency = 1) {
        this.endpoint = endpoint;
        this.model = model;
        this.maxConcurrency = maxConcurrency;
    }
    formatPrompt(signature, input, customInstructions) {
        const instructions = customInstructions || signature.instructions;
        let prompt = `${instructions}\n\n`;
        prompt += '=== INPUT ===\n';
        for (const [key, description] of Object.entries(signature.input)) {
            const value = input[key] || '';
            prompt += `${key} (${description}): ${value}\n`;
        }
        prompt += '\n=== OUTPUT FORMAT ===\n';
        prompt += 'Provide your response in JSON format with these fields:\n';
        for (const [key, description] of Object.entries(signature.output)) {
            prompt += `- ${key}: ${description}\n`;
        }
        prompt += '\nRespond ONLY with valid JSON, no additional text.';
        return prompt;
    }
    parseResponse(content) {
        try {
            const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : content;
            const cleaned = jsonStr
                .replace(/^[^{]*/, '')
                .replace(/[^}]*$/, '')
                .trim();
            return JSON.parse(cleaned);
        }
        catch (error) {
            throw new Error(`Invalid JSON response: ${error}`);
        }
    }
    async predict(signature, input, customInstructions, temperature = 0.3, maxTokens = 2048, schema) {
        const prompt = this.formatPrompt(signature, input, customInstructions);
        const body = {
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a helpful AI assistant that provides accurate responses in JSON format.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature,
            max_tokens: maxTokens,
            stream: false
        };
        if (schema) {
            body.response_format = {
                type: 'json_schema',
                json_schema: {
                    name: 'structured_response',
                    strict: true,
                    schema: schema
                }
            };
        }
        else {
            body.response_format = { type: 'json_object' };
        }
        const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format');
        }
        const content = data.choices[0].message.content;
        return this.parseResponse(content);
    }
    async processQueue() {
        while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrency) {
            const request = this.requestQueue.shift();
            if (request) {
                this.activeRequests++;
                request().finally(() => {
                    this.activeRequests--;
                    this.processQueue();
                });
            }
        }
    }
    queuedPredict(signature, input, customInstructions, temperature = 0.3, maxTokens = 2048) {
        return new Promise((resolve, reject) => {
            const request = async () => {
                try {
                    const result = await this.predict(signature, input, customInstructions, temperature, maxTokens);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
            };
            this.requestQueue.push(request);
            this.processQueue();
        });
    }
    async batchPredict(signature, inputs, customInstructions, temperature = 0.3, maxTokens = 2048) {
        const predictionPromises = inputs.map((input, index) => this.queuedPredict(signature, input, customInstructions, temperature, maxTokens)
            .then(result => ({ success: true, result, index }))
            .catch(error => ({ success: false, error, index })));
        const results = await Promise.all(predictionPromises);
        return results.map(r => r.success ? r.result : null);
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.endpoint}/v1/models`, {
                method: 'GET'
            });
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
}
// ============================================================================
// LM Provider Manager
// ============================================================================
export class LMProviderManager {
    providers = new Map();
    performanceMetrics = new Map();
    config;
    constructor(config) {
        this.config = this.getDefaultConfig(config);
    }
    getDefaultConfig(overrides) {
        const localModelEnabled = process.env.LOCAL_MODEL_ENABLED === 'true';
        const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAI = !!process.env.OPENAI_API_KEY;
        let defaultProvider = 'anthropic';
        if (localModelEnabled) {
            defaultProvider = 'lmstudio';
        }
        else if (!hasAnthropic && hasOpenAI) {
            defaultProvider = 'openai';
        }
        return {
            provider: defaultProvider,
            model: this.getDefaultModelForProvider(defaultProvider),
            debug: process.env.NODE_ENV === 'development',
            trackPerformance: true,
            ...overrides
        };
    }
    getDefaultModelForProvider(provider) {
        switch (provider) {
            case 'anthropic':
                return 'claude-sonnet-4-5-20250929';
            case 'openai':
                return 'gpt-4-turbo-preview';
            case 'lmstudio':
                return 'local-model';
            default:
                return 'claude-sonnet-4-5-20250929';
        }
    }
    getProvider() {
        const provider = this.providers.get(this.config.provider);
        if (!provider) {
            throw new Error(`Provider ${this.config.provider} not initialized. Check API keys.`);
        }
        return provider;
    }
    getProviderByName(name) {
        return this.providers.get(name);
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    switchProvider(provider) {
        if (!this.providers.has(provider)) {
            throw new Error(`Provider ${provider} not available. Initialize it first.`);
        }
        this.config.provider = provider;
    }
    recordPerformance(provider, latencyMs, success, qualityScore) {
        if (!this.config.trackPerformance)
            return;
        const metrics = this.performanceMetrics.get(provider);
        if (!metrics)
            return;
        const totalRequests = metrics.totalRequests + 1;
        const averageLatencyMs = (metrics.averageLatencyMs * metrics.totalRequests + latencyMs) / totalRequests;
        const successRate = (metrics.successRate * metrics.totalRequests + (success ? 1 : 0)) / totalRequests;
        this.performanceMetrics.set(provider, {
            ...metrics,
            averageLatencyMs,
            totalRequests,
            successRate,
            qualityScore: qualityScore ?? metrics.qualityScore
        });
    }
    getPerformanceMetrics(provider) {
        if (provider) {
            const metrics = this.performanceMetrics.get(provider);
            if (!metrics) {
                throw new Error(`No metrics available for ${provider}`);
            }
            return metrics;
        }
        return Array.from(this.performanceMetrics.values());
    }
    compareProviders() {
        const metrics = Array.from(this.performanceMetrics.values());
        if (metrics.length === 0) {
            throw new Error('No performance data available yet');
        }
        const fastest = metrics.reduce((prev, curr) => curr.averageLatencyMs < prev.averageLatencyMs ? curr : prev).provider;
        const mostReliable = metrics.reduce((prev, curr) => curr.successRate > prev.successRate ? curr : prev).provider;
        const withQuality = metrics.filter(m => m.qualityScore !== undefined);
        const highestQuality = withQuality.length > 0
            ? withQuality.reduce((prev, curr) => (curr.qualityScore ?? 0) > (prev.qualityScore ?? 0) ? curr : prev).provider
            : null;
        return {
            fastest,
            highestQuality,
            mostReliable,
            metrics
        };
    }
}
//# sourceMappingURL=providers.js.map