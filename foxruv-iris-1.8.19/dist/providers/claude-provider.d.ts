/**
 * Claude Provider
 * Fetch-based wrapper for Anthropic API (Claude Opus 4)
 */
export interface Signature {
    instructions: string;
    input: Record<string, string>;
    output: Record<string, string>;
}
export declare class ClaudeProvider {
    private apiKey;
    private model;
    constructor(apiKey: string, model?: string);
    /**
     * Format signature into model prompt
     */
    private formatPrompt;
    /**
     * Make prediction using model
     */
    predict(signature: Signature, input: Record<string, any>, customInstructions?: string, temperature?: number, // Low temp for evaluation consistency
    maxTokens?: number): Promise<Record<string, any>>;
}
//# sourceMappingURL=claude-provider.d.ts.map