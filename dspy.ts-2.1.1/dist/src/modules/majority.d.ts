/**
 * Majority Voting - DSPy.ts
 *
 * Implements the majority voting function for aggregating multiple predictions.
 * Compatible with DSPy Python's dspy.majority function.
 *
 * Usage:
 *   const result = await majority(module, input, { n: 5 });
 */
import { Module } from '../core/module';
export interface MajorityOptions {
    /**
     * Number of predictions to generate (default: 5)
     */
    n?: number;
    /**
     * Temperature for generation diversity (default: 0.7)
     */
    temperature?: number;
    /**
     * Custom equality function for comparing outputs
     */
    equalityFn?: (a: any, b: any) => boolean;
    /**
     * Custom hash function for grouping similar outputs
     */
    hashFn?: (output: any) => string;
}
export interface MajorityResult<TOutput> {
    /**
     * The most popular output
     */
    output: TOutput;
    /**
     * All predictions with their counts
     */
    predictions: Array<{
        output: TOutput;
        count: number;
        percentage: number;
    }>;
    /**
     * Total number of predictions
     */
    total: number;
    /**
     * Confidence score (percentage of votes for winner)
     */
    confidence: number;
}
/**
 * Majority Voting Function
 *
 * Generates multiple predictions and returns the most common one.
 * This technique improves reliability by reducing the impact of outliers
 * and random variations in LM outputs.
 *
 * Process:
 * 1. Generate N predictions
 * 2. Group similar predictions
 * 3. Return the most common prediction
 * 4. Include confidence score and distribution
 *
 * @example
 * ```typescript
 * import { majority } from 'dspy.ts';
 * import { Predict } from 'dspy.ts';
 *
 * const classifier = new Predict({
 *   name: 'SentimentClassifier',
 *   signature: {
 *     inputs: [{ name: 'text', type: 'string', required: true }],
 *     outputs: [{ name: 'sentiment', type: 'string', required: true }]
 *   }
 * });
 *
 * const result = await majority(classifier, {
 *   text: "I love this product!"
 * }, { n: 7 });
 *
 * console.log(result.output.sentiment); // "positive"
 * console.log(result.confidence); // 0.85 (6 out of 7 agreed)
 * console.log(result.predictions); // Distribution of all predictions
 * ```
 */
export declare function majority<TInput, TOutput>(module: Module<TInput, TOutput>, input: TInput, options?: MajorityOptions): Promise<MajorityResult<TOutput>>;
/**
 * Weighted majority voting (for when predictions have confidence scores)
 */
export declare function weightedMajority<TInput, TOutput extends {
    confidence?: number;
}>(module: Module<TInput, TOutput>, input: TInput, options?: MajorityOptions): Promise<MajorityResult<TOutput>>;
/**
 * Consensus threshold voting (require minimum agreement)
 */
export declare function consensusMajority<TInput, TOutput>(module: Module<TInput, TOutput>, input: TInput, threshold?: number, options?: MajorityOptions): Promise<MajorityResult<TOutput> | null>;
