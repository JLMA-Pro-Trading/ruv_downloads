/**
 * PromptBreeder - Genetic Algorithm for Prompt Evolution
 *
 * Based on Google DeepMind's PromptBreeder research:
 * "PromptBreeder: Self-Referential Self-Improvement Via Prompt Evolution"
 *
 * Features:
 * - **Genetic Operators**: Mutation, crossover, selection
 * - **Multi-Project Fitness**: Evaluate prompts across NFL, Microbiome, BeClever
 * - **Evolution Tracking**: Store lineage in AgentDB and Supabase
 * - **Rollback Support**: Revert to previous generation if degradation
 * - **Population Management**: Maintain diverse prompt population
 *
 * @module evolution/prompt-breeder
 * @version 1.0.0
 */
/**
 * Prompt individual in the population
 */
export interface PromptIndividual {
    id: string;
    prompt: string;
    fitness: number;
    generation: number;
    parentIds: string[];
    mutations: string[];
    metadata: {
        created: Date;
        expertType: string;
        project?: string;
        signature?: Record<string, any>;
    };
}
/**
 * Fitness evaluation result across projects
 */
export interface FitnessEvaluation {
    overall: number;
    byProject: Map<string, number>;
    metrics: {
        accuracy?: number;
        latency?: number;
        consistency?: number;
    };
    timestamp: Date;
}
export interface PromptBreederStatistics {
    totalGenerations: number;
    bestFitness: number;
    improvementRate: number;
    averageDiversity: number;
    convergenceRate: number;
}
/**
 * Evolution generation snapshot
 */
export interface Generation {
    number: number;
    population: PromptIndividual[];
    bestFitness: number;
    avgFitness: number;
    diversity: number;
    timestamp: Date;
}
/**
 * Mutation strategy
 */
export type MutationStrategy = 'zero_order' | 'first_order' | 'lineage_mutation' | 'hypermutation' | 'lamarckian' | 'semantic_rewrite';
/**
 * Crossover strategy
 */
export type CrossoverStrategy = 'uniform' | 'single_point' | 'multi_point' | 'semantic';
/**
 * Fitness evaluation function
 */
export type FitnessFunction = (prompt: string, expertType: string, projects: string[]) => Promise<FitnessEvaluation>;
/**
 * PromptBreeder configuration
 */
export interface PromptBreederConfig {
    /** Population size */
    populationSize?: number;
    /** Number of generations */
    generations?: number;
    /** Mutation rate (0-1) */
    mutationRate?: number;
    /** Crossover rate (0-1) */
    crossoverRate?: number;
    /** Elite size (top N preserved each generation) */
    eliteSize?: number;
    /** Projects to evaluate fitness on */
    projects?: string[];
    /** Fitness function */
    fitnessFunction?: FitnessFunction;
    /** AgentDB path for tracking */
    agentDBPath?: string;
    /** Enable Supabase integration */
    useSupabase?: boolean;
    /** Minimum fitness threshold */
    minFitnessThreshold?: number;
    /** Enable auto-rollback on degradation */
    autoRollback?: boolean;
    /** LLM Endpoint (optional override) */
    llmEndpoint?: string;
    /** LLM Model ID (optional override) */
    llmModel?: string;
}
export declare class PromptBreederEngine {
    private config;
    private agentDB?;
    private llmProvider;
    private evalProvider?;
    private population;
    private generations;
    private currentGeneration;
    private useSupabase;
    constructor(config?: PromptBreederConfig);
    /**
     * Evolve prompts over multiple generations
     */
    evolve(expertType: string, seedPrompts: string[], signature?: Record<string, any>): Promise<{
        bestPrompt: PromptIndividual;
        evolution: Generation[];
        improvements: number;
    }>;
    /**
     * Initialize population from seed prompts
     */
    private initializePopulation;
    /**
     * Evaluate fitness for all individuals
     */
    private evaluateFitness;
    /**
     * Helper to record evaluation in AgentDB
     */
    private recordEvaluation;
    /**
     * Create next generation using genetic operators
     */
    private createNextGeneration;
    /**
     * Mutate a prompt using specified strategy
     */
    mutate(prompt: string, strategy: MutationStrategy): Promise<{
        prompt: string;
        mutations: string[];
    }>;
    /**
     * Intelligent Mutation using Local LLM
     */
    private llmMutation;
    /**
     * Zero-order mutation: Complete rewrite
     */
    private zeroOrderMutation;
    /**
     * First-order mutation: Modify specific sections
     */
    private firstOrderMutation;
    /**
     * Lineage mutation: Combine with historical prompts
     */
    private lineageMutation;
    /**
     * Hypermutation: Multiple random mutations
     */
    private hypermutation;
    /**
     * Lamarckian mutation: Guided improvement based on feedback
     */
    private lamarckianMutation;
    /**
     * Crossover: Combine two parent prompts
     */
    crossover(parent1: PromptIndividual, parent2: PromptIndividual, strategy: CrossoverStrategy): Promise<{
        prompt: string;
        mutations: string[];
    }>;
    /**
     * Uniform crossover: Random selection from both parents
     */
    private uniformCrossover;
    /**
     * Single-point crossover
     */
    private singlePointCrossover;
    /**
     * Multi-point crossover
     */
    private multiPointCrossover;
    /**
     * Semantic crossover: Combine based on meaning
     */
    private semanticCrossover;
    /**
     * Tournament selection
     */
    private tournamentSelect;
    /**
     * Select mutation strategy based on generation
     */
    private selectMutationStrategy;
    /**
     * Extract key concepts from prompt
     */
    private extractConcepts;
    /**
     * Mutate a single sentence
     */
    private mutateSentence;
    /**
     * Blend two prompts
     */
    private blendPrompts;
    /**
     * Capture current generation snapshot
     */
    private captureGeneration;
    /**
     * Store best prompt in Supabase
     */
    private storeBestPrompt;
    /**
     * Default fitness function (simple placeholder)
     */
    private defaultFitnessFunction;
    /**
     * Evaluate multiple prompts in a single batch using Claude
     */
    private evaluateBatchWithLLM;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Rollback to specific generation
     */
    rollbackToGeneration(generationNumber: number): boolean;
    /**
     * Get evolution lineage for a prompt
     */
    getLineage(promptId: string): PromptIndividual[];
    /**
     * Get evolution statistics
     */
    getStatistics(): {
        totalGenerations: number;
        bestFitness: number;
        improvementRate: number;
        averageDiversity: number;
        convergenceRate: number;
    };
    /**
     * Export evolution data
     */
    exportEvolution(): {
        config: Required<PromptBreederConfig>;
        generations: Generation[];
        statistics: PromptBreederStatistics;
    };
    /**
     * Close connections
     */
    close(): void;
}
/**
 * Create PromptBreeder engine
 */
export declare function createPromptBreeder(config?: PromptBreederConfig): PromptBreederEngine;
//# sourceMappingURL=prompt-breeder.d.ts.map