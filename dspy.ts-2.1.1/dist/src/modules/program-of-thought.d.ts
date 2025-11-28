/**
 * ProgramOfThought Module - DSPy.ts
 *
 * Implements the ProgramOfThought module that teaches the LM to output code
 * whose execution results will dictate the response.
 * Compatible with DSPy Python's dspy.ProgramOfThought module.
 *
 * Usage:
 *   const pot = new ProgramOfThought({
 *     name: 'MathSolver',
 *     signature: { ... }
 *   });
 *   const result = await pot.run({ problem: "Calculate 15 * 23 + 7" });
 */
import { Module } from '../core/module';
import { Signature } from '../core/signature';
export interface ProgramOfThoughtConfig {
    /**
     * Module name
     */
    name: string;
    /**
     * Input/output signature
     */
    signature: Signature;
    /**
     * Maximum code execution time in ms (default: 5000)
     */
    timeout?: number;
    /**
     * Whether to allow Node.js built-in modules (default: false)
     */
    allowBuiltins?: boolean;
    /**
     * Custom sandbox environment
     */
    sandbox?: Record<string, any>;
    /**
     * Maximum iterations for retry on error (default: 3)
     */
    maxRetries?: number;
}
export interface ProgramOfThoughtStep {
    thought: string;
    code: string;
    result: any;
    error?: string;
}
/**
 * ProgramOfThought Module
 *
 * This module teaches the LM to solve problems by generating executable code.
 * The code is executed in a sandboxed environment and the results are used
 * to produce the final answer.
 *
 * Useful for:
 * - Mathematical computations
 * - Data transformations
 * - Algorithmic problem solving
 * - Any task requiring precise calculations
 *
 * @example
 * ```typescript
 * const pot = new ProgramOfThought({
 *   name: 'Calculator',
 *   signature: {
 *     inputs: [{ name: 'problem', type: 'string', required: true }],
 *     outputs: [{ name: 'answer', type: 'number', required: true }]
 *   }
 * });
 *
 * const result = await pot.run({
 *   problem: "What is 15% of 240?"
 * });
 *
 * console.log(result.answer); // 36
 * console.log(result.code); // "const result = 240 * 0.15; result"
 * ```
 */
export declare class ProgramOfThought<TInput, TOutput> extends Module<TInput, TOutput & {
    code: string;
    steps: ProgramOfThoughtStep[];
}> {
    private timeout;
    private allowBuiltins;
    private sandbox;
    private maxRetries;
    constructor(config: ProgramOfThoughtConfig);
    /**
     * Run the ProgramOfThought module
     */
    run(input: TInput): Promise<TOutput & {
        code: string;
        steps: ProgramOfThoughtStep[];
    }>;
    /**
     * Build the Program-of-Thought prompt
     */
    private buildPoTPrompt;
    /**
     * Parse the LM response to extract thought and code
     */
    private parsePoTResponse;
    /**
     * Execute code in a sandboxed environment
     */
    private executeCode;
    /**
     * Parse the execution result into output fields
     */
    private parseOutput;
    /**
     * Convert a value to a specific type
     */
    private convertToType;
}
