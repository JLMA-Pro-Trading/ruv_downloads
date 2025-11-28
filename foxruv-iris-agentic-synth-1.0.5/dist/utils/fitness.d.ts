/**
 * Fitness evaluation functions for genetic algorithm
 */
export interface FitnessContext {
    name: string;
    description: string;
    testCases?: string[];
    weight?: number;
}
export interface FitnessScore {
    total: number;
    contextScores: Map<string, number>;
    metadata?: Record<string, any>;
}
/**
 * Default fitness function evaluator
 */
export declare class FitnessEvaluator {
    private contexts;
    private evaluationCount;
    constructor(contexts?: FitnessContext[]);
    /**
     * Evaluate fitness of a prompt across multiple contexts
     */
    evaluate(prompt: string): Promise<FitnessScore>;
    /**
     * Evaluate prompt against a specific context
     */
    private evaluateContext;
    /**
     * Evaluate prompt length
     */
    private evaluateLength;
    /**
     * Evaluate prompt clarity
     */
    private evaluateClarity;
    /**
     * Evaluate prompt structure
     */
    private evaluateStructure;
    /**
     * Evaluate relevance to context
     */
    private evaluateRelevance;
    /**
     * Get default fitness contexts
     */
    private getDefaultContexts;
    /**
     * Get evaluation statistics
     */
    getStats(): {
        totalEvaluations: number;
        contexts: {
            name: string;
            weight: number;
        }[];
    };
}
/**
 * Compare two prompts and return the better one
 */
export declare function compareFitness(prompt1: string, prompt2: string, evaluator: FitnessEvaluator): Promise<{
    winner: string;
    scores: [number, number];
}>;
/**
 * Custom fitness function type
 */
export type CustomFitnessFunction = (prompt: string) => Promise<number> | number;
//# sourceMappingURL=fitness.d.ts.map