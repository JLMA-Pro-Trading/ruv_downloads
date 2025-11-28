"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiChainComparison = void 0;
exports.compareChains = compareChains;
const module_1 = require("../core/module");
const chain_of_thought_1 = require("./chain-of-thought");
const base_1 = require("../lm/base");
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
class MultiChainComparison extends module_1.Module {
    constructor(config) {
        super({
            name: config.name,
            signature: config.signature,
            strategy: 'ChainOfThought',
        });
        this.n = config.n || 3;
        this.temperature = config.temperature || 0.7;
        // Create ChainOfThought module if not provided
        this.chainModule =
            config.chainModule ||
                new chain_of_thought_1.ChainOfThought({
                    name: `${config.name}_Chain`,
                    signature: config.signature,
                });
    }
    /**
     * Run the MultiChainComparison module
     */
    async run(input) {
        // Step 1: Generate multiple Chain-of-Thought outputs
        const candidates = await this.generateCandidates(input);
        if (candidates.length === 0) {
            throw new Error('Failed to generate any candidates');
        }
        // Step 2: Compare and score candidates
        const scoredCandidates = await this.scoreCandidates(input, candidates);
        // Step 3: Select the best candidate
        const best = scoredCandidates.reduce((prev, curr) => (curr.score > prev.score ? curr : prev));
        // Return best output with all candidates for transparency
        return Object.assign(Object.assign({}, best.output), { candidates: scoredCandidates });
    }
    /**
     * Generate multiple candidate outputs
     */
    async generateCandidates(input) {
        const candidates = [];
        const promises = [];
        // Generate N candidates in parallel
        for (let i = 0; i < this.n; i++) {
            promises.push(this.chainModule.run(input));
        }
        // Wait for all candidates (with error handling)
        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'fulfilled') {
                candidates.push(result.value);
            }
            else {
                console.warn('Failed to generate candidate:', result.reason);
            }
        }
        return candidates;
    }
    /**
     * Score and rank candidates
     */
    async scoreCandidates(input, candidates) {
        const lm = (0, base_1.getLM)();
        // Build comparison prompt
        const prompt = this.buildComparisonPrompt(input, candidates);
        // Get LM to compare and score
        const response = await lm.generate(prompt, {
            maxTokens: 1000,
            temperature: 0.1, // Low temperature for consistent scoring
        });
        // Parse scores
        const scores = this.parseScores(response, candidates.length);
        // Create scored candidates
        return candidates.map((output, index) => ({
            output,
            score: scores[index] || 0,
            index,
        }));
    }
    /**
     * Build the comparison prompt
     */
    buildComparisonPrompt(input, candidates) {
        const inputStr = this.signature.inputs
            .map((field) => {
            const value = input[field.name];
            return `${field.name}: ${value}`;
        })
            .join('\n');
        const candidatesStr = candidates
            .map((candidate, index) => {
            const outputStr = this.signature.outputs
                .map((field) => {
                const value = candidate[field.name];
                return `${field.name}: ${value}`;
            })
                .join('\n');
            return `[Candidate ${index + 1}]
Reasoning: ${candidate.reasoning}
${outputStr}`;
        })
            .join('\n\n---\n\n');
        return `You are an expert judge evaluating multiple Chain-of-Thought solutions.

Input:
${inputStr}

Candidates to evaluate:
${candidatesStr}

Instructions:
1. Evaluate each candidate based on:
   - Reasoning quality and logic
   - Correctness of the answer
   - Clarity and coherence
   - Relevance to the input

2. Assign a score from 0 to 10 for each candidate

3. Provide scores in the format:
Candidate 1: [score]
Candidate 2: [score]
...

Evaluation:`;
    }
    /**
     * Parse scores from LM response
     */
    parseScores(response, numCandidates) {
        const scores = new Array(numCandidates).fill(5); // Default score
        // Extract scores using regex
        const lines = response.split('\n');
        for (const line of lines) {
            const match = line.match(/Candidate\s+(\d+):\s*(\d+(?:\.\d+)?)/i);
            if (match) {
                const candidateIndex = parseInt(match[1]) - 1; // Convert to 0-based
                const score = parseFloat(match[2]);
                if (candidateIndex >= 0 && candidateIndex < numCandidates) {
                    scores[candidateIndex] = score;
                }
            }
        }
        return scores;
    }
}
exports.MultiChainComparison = MultiChainComparison;
/**
 * Utility function to run MultiChainComparison with a simple interface
 */
async function compareChains(input, signature, options = {}) {
    const comparator = new MultiChainComparison(Object.assign({ name: 'Comparison', signature }, options));
    return await comparator.run(input);
}
//# sourceMappingURL=multi-chain-comparison.js.map