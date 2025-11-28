export interface GenerationConfig {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
}
export interface ModelProvider {
    name: string;
    generate(prompt: string, config: GenerationConfig): Promise<string>;
    stream?(prompt: string, config: GenerationConfig): AsyncGenerator<string>;
}
export declare class MockModel implements ModelProvider {
    name: string;
    generate(prompt: string, _config: GenerationConfig): Promise<string>;
    private generateMockResponse;
}
export declare class GeminiModel implements ModelProvider {
    name: string;
    generate(prompt: string, _config: GenerationConfig): Promise<string>;
}
export declare class ClaudeModel implements ModelProvider {
    name: string;
    generate(prompt: string, _config: GenerationConfig): Promise<string>;
}
export declare function createDefaultRouter(modelName: string): any;
//# sourceMappingURL=models.d.ts.map