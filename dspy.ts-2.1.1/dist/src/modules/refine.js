"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Refine = void 0;
exports.lengthConstraint = lengthConstraint;
exports.patternConstraint = patternConstraint;
const module_1 = require("../core/module");
const base_1 = require("../lm/base");
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
class Refine extends module_1.Module {
    constructor(config) {
        super({
            name: config.name,
            signature: config.signature,
            strategy: config.strategy || 'ChainOfThought',
        });
        this.constraints = config.constraints || [];
        this.maxIterations = config.maxIterations || 3;
        this.baseModule = config.baseModule;
    }
    /**
     * Add a constraint
     */
    addConstraint(constraint) {
        this.constraints.push(constraint);
    }
    /**
     * Run the Refine module
     */
    async run(input) {
        const steps = [];
        let currentOutput = null;
        let previousFeedback = [];
        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            // Generate or refine output
            const prompt = this.buildRefinePrompt(input, currentOutput, previousFeedback);
            const newOutput = await this.generateOutput(prompt);
            // Validate against constraints
            const violations = this.validateConstraints(newOutput);
            // Record step
            steps.push({
                iteration,
                output: newOutput,
                violations: violations.map((v) => ({
                    constraint: v.constraint.message,
                    message: v.result.message || v.constraint.message,
                    suggestions: v.result.suggestions || v.constraint.suggestions,
                })),
                refined: iteration > 0,
            });
            // Check for hard constraint violations
            const hardViolations = violations.filter((v) => v.constraint.hard);
            if (hardViolations.length === 0) {
                // All hard constraints satisfied, return result
                return Object.assign(Object.assign({}, newOutput), { refinementSteps: steps });
            }
            // Prepare feedback for next iteration
            previousFeedback = violations.map((v) => {
                const msg = v.result.message || v.constraint.message;
                const suggestions = v.result.suggestions || v.constraint.suggestions || [];
                return suggestions.length > 0 ? `${msg} Suggestions: ${suggestions.join(', ')}` : msg;
            });
            currentOutput = newOutput;
        }
        // Max iterations reached - return best attempt
        console.warn(`Refine: Maximum iterations (${this.maxIterations}) reached with ${this.constraints.length} constraint violations`);
        return Object.assign(Object.assign({}, currentOutput), { refinementSteps: steps });
    }
    /**
     * Build refinement prompt
     */
    buildRefinePrompt(input, previousOutput, feedback) {
        const inputStr = this.signature.inputs
            .map((field) => {
            const value = input[field.name];
            return `${field.name}: ${value}`;
        })
            .join('\n');
        const outputFields = this.signature.outputs.map((field) => field.name).join(', ');
        let prompt = '';
        if (previousOutput === null) {
            // Initial generation
            prompt = `Generate a response for the following input.

Input:
${inputStr}

Required outputs: ${outputFields}

${this.formatConstraints()}

Your response:`;
        }
        else {
            // Refinement
            const previousStr = this.signature.outputs
                .map((field) => {
                const value = previousOutput[field.name];
                return `${field.name}: ${value}`;
            })
                .join('\n');
            prompt = `Refine the following response based on the feedback provided.

Original Input:
${inputStr}

Previous Response:
${previousStr}

Feedback:
${feedback.map((f, i) => `${i + 1}. ${f}`).join('\n')}

${this.formatConstraints()}

Refined response:`;
        }
        return prompt;
    }
    /**
     * Format constraints for the prompt
     */
    formatConstraints() {
        if (this.constraints.length === 0) {
            return '';
        }
        const constraintList = this.constraints
            .map((c, i) => {
            const type = c.hard ? '[REQUIRED]' : '[SUGGESTED]';
            return `${i + 1}. ${type} ${c.message}`;
        })
            .join('\n');
        return `Constraints:
${constraintList}`;
    }
    /**
     * Generate output using LM
     */
    async generateOutput(prompt) {
        const lm = (0, base_1.getLM)();
        const response = await lm.generate(prompt, {
            maxTokens: 1000,
            temperature: 0.7,
        });
        // Parse response into output fields
        return this.parseResponse(response);
    }
    /**
     * Parse LM response into output object
     */
    parseResponse(response) {
        const output = {};
        for (const field of this.signature.outputs) {
            // Try to extract field value from response
            const pattern = new RegExp(`${field.name}:\\s*(.+?)(?=\\n[a-z]+:|$)`, 'is');
            const match = response.match(pattern);
            if (match) {
                output[field.name] = match[1].trim();
            }
            else {
                // Fallback: use entire response for first output field
                if (this.signature.outputs.indexOf(field) === 0) {
                    output[field.name] = response.trim();
                }
                else {
                    output[field.name] = '';
                }
            }
        }
        return output;
    }
    /**
     * Validate output against constraints
     */
    validateConstraints(output) {
        const violations = [];
        for (const constraint of this.constraints) {
            const result = constraint.validate(output);
            let validationResult;
            if (typeof result === 'boolean') {
                validationResult = { valid: result };
            }
            else {
                validationResult = result;
            }
            if (!validationResult.valid) {
                violations.push({ constraint, result: validationResult });
            }
        }
        return violations;
    }
}
exports.Refine = Refine;
/**
 * Utility function: Create a length constraint
 */
function lengthConstraint(fieldName, maxLength, hard = true) {
    return {
        validate: (output) => {
            const value = output[fieldName];
            if (typeof value === 'string') {
                return value.length <= maxLength;
            }
            return true;
        },
        message: `${String(fieldName)} must be ${maxLength} characters or less`,
        hard,
    };
}
/**
 * Utility function: Create a pattern constraint
 */
function patternConstraint(fieldName, pattern, message, hard = false) {
    return {
        validate: (output) => {
            const value = output[fieldName];
            if (typeof value === 'string') {
                return pattern.test(value);
            }
            return true;
        },
        message,
        hard,
    };
}
//# sourceMappingURL=refine.js.map