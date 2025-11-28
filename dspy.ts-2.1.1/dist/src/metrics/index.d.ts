/**
 * Metrics and Evaluation - DSPy.ts
 *
 * Common evaluation metrics for DSPy programs.
 * Compatible with DSPy Python metrics.
 */
/**
 * Metric function type
 */
export type MetricFunction<TExample = any, TPrediction = any> = (example: TExample, prediction: TPrediction, trace?: any) => number | Promise<number>;
/**
 * Exact match metric - checks if prediction exactly matches expected output
 */
export declare function exactMatch<T extends Record<string, any>>(example: T, prediction: T, field?: keyof T): number;
/**
 * F1 score for token-level comparison
 */
export declare function f1Score(expected: string, predicted: string): number;
/**
 * Answer similarity metric (F1 score wrapper)
 */
export declare function answerSimilarity<T extends {
    answer?: string;
}>(example: T, prediction: T): number;
/**
 * Contains metric - checks if prediction contains expected substring
 */
export declare function contains<T extends Record<string, any>>(example: T, prediction: T, field: keyof T): number;
/**
 * Semantic similarity (simplified version using token overlap)
 * For production, use actual embedding-based similarity
 */
export declare function semanticSimilarity(text1: string, text2: string): number;
/**
 * Pass at K metric - checks if correct answer appears in top K predictions
 */
export declare function passAtK<T>(example: T, predictions: T[], k: number, matchFn: (example: T, prediction: T) => boolean): number;
/**
 * Mean Reciprocal Rank (MRR)
 */
export declare function meanReciprocalRank<T>(example: T, predictions: T[], matchFn: (example: T, prediction: T) => boolean): number;
/**
 * BLEU score (simplified version)
 */
export declare function bleuScore(reference: string, candidate: string, n?: number): number;
/**
 * Rouge-L score (Longest Common Subsequence)
 */
export declare function rougeL(reference: string, candidate: string): number;
/**
 * Accuracy metric for classification tasks
 */
export declare function accuracy<T extends {
    label?: any;
}>(examples: T[], predictions: T[]): number;
/**
 * Create a custom metric function
 */
export declare function createMetric<TExample, TPrediction>(metricFn: (example: TExample, prediction: TPrediction) => number | boolean): MetricFunction<TExample, TPrediction>;
/**
 * Combine multiple metrics with weights
 */
export declare function combinedMetric<TExample, TPrediction>(metrics: Array<{
    metric: MetricFunction<TExample, TPrediction>;
    weight: number;
}>): MetricFunction<TExample, TPrediction>;
/**
 * Evaluation helper - evaluate a program on a dataset
 */
export declare function evaluate<TInput, TOutput>(program: {
    run: (input: TInput) => Promise<TOutput>;
}, dataset: Array<TInput & Partial<TOutput>>, metric: MetricFunction<TInput & Partial<TOutput>, TOutput>, options?: {
    parallel?: boolean;
    batchSize?: number;
    verbose?: boolean;
}): Promise<{
    score: number;
    scores: number[];
    predictions: TOutput[];
}>;
