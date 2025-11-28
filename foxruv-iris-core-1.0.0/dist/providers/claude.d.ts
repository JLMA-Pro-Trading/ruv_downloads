/**
 * Claude Provider
 * Fetch-based wrapper for Anthropic API (Claude 4.5)
 * Pure Node.js implementation with no external dependencies
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
//# sourceMappingURL=claude.d.ts.map