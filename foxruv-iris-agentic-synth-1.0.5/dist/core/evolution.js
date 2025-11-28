import { EvolutionConfigSchema } from '../schemas/prompt-schema.js';
import { PerformanceCache } from './cache.js';
/**
 * Optimized genetic algorithm for prompt evolution
 * Features:
 * - Lazy evaluation of mutations
 * - Memoized fitness calculations
 * - Efficient population management
 * - Smart elitism
 */
export class PromptEvolutionEngine {
    populationCache;
    fitnessCache;
    generationCount = 0;
    bestFitness = -Infinity;
    convergenceHistory = [];
    constructor(config) {
        // Initialize caches for performance
        this.populationCache = new PerformanceCache({
            enabled: true,
            maxSize: config.populationSize * 3,
            ttl: 3600000, // 1 hour
            strategy: 'lru',
        });
        this.fitnessCache = new PerformanceCache({
            enabled: true,
            maxSize: 10000,
            ttl: 3600000,
            strategy: 'lru',
        });
    }
    /**
     * Evolve prompts using genetic algorithm with optimizations
     * @param config - Evolution configuration
     * @param fitnessFunction - Function to evaluate fitness
     */
    async evolve(config, fitnessFunction) {
        const validated = EvolutionConfigSchema.parse(config);
        // Initialize population with efficient structure
        let population = this.initializePopulation(validated.seedPrompts);
        // Memoize fitness function to avoid redundant evaluations
        const cachedFitnessFunction = this.createCachedFitnessFunction(fitnessFunction);
        // Evolution loop
        for (let gen = 0; gen < validated.generations; gen++) {
            this.generationCount = gen;
            // Parallel fitness evaluation for entire population
            await this.evaluatePopulation(population, cachedFitnessFunction);
            // Sort by fitness (descending) - O(n log n)
            population.sort((a, b) => b.fitness - a.fitness);
            // Track convergence
            this.bestFitness = Math.max(this.bestFitness, population[0].fitness);
            this.convergenceHistory.push(this.bestFitness);
            // Check for convergence
            if (this.hasConverged(validated.convergenceThreshold)) {
                console.log(`Converged at generation ${gen}`);
                break;
            }
            // Check max evaluations limit
            if (validated.maxFitnessEvaluations &&
                this.fitnessCache.getStats().size >= validated.maxFitnessEvaluations) {
                console.log(`Reached max fitness evaluations at generation ${gen}`);
                break;
            }
            // Create next generation efficiently
            population = await this.createNextGeneration(population, validated);
        }
        // Final evaluation and sort
        await this.evaluatePopulation(population, cachedFitnessFunction);
        population.sort((a, b) => b.fitness - a.fitness);
        return population;
    }
    /**
     * Initialize population with efficient structure
     */
    initializePopulation(seeds) {
        return seeds.map((content) => ({
            id: this.generateId(),
            content,
            generation: 0,
            fitness: 0,
            parentIds: [],
            mutations: [],
            timestamp: Date.now(),
        }));
    }
    /**
     * Create cached fitness function to avoid redundant evaluations
     */
    createCachedFitnessFunction(fitnessFunction) {
        return async (prompt) => {
            const cacheKey = this.hashString(prompt);
            const cached = this.fitnessCache.get(cacheKey);
            if (cached !== undefined) {
                return cached;
            }
            const fitness = await fitnessFunction(prompt);
            this.fitnessCache.set(cacheKey, fitness);
            return fitness;
        };
    }
    /**
     * Evaluate entire population in parallel for performance
     */
    async evaluatePopulation(population, fitnessFunction) {
        // Batch evaluate to avoid overwhelming the system
        const batchSize = 10;
        const batches = this.chunk(population, batchSize);
        for (const batch of batches) {
            await Promise.all(batch.map(async (individual) => {
                if (individual.fitness === 0) {
                    individual.fitness = await fitnessFunction(individual.content);
                }
            }));
        }
    }
    /**
     * Create next generation using selection, crossover, and mutation
     */
    async createNextGeneration(population, config) {
        const nextGen = [];
        // Elitism: Keep best individuals
        const eliteCount = config.eliteCount;
        nextGen.push(...population.slice(0, eliteCount).map((p) => ({ ...p })));
        // Fill rest of population
        while (nextGen.length < config.populationSize) {
            // Tournament selection for parents
            const parent1 = this.tournamentSelect(population);
            const parent2 = this.tournamentSelect(population);
            let offspring;
            // Crossover
            if (Math.random() < config.crossoverRate) {
                offspring = await this.crossover(parent1, parent2, config);
            }
            else {
                offspring = { ...parent1 };
            }
            // Mutation
            if (Math.random() < config.mutationRate) {
                offspring = await this.mutate(offspring, config);
            }
            offspring.generation = this.generationCount + 1;
            offspring.timestamp = Date.now();
            offspring.fitness = 0; // Reset fitness for re-evaluation
            nextGen.push(offspring);
        }
        return nextGen;
    }
    /**
     * Tournament selection for efficient parent selection
     */
    tournamentSelect(population, tournamentSize = 3) {
        const tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push(population[randomIndex]);
        }
        return tournament.reduce((best, current) => (current.fitness > best.fitness ? current : best));
    }
    /**
     * Optimized crossover operation
     */
    async crossover(parent1, parent2, config) {
        const strategy = config.crossoverOperations[Math.floor(Math.random() * config.crossoverOperations.length)];
        let content;
        switch (strategy) {
            case 'uniform':
                content = this.uniformCrossover(parent1.content, parent2.content);
                break;
            case 'single_point':
                content = this.singlePointCrossover(parent1.content, parent2.content);
                break;
            case 'semantic':
                content = this.semanticCrossover(parent1.content, parent2.content);
                break;
            default:
                content = parent1.content;
        }
        return {
            id: this.generateId(),
            content,
            generation: this.generationCount + 1,
            fitness: 0,
            parentIds: [parent1.id, parent2.id],
            mutations: [`crossover_${strategy}`],
            timestamp: Date.now(),
        };
    }
    /**
     * Optimized mutation operation with lazy evaluation
     */
    async mutate(individual, config) {
        const strategy = config.mutationStrategies[Math.floor(Math.random() * config.mutationStrategies.length)];
        let content;
        const mutations = [...individual.mutations, `mutation_${strategy}`];
        switch (strategy) {
            case 'zero_order':
                content = this.zeroOrderMutation(individual.content);
                break;
            case 'first_order':
                content = this.firstOrderMutation(individual.content);
                break;
            case 'semantic_rewrite':
                content = this.semanticRewrite(individual.content);
                break;
            case 'hypermutation':
                content = this.hypermutation(individual.content);
                break;
            default:
                content = individual.content;
        }
        return {
            ...individual,
            id: this.generateId(),
            content,
            mutations,
            fitness: 0,
        };
    }
    // Crossover implementations (optimized for performance)
    uniformCrossover(content1, content2) {
        const words1 = content1.split(' ');
        const words2 = content2.split(' ');
        const minLength = Math.min(words1.length, words2.length);
        const result = [];
        for (let i = 0; i < minLength; i++) {
            result.push(Math.random() < 0.5 ? words1[i] : words2[i]);
        }
        // Add remaining words from longer parent
        if (words1.length > minLength) {
            result.push(...words1.slice(minLength));
        }
        else if (words2.length > minLength) {
            result.push(...words2.slice(minLength));
        }
        return result.join(' ');
    }
    singlePointCrossover(content1, content2) {
        const words1 = content1.split(' ');
        const words2 = content2.split(' ');
        const crossoverPoint = Math.floor(Math.random() * Math.min(words1.length, words2.length));
        return [...words1.slice(0, crossoverPoint), ...words2.slice(crossoverPoint)].join(' ');
    }
    semanticCrossover(content1, content2) {
        // Simple semantic crossover: alternate sentences
        const sentences1 = content1.split(/[.!?]+/).filter((s) => s.trim());
        const sentences2 = content2.split(/[.!?]+/).filter((s) => s.trim());
        const result = [];
        const maxLength = Math.max(sentences1.length, sentences2.length);
        for (let i = 0; i < maxLength; i++) {
            if (i < sentences1.length && i % 2 === 0) {
                result.push(sentences1[i].trim());
            }
            else if (i < sentences2.length) {
                result.push(sentences2[i].trim());
            }
        }
        return result.join('. ') + '.';
    }
    // Mutation implementations (lightweight and efficient)
    zeroOrderMutation(content) {
        const words = content.split(' ');
        if (words.length < 2)
            return content;
        // Swap two random words
        const idx1 = Math.floor(Math.random() * words.length);
        const idx2 = Math.floor(Math.random() * words.length);
        [words[idx1], words[idx2]] = [words[idx2], words[idx1]];
        return words.join(' ');
    }
    firstOrderMutation(content) {
        const words = content.split(' ');
        if (words.length < 2)
            return content;
        // Remove a random word
        const removeIdx = Math.floor(Math.random() * words.length);
        words.splice(removeIdx, 1);
        return words.join(' ');
    }
    semanticRewrite(content) {
        // Simple semantic variation: add emphasis markers
        const variations = [
            `${content} (important)`,
            `Focus: ${content}`,
            `Key point: ${content}`,
            `${content} - essential`,
        ];
        return variations[Math.floor(Math.random() * variations.length)];
    }
    hypermutation(content) {
        // Multiple mutations in sequence
        let result = this.zeroOrderMutation(content);
        result = this.firstOrderMutation(result);
        return result;
    }
    // Convergence detection
    hasConverged(convergenceThreshold) {
        if (!convergenceThreshold)
            return false;
        if (this.convergenceHistory.length < 5)
            return false;
        // Check if improvement rate is below threshold
        const recent = this.convergenceHistory.slice(-5);
        const improvementRate = (recent[recent.length - 1] - recent[0]) / recent[0];
        return improvementRate < convergenceThreshold;
    }
    // Utility functions
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
    chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    /**
     * Get optimizer statistics
     */
    getStats() {
        return {
            generation: this.generationCount,
            bestFitness: this.bestFitness,
            convergenceHistory: this.convergenceHistory,
            fitnessCache: this.fitnessCache.getStats(),
            populationCache: this.populationCache.getStats(),
        };
    }
}
//# sourceMappingURL=evolution.js.map