/**
 * Refine Module - DSPy.ts
 *
 * Implements the Refine module for self-refinement based on constraints and feedback.
 * Replaces the deprecated Assert/Suggest system in DSPy Python.
 * Compatible with DSPy Python's dspy.Refine module.
 *
 * Usage:
 *   const refiner = new Refine({
 *     name: 'Refiner',
 *     signature: { ... },
 *     constraints: [...]
 *   });
 *   const result = await refiner.run({ input: "..." });
 */
import { Module } from '../core/module';
import { Signature } from '../core/signature';
export type ValidationResult = {
    valid: boolean;
    message?: string;
    suggestions?: string[];
};
export type ConstraintFunction<TOutput> = (output: TOutput) => ValidationResult | boolean;
export interface Constraint<TOutput> {
    /**
     * Validation function
     */
    validate: ConstraintFunction<TOutput>;
    /**
     * Error message when constraint is violated
     */
    message: string;
    /**
     * Whether this is a hard constraint (stops on failure) or soft (continues with feedback)
     */
    hard?: boolean;
    /**
     * Suggestions for fixing the violation
     */
    suggestions?: string[];
}
export interface RefineConfig<TOutput> {
    /**
     * Module name
     */
    name: string;
    /**
     * Input/output signature
     */
    signature: Signature;
    /**
     * Constraints to enforce
     */
    constraints?: Constraint<TOutput>[];
    /**
     * Maximum refinement iterations (default: 3)
     */
    maxIterations?: number;
    /**
     * Base module to refine (defaults to Predict)
     */
    baseModule?: Module<any, TOutput>;
    /**
     * Strategy to use (default: 'ChainOfThought')
     */
    strategy?: 'Predict' | 'ChainOfThought' | 'ReAct';
}
export interface RefinementStep<TOutput> {
    iteration: number;
    output: TOutput;
    violations: Array<{
        constraint: string;
        message: string;
        suggestions?: string[];
    }>;
    refined: boolean;
}
/**
 * Refine Module
 *
 * This module implements self-refinement with constraints. It generates
 * an initial output, checks it against constraints, and iteratively
 * refines it based on feedback until all constraints are satisfied
 * or max iterations are reached.
 *
 * Features:
 * - Hard constraints (must be satisfied)
 * - Soft constraints (suggestions for improvement)
 * - Iterative refinement with feedback
 * - Automatic prompt construction
 *
 * @example
 * ```typescript
 * const refiner = new Refine({
 *   name: 'EmailWriter',
 *   signature: {
 *     inputs: [{ name: 'topic', type: 'string', required: true }],
 *     outputs: [{ name: 'email', type: 'string', required: true }]
 *   },
 *   constraints: [
 *     {
 *       validate: (output) => output.email.length <= 500,
 *       message: 'Email must be 500 characters or less',
 *       hard: true
 *     },
 *     {
 *       validate: (output) => output.email.includes('Sincerely'),
 *       message: 'Email should include a closing',
 *       hard: false,
 *       suggestions: ['Add "Sincerely," at the end']
 *     }
 *   ],
 *   maxIterations: 3
 * });
 *
 * const result = await refiner.run({ topic: 'Project update' });
 * console.log(result.email);
 * console.log(result.refinementSteps); // Shows the refinement process
 * ```
 */
export declare class Refine<TInput, TOutput> extends Module<TInput, TOutput & {
    refinementSteps: RefinementStep<TOutput>[];
}> {
    private constraints;
    private maxIterations;
    private baseModule?;
    constructor(config: RefineConfig<TOutput>);
    /**
     * Add a constraint
     */
    addConstraint(constraint: Constraint<TOutput>): void;
    /**
     * Run the Refine module
     */
    run(input: TInput): Promise<TOutput & {
        refinementSteps: RefinementStep<TOutput>[];
    }>;
    /**
     * Build refinement prompt
     */
    private buildRefinePrompt;
    /**
     * Format constraints for the prompt
     */
    private formatConstraints;
    /**
     * Generate output using LM
     */
    private generateOutput;
    /**
     * Parse LM response into output object
     */
    private parseResponse;
    /**
     * Validate output against constraints
     */
    private validateConstraints;
}
/**
 * Utility function: Create a length constraint
 */
export declare function lengthConstraint<TOutput>(fieldName: keyof TOutput, maxLength: number, hard?: boolean): Constraint<TOutput>;
/**
 * Utility function: Create a pattern constraint
 */
export declare function patternConstraint<TOutput>(fieldName: keyof TOutput, pattern: RegExp, message: string, hard?: boolean): Constraint<TOutput>;
