/**
 * Optimizer Example using DSPy.ts
 *
 * This example demonstrates how to use DSPy.ts optimizers to improve module performance
 * by automatically generating and selecting few-shot examples.
 *
 * ## Setup
 * - Set OPENROUTER_API_KEY environment variable with your OpenRouter API key
 * - (Optional) Set OPENROUTER_MODEL to specify the model (default is "anthropic/claude-3-sonnet:beta")
 */
import { PredictModule } from "../../src/modules/predict";
declare class SentimentModule extends PredictModule<{
    text: string;
}, {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
}> {
    constructor();
}
declare function exactMatchMetric(input: {
    text: string;
}, output: {
    sentiment: string;
    confidence: number;
}, expected?: {
    sentiment: string;
    confidence: number;
}): number;
export { SentimentModule, exactMatchMetric };
