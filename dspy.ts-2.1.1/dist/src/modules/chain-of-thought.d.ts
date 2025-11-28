/**
 * ChainOfThought Module
 *
 * Implements the Chain-of-Thought prompting strategy where the model
 * is encouraged to show its reasoning step-by-step before providing an answer.
 */
import { Module } from '../core/module';
import { Signature } from '../core/signature';
/**
 * Chain-of-Thought module that extends predictions with reasoning
 */
export declare class ChainOfThought<TInput = any, TOutput = any> extends Module<TInput, TOutput & {
    reasoning: string;
}> {
    /**
     * Create a ChainOfThought module
     * @param config Module configuration with signature
     */
    constructor(config: {
        name: string;
        signature: Signature;
        strategy?: 'ChainOfThought';
    });
    /**
     * Extend the signature to include a reasoning field
     */
    private extendSignatureWithReasoning;
    /**
     * Execute the Chain-of-Thought module
     */
    run(input: TInput): Promise<TOutput & {
        reasoning: string;
    }>;
    /**
     * Build a Chain-of-Thought prompt
     */
    private buildCoTPrompt;
    /**
     * Get example value for a field type
     */
    private getFieldExample;
    /**
     * Parse Chain-of-Thought response
     */
    private parseCoTResponse;
    /**
     * Extract reasoning from free-form text
     */
    private extractReasoning;
    /**
     * Extract output manually from free-form text
     */
    private extractManually;
    /**
     * Get default value for a field
     */
    private getDefaultValue;
}
