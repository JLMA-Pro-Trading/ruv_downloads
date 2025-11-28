export type LLMModel = {
    id: string;
    name: string;
    provider: string;
    providerId: string;
};
export type LLMModelConfig = {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    maxTokens?: number;
};
type ModelClient = any;
export declare function getModelClient(model: LLMModel, config: LLMModelConfig): ModelClient;
export declare function getDefaultMode(model: LLMModel): "json" | "auto";
export {};
//# sourceMappingURL=models.d.ts.map