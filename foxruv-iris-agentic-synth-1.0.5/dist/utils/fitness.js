/**
 * Fitness evaluation functions for genetic algorithm
 */
/**
 * Default fitness function evaluator
 */
export class FitnessEvaluator {
    contexts;
    evaluationCount;
    constructor(contexts = []) {
        this.contexts = contexts.length > 0 ? contexts : this.getDefaultContexts();
        this.evaluationCount = 0;
    }
    /**
     * Evaluate fitness of a prompt across multiple contexts
     */
    async evaluate(prompt) {
        this.evaluationCount++;
        const contextScores = new Map();
        let totalScore = 0;
        for (const context of this.contexts) {
            const score = await this.evaluateContext(prompt, context);
            const weight = context.weight || 1.0;
            const weightedScore = score * weight;
            contextScores.set(context.name, score);
            totalScore += weightedScore;
        }
        // Normalize by total weight
        const totalWeight = this.contexts.reduce((sum, ctx) => sum + (ctx.weight || 1), 0);
        const normalizedScore = totalScore / totalWeight;
        return {
            total: normalizedScore,
            contextScores,
            metadata: {
                evaluationNumber: this.evaluationCount,
                contextsEvaluated: this.contexts.length,
            },
        };
    }
    /**
     * Evaluate prompt against a specific context
     */
    async evaluateContext(prompt, context) {
        let score = 0;
        const maxScore = 10;
        // Length check (prompts should be substantial but not too long)
        const lengthScore = this.evaluateLength(prompt);
        score += lengthScore;
        // Clarity check (simple heuristics)
        const clarityScore = this.evaluateClarity(prompt);
        score += clarityScore;
        // Structure check
        const structureScore = this.evaluateStructure(prompt);
        score += structureScore;
        // Context relevance
        const relevanceScore = this.evaluateRelevance(prompt, context);
        score += relevanceScore;
        // Normalize to 0-1
        return Math.min(score / maxScore, 1.0);
    }
    /**
     * Evaluate prompt length
     */
    evaluateLength(prompt) {
        const words = prompt.split(/\s+/).length;
        if (words < 10)
            return 0.5;
        if (words > 500)
            return 0.5;
        if (words >= 20 && words <= 200)
            return 2.5;
        return 1.5;
    }
    /**
     * Evaluate prompt clarity
     */
    evaluateClarity(prompt) {
        let score = 0;
        // Check for clear instructions
        const instructionKeywords = ['you are', 'act as', 'provide', 'analyze', 'create'];
        const hasInstructions = instructionKeywords.some(kw => prompt.toLowerCase().includes(kw));
        if (hasInstructions)
            score += 1.5;
        // Check for specific language
        const specificityKeywords = ['specific', 'detailed', 'comprehensive', 'expert'];
        const hasSpecificity = specificityKeywords.some(kw => prompt.toLowerCase().includes(kw));
        if (hasSpecificity)
            score += 1.0;
        return score;
    }
    /**
     * Evaluate prompt structure
     */
    evaluateStructure(prompt) {
        let score = 0;
        // Check for proper sentences
        const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length >= 2)
            score += 1.5;
        // Check for formatting
        const hasFormatting = /\n|\t|-|\*|•/.test(prompt);
        if (hasFormatting)
            score += 1.0;
        return score;
    }
    /**
     * Evaluate relevance to context
     */
    evaluateRelevance(prompt, context) {
        const lowerPrompt = prompt.toLowerCase();
        const keywords = context.description.toLowerCase().split(/\s+/);
        const matchCount = keywords.filter(kw => kw.length > 3 && lowerPrompt.includes(kw)).length;
        const relevanceRatio = matchCount / Math.max(keywords.length, 1);
        return relevanceRatio * 4.0; // Max 4 points for relevance
    }
    /**
     * Get default fitness contexts
     */
    getDefaultContexts() {
        return [
            {
                name: 'clarity',
                description: 'Prompt should be clear and unambiguous',
                weight: 1.5,
            },
            {
                name: 'specificity',
                description: 'Prompt should be specific and detailed',
                weight: 1.2,
            },
            {
                name: 'structure',
                description: 'Prompt should be well-structured',
                weight: 1.0,
            },
            {
                name: 'effectiveness',
                description: 'Prompt should be effective for its purpose',
                weight: 1.3,
            },
        ];
    }
    /**
     * Get evaluation statistics
     */
    getStats() {
        return {
            totalEvaluations: this.evaluationCount,
            contexts: this.contexts.map(ctx => ({
                name: ctx.name,
                weight: ctx.weight || 1.0,
            })),
        };
    }
}
/**
 * Compare two prompts and return the better one
 */
export async function compareFitness(prompt1, prompt2, evaluator) {
    const [score1, score2] = await Promise.all([
        evaluator.evaluate(prompt1),
        evaluator.evaluate(prompt2),
    ]);
    return {
        winner: score1.total > score2.total ? prompt1 : prompt2,
        scores: [score1.total, score2.total],
    };
}
//# sourceMappingURL=fitness.js.map