// import { ModelConfig } from '../schemas/prompt-schema'; // Removed unused import
export class MockModel {
    name = 'mock-model';
    async generate(prompt, _config) {
        return this.generateMockResponse(prompt, _config);
    }
    generateMockResponse(prompt, _config) {
        return `Mock response to: ${prompt}`;
    }
}
export class GeminiModel {
    name = 'gemini-flash';
    async generate(prompt, _config) {
        // Placeholder for actual Gemini integration
        return `Gemini response to: ${prompt}`;
    }
}
export class ClaudeModel {
    name = 'claude-sonnet';
    async generate(prompt, _config) {
        // Placeholder for actual Claude integration
        return `Claude response to: ${prompt}`;
    }
}
export function createDefaultRouter(modelName) {
    // Placeholder for router creation logic used in tests/benchmarks
    return {
        route: async (request) => ({ content: `Response from ${modelName} for: ${request.prompt}` }),
        routeStream: async function* (_request) { yield `Stream response from ${modelName}`; }
    };
}
//# sourceMappingURL=models.js.map