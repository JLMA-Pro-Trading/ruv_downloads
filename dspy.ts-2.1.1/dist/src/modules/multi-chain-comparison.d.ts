/**
 * MultiChainComparison Module - DSPy.ts
 *
 * Implements the MultiChainComparison module that compares multiple outputs
 * from ChainOfThought to produce a final prediction.
 * Compatible with DSPy Python's dspy.MultiChainComparison module.
 *
 * Usage:
 *   const comparator = new MultiChainComparison({
 *     name: 'Comparator',
 *     signature: { ... },
 *     n: 5
 *   });
 *   const result = await comparator.run({ question: "..." });
 */
import { Module } from '../core/module';
import { Signature } from '../core/signature';
import { ChainOfThought } from './chain-of-thought';
export interface MultiChainComparisonConfig {
    /**
     * Module name
     */
    name: string;
    /**
     * Input/output signature
     */
    signature: Signature;
    /**
     * Number of parallel chains to generate (default: 3)
     */
    n?: number;
    /**
     * Temperature for generation diversity (default: 0.7)
     */
    temperature?: number;
    /**
     * Custom ChainOfThought module to use
     */
    chainModule?: ChainOfThought<any, any>;
}
export interface Candidate<TOutput> {
    output: TOutput & {
        reasoning: string;
    };
    score: number;
    index: number;
}
/**
 * MultiChainComparison Module
 *
 * This module generates multiple Chain-of-Thought reasoning paths
 * and selects the best one through comparison. This approach improves
 * reliability by considering multiple perspectives.
 *
 * Process:
 * 1. Generate N different Chain-of-Thought solutions
 * 2. Compare all solutions using another LM call
 * 3. Select the best solution based on reasoning quality
 * 4. Return the selected solution
 *
 * @example
 * ```typescript
 * const comparator = new MultiChainComparison({
 *   name: 'QuestionAnswering',
 *   signature: {
 *     inputs: [{ name: 'question', type: 'string', required: true }],
 *     outputs: [{ name: 'answer', type: 'string', required: true }]
 *   },
 *   n: 5
 * });
 *
 * const result = await comparator.run({
 *   question: "What is the capital of France?"
 * });
 *
 * console.log(result.answer); // Best answer from 5 chains
 * console.log(result.candidates); // All 5 candidates with scores
 * ```
 */
export declare class MultiChainComparison<TInput, TOutput> extends Module<TInput, TOutput & {
    reasoning: string;
    candidates: Candidate<TOutput>[];
}> {
    private n;
    private temperature;
    private chainModule;
    constructor(config: MultiChainComparisonConfig);
    /**
     * Run the MultiChainComparison module
     */
    run(input: TInput): Promise<TOutput & {
        reasoning: string;
        candidates: Candidate<TOutput>[];
    }>;
    /**
     * Generate multiple candidate outputs
     */
    private generateCandidates;
    /**
     * Score and rank candidates
     */
    private scoreCandidates;
    /**
     * Build the comparison prompt
     */
    private buildComparisonPrompt;
    /**
     * Parse scores from LM response
     */
    private parseScores;
}
/**
 * Utility function to run MultiChainComparison with a simple interface
 */
export declare function compareChains<TInput, TOutput>(input: TInput, signature: Signature, options?: {
    n?: number;
    temperature?: number;
}): Promise<TOutput & {
    reasoning: string;
    candidates: Candidate<TOutput>[];
}>;
