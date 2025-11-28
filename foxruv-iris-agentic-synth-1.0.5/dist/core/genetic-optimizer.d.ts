import { EvolutionConfig, EvolvedPrompt } from '../schemas/prompt-schema.js';
/**
 * Optimized genetic algorithm for prompt evolution
 * Features:
 * - Lazy evaluation of mutations
 * - Memoized fitness calculations
 * - Efficient population management
 * - Smart elitism
 */
export declare class GeneticOptimizer {
    private config;
    private populationCache;
    private fitnessCache;
    private generationCount;
    private bestFitness;
    private convergenceHistory;
    constructor(config: EvolutionConfig);
    /**
     * Evolve prompts using genetic algorithm with optimizations
     * @param initialPopulation - Starting population
     * @param fitnessFunction - Function to evaluate fitness
     */
    evolve(initialPopulation: string[], fitnessFunction: (prompt: string) => Promise<number>): Promise<EvolvedPrompt[]>;
    /**
     * Initialize population with efficient structure
     */
    private initializePopulation;
    /**
     * Create cached fitness function to avoid redundant evaluations
     */
    private createCachedFitnessFunction;
    /**
     * Evaluate entire population in parallel for performance
     */
    private evaluatePopulation;
    /**
     * Create next generation using selection, crossover, and mutation
     */
    private createNextGeneration;
    /**
     * Tournament selection for efficient parent selection
     */
    private tournamentSelect;
    /**
     * Optimized crossover operation
     */
    private crossover;
    /**
     * Optimized mutation operation with lazy evaluation
     */
    private mutate;
    private uniformCrossover;
    private singlePointCrossover;
    private semanticCrossover;
    private zeroOrderMutation;
    private firstOrderMutation;
    private semanticRewrite;
    private hypermutation;
    private hasConverged;
    private generateId;
    private hashString;
    private chunk;
    /**
     * Get optimizer statistics
     */
    getStats(): {
        generation: number;
        bestFitness: number;
        convergenceHistory: number[];
        fitnessCache: {
            size: number;
            hits: number;
            misses: number;
            evictions: number;
            hitRate: number;
            maxSize: number;
            strategy: "lru" | "lfu" | "fifo";
        };
        populationCache: {
            size: number;
            hits: number;
            misses: number;
            evictions: number;
            hitRate: number;
            maxSize: number;
            strategy: "lru" | "lfu" | "fifo";
        };
    };
}
//# sourceMappingURL=genetic-optimizer.d.ts.map