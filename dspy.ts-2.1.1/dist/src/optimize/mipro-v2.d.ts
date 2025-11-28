/**
 * MIPROv2 Optimizer - DSPy.ts
 *
 * Implements the MIPROv2 (Multi-prompt Instruction Proposal Optimizer Version 2)
 * for jointly optimizing instructions and few-shot examples.
 * Compatible with DSPy Python's MIPROv2 optimizer.
 *
 * Usage:
 *   const optimizer = new MIPROv2({
 *     metric: myMetric,
 *     auto: 'medium'
 *   });
 *   const optimized = await optimizer.compile(program, trainset, valset);
 */
import { Module } from '../core/module';
import { Optimizer, OptimizationResult } from './base';
export type AutoLevel = 'light' | 'medium' | 'heavy';
export interface MIPROv2Config {
    /**
     * Metric function to evaluate program performance
     * Should return a number between 0 and 1 (higher is better)
     */
    metric: (example: any, prediction: any, trace?: any) => number | Promise<number>;
    /**
     * Automation level: light, medium, or heavy
     * - light: Fast, fewer candidates
     * - medium: Balanced
     * - heavy: Comprehensive, slower
     */
    auto?: AutoLevel;
    /**
     * Number of candidate instructions to generate per predictor
     * Overrides auto setting if provided
     */
    numCandidates?: number;
    /**
     * Maximum number of bootstrapped demonstrations
     */
    maxBootstrappedDemos?: number;
    /**
     * Maximum number of labeled demonstrations to use
     */
    maxLabeledDemos?: number;
    /**
     * Number of optimization trials (Bayesian optimization iterations)
     */
    numTrials?: number;
    /**
     * Whether to use minibatch evaluation
     */
    minibatch?: boolean;
    /**
     * Minibatch size
     */
    minibatchSize?: number;
    /**
     * How often to do full evaluation on minibatch mode
     */
    minibatchFullEvalSteps?: number;
    /**
     * Teacher model settings for bootstrapping
     */
    teacherSettings?: {
        temperature?: number;
        maxTokens?: number;
    };
    /**
     * Random seed for reproducibility
     */
    seed?: number;
}
/**
 * MIPROv2 Optimizer
 *
 * This optimizer jointly optimizes instructions and few-shot examples through:
 * 1. Bootstrapping few-shot example candidates
 * 2. Proposing instruction candidates grounded in task dynamics
 * 3. Finding optimal combinations using Bayesian Optimization
 *
 * Based on the paper: "Optimizing Instructions and Demonstrations for Multi-Stage Tasks"
 *
 * @example
 * ```typescript
 * import { MIPROv2 } from 'dspy.ts';
 *
 * // Define metric
 * const metric = (example, prediction) => {
 *   return prediction.answer === example.answer ? 1.0 : 0.0;
 * };
 *
 * // Create optimizer
 * const optimizer = new MIPROv2({
 *   metric,
 *   auto: 'medium',
 *   numTrials: 50
 * });
 *
 * // Optimize program
 * const optimized = await optimizer.compile(
 *   myProgram,
 *   trainingData,
 *   validationData
 * );
 *
 * // Save optimized program
 * optimized.save('optimized.json');
 * ```
 */
export declare class MIPROv2 extends Optimizer {
    private miprov2Config;
    constructor(config: MIPROv2Config);
    /**
     * Get default parameters based on auto level
     */
    private getAutoDefaults;
    /**
     * Compile (optimize) a program
     */
    compile<TInput, TOutput>(program: Module<TInput, TOutput>, trainset: Array<TInput & Partial<TOutput>>, valset?: Array<TInput & Partial<TOutput>>): Promise<OptimizationResult<TInput, TOutput>>;
    /**
     * Step 1: Bootstrap few-shot demonstrations
     */
    private bootstrapDemos;
    /**
     * Step 2: Generate instruction candidates
     */
    private generateInstructions;
    /**
     * Step 3: Bayesian Optimization
     */
    private bayesianOptimize;
    /**
     * Evaluate a configuration
     */
    private evaluateConfig;
    /**
     * Summarize the task
     */
    private summarizeTask;
    /**
     * Build instruction generation prompt
     */
    private buildInstructionPrompt;
    /**
     * Extract instruction from LM response
     */
    private extractInstruction;
    /**
     * Shuffle array (Fisher-Yates)
     */
    private shuffle;
}
