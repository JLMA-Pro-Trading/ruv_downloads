/**
 * Sentiment Analysis Example using DSPy.ts
 *
 * This example demonstrates how to use DSPy.ts to create a sentiment analysis pipeline
 * that uses OpenRouter API for language model inference.
 *
 * ## Setup
 * - Set OPENROUTER_API_KEY environment variable with your OpenRouter API key
 * - (Optional) Set OPENROUTER_MODEL to specify the model (default is "anthropic/claude-3-sonnet:beta")
 */
import { LMDriver, GenerationOptions } from "../../src/index";
import { Pipeline } from "../../src/core/pipeline";
declare class OpenRouterLM implements LMDriver {
    private apiKey;
    private model;
    constructor(apiKey: string, model: string);
    generate(prompt: string, options?: GenerationOptions): Promise<string>;
}
declare const pipeline: Pipeline;
declare function analyzeSentiment(text: string): Promise<{
    sentiment: string;
    confidence: number;
    isValid: boolean;
}>;
export { analyzeSentiment, pipeline, OpenRouterLM };
