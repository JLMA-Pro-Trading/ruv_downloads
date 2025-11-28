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
import { AgentDBManager } from '../storage/agentdb-integration.js';
import { Qwen3Provider } from '../providers/qwen3-provider.js';
import { ClaudeProvider } from '../providers/claude-provider.js';
import { storeExpertSignature, getSignatureHistory, recordSignatureUpgrade, isSupabaseInitialized, } from '../supabase/index.js';
// ============================================================================
// PromptBreeder Engine
// ============================================================================
export class PromptBreederEngine {
    config;
    agentDB;
    llmProvider;
    evalProvider;
    population = [];
    generations = [];
    currentGeneration = 0;
    useSupabase;
    constructor(config = {}) {
        this.config = {
            populationSize: config.populationSize ?? 20,
            generations: config.generations ?? 10,
            mutationRate: config.mutationRate ?? 0.3,
            crossoverRate: config.crossoverRate ?? 0.6,
            eliteSize: config.eliteSize ?? 3,
            projects: config.projects ?? ['nfl-predictor', 'microbiome-discovery', 'beclever-ai'],
            fitnessFunction: config.fitnessFunction ?? this.defaultFitnessFunction,
            agentDBPath: config.agentDBPath ?? './data/prompt-evolution.db',
            useSupabase: config.useSupabase ?? true,
            minFitnessThreshold: config.minFitnessThreshold ?? 0.7,
            autoRollback: config.autoRollback ?? true,
            llmEndpoint: config.llmEndpoint ?? 'http://192.168.254.246:1234',
            llmModel: config.llmModel ?? 'qwen3-coder-30b-a3b-instruct-mlx'
        };
        this.useSupabase = this.config.useSupabase && isSupabaseInitialized();
        // Initialize AgentDB for evolution tracking
        this.agentDB = new AgentDBManager({
            dbPath: this.config.agentDBPath,
            enableCausalReasoning: true,
            enableReflexion: true,
        });
        // Initialize Local LLM Provider
        this.llmProvider = new Qwen3Provider(this.config.llmEndpoint, this.config.llmModel, 1 // Max concurrency 1 for local model
        );
        // Initialize Evaluation Provider (Claude)
        if (process.env.ANTHROPIC_API_KEY) {
            this.evalProvider = new ClaudeProvider(process.env.ANTHROPIC_API_KEY);
            console.log('✅ Claude Provider initialized for Fitness Evaluation.');
        }
    }
    // ============================================================================
    // Evolution Process
    // ============================================================================
    /**
     * Evolve prompts over multiple generations
     */
    async evolve(expertType, seedPrompts, signature) {
        console.log(`🧬 Starting PromptBreeder evolution for ${expertType}`);
        console.log(`📊 Population: ${this.config.populationSize}, Generations: ${this.config.generations}`);
        console.log(`🎯 Projects: ${this.config.projects.join(', ')}`);
        // Ensure provider is healthy
        const isHealthy = await this.llmProvider.healthCheck();
        if (!isHealthy) {
            console.warn('⚠️ Local LLM provider not reachable. Falling back to regex mutations.');
        }
        else {
            console.log('✅ Local LLM provider connected for semantic mutations.');
        }
        // Initialize population from seed prompts
        await this.initializePopulation(seedPrompts, expertType, signature);
        let improvementCount = 0;
        let previousBestFitness = 0;
        for (let gen = 0; gen < this.config.generations; gen++) {
            this.currentGeneration = gen;
            console.log(`\n🔄 Generation ${gen + 1}/${this.config.generations}`);
            // Evaluate fitness
            await this.evaluateFitness(expertType);
            // Get current generation stats
            const generation = this.captureGeneration();
            this.generations.push(generation);
            console.log(`   Best Fitness: ${generation.bestFitness.toFixed(4)}`);
            console.log(`   Avg Fitness:  ${generation.avgFitness.toFixed(4)}`);
            console.log(`   Diversity:    ${generation.diversity.toFixed(4)}`);
            // Track improvement
            if (generation.bestFitness > previousBestFitness) {
                improvementCount++;
                console.log(`   ✅ Improvement detected!`);
            }
            previousBestFitness = generation.bestFitness;
            // Check for degradation and rollback if needed
            if (this.config.autoRollback && gen > 0) {
                const previousGen = this.generations[gen - 1];
                if (generation.bestFitness < previousGen.bestFitness * 0.95) {
                    console.warn(`   ⚠️  Degradation detected, rolling back...`);
                    this.population = previousGen.population;
                    continue;
                }
            }
            // Don't evolve on last generation
            if (gen < this.config.generations - 1) {
                // Create next generation
                await this.createNextGeneration(expertType);
            }
        }
        // Get best individual
        const bestPrompt = this.population.reduce((best, current) => current.fitness > best.fitness ? current : best);
        // Store best prompt in Supabase if available
        if (this.useSupabase && signature) {
            await this.storeBestPrompt(bestPrompt, expertType, signature);
        }
        console.log(`\n✨ Evolution complete!`);
        console.log(`📈 Improvements: ${improvementCount}/${this.config.generations}`);
        console.log(`🏆 Best Fitness: ${bestPrompt.fitness.toFixed(4)}`);
        return {
            bestPrompt,
            evolution: this.generations,
            improvements: improvementCount,
        };
    }
    /**
     * Initialize population from seed prompts
     */
    async initializePopulation(seedPrompts, expertType, signature) {
        this.population = [];
        // Create individuals from seed prompts
        for (let i = 0; i < Math.min(seedPrompts.length, this.config.populationSize); i++) {
            const individual = {
                id: this.generateId(),
                prompt: seedPrompts[i],
                fitness: 0,
                generation: 0,
                parentIds: [],
                mutations: [],
                metadata: {
                    created: new Date(),
                    expertType,
                    signature,
                },
            };
            this.population.push(individual);
        }
        // Fill remaining with mutations if needed
        while (this.population.length < this.config.populationSize) {
            const template = seedPrompts[Math.floor(Math.random() * seedPrompts.length)];
            const mutated = await this.mutate(template, 'first_order');
            const individual = {
                id: this.generateId(),
                prompt: mutated.prompt,
                fitness: 0,
                generation: 0,
                parentIds: [],
                mutations: mutated.mutations,
                metadata: {
                    created: new Date(),
                    expertType,
                    signature,
                },
            };
            this.population.push(individual);
        }
    }
    /**
     * Evaluate fitness for all individuals
     */
    async evaluateFitness(expertType) {
        // Option 1: Batch Evaluation with Claude (Optimization)
        if (this.evalProvider) {
            try {
                const promptMap = new Map();
                this.population.forEach(p => promptMap.set(p.id, p.prompt));
                const scores = await this.evaluateBatchWithLLM(promptMap, expertType, this.config.projects);
                for (const individual of this.population) {
                    const score = scores.get(individual.id) ?? 0.5;
                    individual.fitness = score;
                    // Record in AgentDB
                    await this.recordEvaluation(individual, expertType, score);
                }
                return; // Batch success, exit
            }
            catch (error) {
                console.warn('Batch evaluation failed, falling back to sequential:', error);
                // Fall through to sequential
            }
        }
        // Option 2: Sequential Evaluation (Legacy/Fallback)
        const evaluations = await Promise.all(this.population.map(async (individual) => {
            const fitness = await this.config.fitnessFunction(individual.prompt, expertType, this.config.projects);
            return { individual, fitness };
        }));
        for (const { individual, fitness } of evaluations) {
            individual.fitness = fitness.overall;
            await this.recordEvaluation(individual, expertType, fitness.overall, fitness);
        }
    }
    /**
     * Helper to record evaluation in AgentDB
     */
    async recordEvaluation(individual, expertType, score, details) {
        if (this.agentDB) {
            await this.agentDB.recordCausalDecision({
                id: `causal-${this.generateId()}`,
                timestamp: new Date(),
                expertId: individual.id,
                input: { prompt: individual.prompt, expertType },
                output: { fitness: score, details },
                reasoning: individual.mutations,
                causality: {
                    causes: individual.parentIds,
                    effects: [],
                    confidence: score,
                },
                outcome: {
                    success: score > this.config.minFitnessThreshold,
                    metrics: { score },
                },
            });
        }
    }
    /**
     * Create next generation using genetic operators
     */
    async createNextGeneration(expertType) {
        const newPopulation = [];
        // Sort by fitness
        const sorted = [...this.population].sort((a, b) => b.fitness - a.fitness);
        // Elitism: Preserve top performers
        for (let i = 0; i < this.config.eliteSize; i++) {
            newPopulation.push({ ...sorted[i] });
        }
        // Generate rest of population
        while (newPopulation.length < this.config.populationSize) {
            const op = Math.random();
            if (op < this.config.crossoverRate) {
                // Crossover
                const parent1 = this.tournamentSelect();
                const parent2 = this.tournamentSelect();
                const child = await this.crossover(parent1, parent2, 'semantic');
                newPopulation.push({
                    id: this.generateId(),
                    prompt: child.prompt,
                    fitness: 0,
                    generation: this.currentGeneration + 1,
                    parentIds: [parent1.id, parent2.id],
                    mutations: child.mutations,
                    metadata: {
                        created: new Date(),
                        expertType,
                        signature: parent1.metadata.signature,
                    },
                });
            }
            else if (op < this.config.crossoverRate + this.config.mutationRate) {
                // Mutation
                const parent = this.tournamentSelect();
                const strategy = this.selectMutationStrategy();
                const mutated = await this.mutate(parent.prompt, strategy);
                newPopulation.push({
                    id: this.generateId(),
                    prompt: mutated.prompt,
                    fitness: 0,
                    generation: this.currentGeneration + 1,
                    parentIds: [parent.id],
                    mutations: mutated.mutations,
                    metadata: {
                        created: new Date(),
                        expertType,
                        signature: parent.metadata.signature,
                    },
                });
            }
            else {
                // Reproduction (clone)
                const parent = this.tournamentSelect();
                newPopulation.push({
                    ...parent,
                    id: this.generateId(),
                    generation: this.currentGeneration + 1,
                });
            }
        }
        this.population = newPopulation;
    }
    // ============================================================================
    // Genetic Operators
    // ============================================================================
    /**
     * Mutate a prompt using specified strategy
     */
    async mutate(prompt, strategy) {
        const mutations = [];
        switch (strategy) {
            case 'zero_order':
                // Complete rewrite with same intent
                mutations.push('zero_order_rewrite');
                return {
                    prompt: await this.zeroOrderMutation(prompt),
                    mutations,
                };
            case 'first_order':
                // Modify specific sections
                mutations.push('first_order_modification');
                return {
                    prompt: await this.firstOrderMutation(prompt),
                    mutations,
                };
            case 'lineage_mutation':
                // Combine with historical prompts
                mutations.push('lineage_combination');
                return {
                    prompt: await this.lineageMutation(prompt),
                    mutations,
                };
            case 'hypermutation':
                // Multiple random mutations
                mutations.push('hypermutation');
                return {
                    prompt: await this.hypermutation(prompt),
                    mutations,
                };
            case 'lamarckian':
                // Guided improvement using LLM if available
                mutations.push('lamarckian_improvement');
                if (await this.llmProvider.healthCheck()) {
                    return {
                        prompt: await this.llmMutation(prompt, 'Improve clarity and specificity while maintaining the core role.'),
                        mutations
                    };
                }
                return {
                    prompt: await this.lamarckianMutation(prompt),
                    mutations,
                };
            case 'semantic_rewrite':
                // Intelligent LLM rewrite
                mutations.push('semantic_rewrite');
                if (await this.llmProvider.healthCheck()) {
                    return {
                        prompt: await this.llmMutation(prompt, 'Rewrite this prompt to be more persuasive and authoritative.'),
                        mutations
                    };
                }
                return {
                    prompt: await this.zeroOrderMutation(prompt), // Fallback
                    mutations
                };
            default:
                return { prompt, mutations };
        }
    }
    /**
     * Intelligent Mutation using Local LLM
     */
    async llmMutation(prompt, instruction) {
        try {
            // Define strict schema for LM Studio / OpenAI Structured Output
            const schema = {
                type: "object",
                properties: {
                    improved_prompt: {
                        type: "string",
                        description: "The rewritten, optimized version of the user's prompt."
                    }
                },
                required: ["improved_prompt"],
                additionalProperties: false
            };
            console.log(`[LLM Mutation] Attempting LLM mutation for prompt: "${prompt.slice(0, 50)}..."`);
            console.log(`[LLM Mutation] Goal: "${instruction}"`);
            console.log(`[LLM Mutation] Using Schema: ${JSON.stringify(schema)}`);
            const result = await this.llmProvider.predict({
                instructions: 'You are a Prompt Engineer optimization expert.',
                input: {
                    original_prompt: 'The prompt to optimize',
                    mutation_goal: 'The specific goal of this mutation'
                },
                output: {
                    improved_prompt: 'The mutated prompt text only'
                }
            }, {
                original_prompt: prompt,
                mutation_goal: instruction
            }, 'You are a Prompt Evolution Engine. Your goal is to mutate the input prompt according to the mutation goal. Use the provided JSON schema.', 0.7, // Higher temperature for creativity
            2048, schema // Pass the schema
            );
            console.log(`[LLM Mutation] Raw LLM Result: ${JSON.stringify(result)}`);
            if (result.improved_prompt) {
                console.log(`[LLM Mutation] LLM successfully mutated prompt.`);
                return result.improved_prompt;
            }
            else {
                console.warn(`[LLM Mutation] LLM returned no improved_prompt. Falling back.`);
                return prompt;
            }
        }
        catch (error) {
            console.warn('LLM Mutation failed:', error);
            console.warn(`[LLM Mutation] Error details: ${error instanceof Error ? error.message : String(error)}`);
            return prompt; // Fail safe
        }
    }
    /**
     * Zero-order mutation: Complete rewrite
     */
    async zeroOrderMutation(prompt) {
        // Extract key concepts
        const concepts = this.extractConcepts(prompt);
        // Rewrite with same concepts but different structure
        const templates = [
            `You are a highly skilled ${concepts.role}. Your expertise includes ${concepts.skills}. Focus on ${concepts.goal}.`,
            `As an expert ${concepts.role}, you excel at ${concepts.skills}. Your primary objective: ${concepts.goal}.`,
            `${concepts.role} specializing in ${concepts.skills}. Key focus: ${concepts.goal}.`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }
    /**
     * First-order mutation: Modify specific sections
     */
    async firstOrderMutation(prompt) {
        const sentences = prompt.split('. ');
        // Randomly modify 1-2 sentences
        const numMutations = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < numMutations; i++) {
            const idx = Math.floor(Math.random() * sentences.length);
            sentences[idx] = this.mutateSentence(sentences[idx]);
        }
        return sentences.join('. ');
    }
    /**
     * Lineage mutation: Combine with historical prompts
     */
    async lineageMutation(prompt) {
        // Get historical prompts from previous generations
        if (this.generations.length === 0)
            return prompt;
        const prevGen = this.generations[this.generations.length - 1];
        const historical = prevGen.population[Math.floor(Math.random() * prevGen.population.length)];
        // Blend current and historical
        return this.blendPrompts(prompt, historical.prompt);
    }
    /**
     * Hypermutation: Multiple random mutations
     */
    async hypermutation(prompt) {
        let mutated = prompt;
        const numMutations = Math.floor(Math.random() * 3) + 2; // 2-4 mutations
        for (let i = 0; i < numMutations; i++) {
            mutated = await this.firstOrderMutation(mutated);
        }
        return mutated;
    }
    /**
     * Lamarckian mutation: Guided improvement based on feedback
     */
    async lamarckianMutation(prompt) {
        // Analyze prompt weaknesses and improve them
        const improvements = [
            'more specific',
            'clearer instructions',
            'better examples',
            'stronger constraints',
        ];
        const improvement = improvements[Math.floor(Math.random() * improvements.length)];
        // Add improvement directive
        return `${prompt}\n\nNote: Focus on being ${improvement}.`;
    }
    /**
     * Crossover: Combine two parent prompts
     */
    async crossover(parent1, parent2, strategy) {
        const mutations = [`crossover_${strategy}`];
        switch (strategy) {
            case 'uniform':
                return {
                    prompt: this.uniformCrossover(parent1.prompt, parent2.prompt),
                    mutations,
                };
            case 'single_point':
                return {
                    prompt: this.singlePointCrossover(parent1.prompt, parent2.prompt),
                    mutations,
                };
            case 'multi_point':
                return {
                    prompt: this.multiPointCrossover(parent1.prompt, parent2.prompt),
                    mutations,
                };
            case 'semantic':
                return {
                    prompt: this.semanticCrossover(parent1.prompt, parent2.prompt),
                    mutations,
                };
            default:
                return { prompt: parent1.prompt, mutations };
        }
    }
    /**
     * Uniform crossover: Random selection from both parents
     */
    uniformCrossover(prompt1, prompt2) {
        const sentences1 = prompt1.split('. ');
        const sentences2 = prompt2.split('. ');
        const result = [];
        const maxLen = Math.max(sentences1.length, sentences2.length);
        for (let i = 0; i < maxLen; i++) {
            if (Math.random() < 0.5 && i < sentences1.length) {
                result.push(sentences1[i]);
            }
            else if (i < sentences2.length) {
                result.push(sentences2[i]);
            }
        }
        return result.join('. ');
    }
    /**
     * Single-point crossover
     */
    singlePointCrossover(prompt1, prompt2) {
        const sentences1 = prompt1.split('. ');
        const sentences2 = prompt2.split('. ');
        const point = Math.floor(Math.random() * Math.min(sentences1.length, sentences2.length));
        const result = [...sentences1.slice(0, point), ...sentences2.slice(point)];
        return result.join('. ');
    }
    /**
     * Multi-point crossover
     */
    multiPointCrossover(prompt1, prompt2) {
        const sentences1 = prompt1.split('. ');
        const sentences2 = prompt2.split('. ');
        const result = [];
        let useFirst = true;
        for (let i = 0; i < Math.max(sentences1.length, sentences2.length); i++) {
            if (Math.random() < 0.3)
                useFirst = !useFirst; // Switch sources
            if (useFirst && i < sentences1.length) {
                result.push(sentences1[i]);
            }
            else if (!useFirst && i < sentences2.length) {
                result.push(sentences2[i]);
            }
        }
        return result.join('. ');
    }
    /**
     * Semantic crossover: Combine based on meaning
     */
    semanticCrossover(prompt1, prompt2) {
        // Extract key components from both
        const concepts1 = this.extractConcepts(prompt1);
        const concepts2 = this.extractConcepts(prompt2);
        // Combine best aspects
        return `You are a ${concepts1.role || concepts2.role} specializing in ${concepts1.skills || concepts2.skills}. ${concepts2.goal || concepts1.goal}`;
    }
    // ============================================================================
    // Selection
    // ============================================================================
    /**
     * Tournament selection
     */
    tournamentSelect(tournamentSize = 3) {
        const tournament = [];
        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * this.population.length);
            tournament.push(this.population[idx]);
        }
        return tournament.reduce((best, current) => (current.fitness > best.fitness ? current : best));
    }
    /**
     * Select mutation strategy based on generation
     */
    selectMutationStrategy() {
        // Early generations: more exploration (zero_order, hypermutation)
        // Later generations: more exploitation (first_order, lamarckian)
        const explorationRate = 1 - this.currentGeneration / this.config.generations;
        // Give higher probability to semantic_rewrite if available
        if (Math.random() < 0.4) {
            return 'semantic_rewrite';
        }
        if (Math.random() < explorationRate) {
            return Math.random() < 0.5 ? 'zero_order' : 'hypermutation';
        }
        else {
            return Math.random() < 0.5 ? 'first_order' : 'lamarckian';
        }
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Extract key concepts from prompt
     */
    extractConcepts(prompt) {
        // Simple extraction (in production, use NLP)
        const roleMatch = prompt.match(/(?:You are|As an?)\s+([^.,]+)/i);
        const skillsMatch = prompt.match(/(?:expert|specializing|skilled)\s+(?:in|at)\s+([^.,]+)/i);
        const goalMatch = prompt.match(/(?:focus|objective|goal)[:\s]+([^.,]+)/i);
        return {
            role: roleMatch?.[1]?.trim() || 'expert',
            skills: skillsMatch?.[1]?.trim() || 'analysis',
            goal: goalMatch?.[1]?.trim() || 'providing insights',
        };
    }
    /**
     * Mutate a single sentence
     */
    mutateSentence(sentence) {
        const mutations = [
            // Add emphasis
            (s) => s.replace(/\b(\w+)\b/, '$1 specifically'),
            // Add detail
            (s) => `${s}, paying close attention to detail`,
            // Strengthen
            (s) => s.replace(/\bcan\b/g, 'must').replace(/\bmay\b/g, 'should'),
            // Clarify
            (s) => `${s}, ensuring clarity and precision`,
        ];
        const mutation = mutations[Math.floor(Math.random() * mutations.length)];
        return mutation(sentence);
    }
    /**
     * Blend two prompts
     */
    blendPrompts(prompt1, prompt2) {
        const sentences1 = prompt1.split('. ');
        const sentences2 = prompt2.split('. ');
        // Take beginning from prompt1, end from prompt2
        const midpoint = Math.floor(sentences1.length / 2);
        return [...sentences1.slice(0, midpoint), ...sentences2.slice(sentences2.length - midpoint)].join('. ');
    }
    /**
     * Capture current generation snapshot
     */
    captureGeneration() {
        const fitnesses = this.population.map((p) => p.fitness);
        const bestFitness = Math.max(...fitnesses);
        const avgFitness = fitnesses.reduce((sum, f) => sum + f, 0) / fitnesses.length;
        // Calculate diversity (variance in fitness)
        const variance = fitnesses.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) / fitnesses.length;
        const diversity = Math.sqrt(variance);
        return {
            number: this.currentGeneration,
            population: this.population.map((p) => ({ ...p })),
            bestFitness,
            avgFitness,
            diversity,
            timestamp: new Date(),
        };
    }
    /**
     * Store best prompt in Supabase
     */
    async storeBestPrompt(best, expertType, signature) {
        const version = `v${this.currentGeneration}.0.0`;
        // 1. Store in Supabase (Federated)
        try {
            if (this.useSupabase) {
                await storeExpertSignature(expertType, version, best.prompt, signature, {
                    performanceMetrics: {
                        fitness: best.fitness,
                        generation: best.generation,
                        mutations: best.mutations,
                    },
                    metadata: {
                        ...best.metadata,
                        evolutionId: this.generateId(),
                        parentIds: best.parentIds,
                    },
                    setActive: true,
                });
                // Record upgrade if there was a previous version
                const previousHistory = await getSignatureHistory(expertType);
                if (previousHistory.length > 1) {
                    const previous = previousHistory[1]; // Second is previous (first is current)
                    await recordSignatureUpgrade(expertType, previous.version, version, `PromptBreeder evolution: ${best.mutations.join(', ')}`, {
                        fitnessImprovement: best.fitness - (previous.performance_metrics?.fitness || 0),
                        generationsEvolved: best.generation,
                    });
                }
            }
        }
        catch (error) {
            console.warn('Failed to store best prompt in Supabase:', error);
        }
        // 2. Store in AgentDB (Local)
        try {
            if (this.agentDB) {
                // Generate dummy embedding (placeholder for now)
                // In a real scenario, we would call an embedding service here
                const dummyEmbedding = Array(1536).fill(0).map(() => Math.random());
                await this.agentDB.storeExpertEmbedding({
                    expertId: expertType, // Use expertType as ID for local lookup
                    name: expertType,
                    signature: JSON.stringify(signature),
                    embedding: dummyEmbedding,
                    performance: best.fitness,
                    metadata: {
                        version,
                        prompt: best.prompt,
                        generation: best.generation,
                        mutations: best.mutations,
                        created: new Date(),
                        source: 'prompt-breeder'
                    }
                });
                console.log(`✅ Stored best prompt locally in AgentDB: ${expertType} (${version})`);
            }
        }
        catch (error) {
            console.warn('Failed to store best prompt in AgentDB:', error);
        }
    }
    /**
     * Default fitness function (simple placeholder)
     */
    async defaultFitnessFunction(prompt, _expertType, projects) {
        // Placeholder fitness based on prompt characteristics
        const length = prompt.length;
        const sentences = prompt.split('. ').length;
        const hasRole = /(?:You are|As an?)/.test(prompt);
        const hasGoal = /(?:focus|objective|goal)/.test(prompt);
        // Simple heuristic scoring
        let score = 0.5;
        if (length > 100 && length < 500)
            score += 0.1;
        if (sentences >= 3 && sentences <= 8)
            score += 0.1;
        if (hasRole)
            score += 0.15;
        if (hasGoal)
            score += 0.15;
        const byProject = new Map();
        for (const project of projects) {
            // Add some variation per project
            byProject.set(project, score + (Math.random() - 0.5) * 0.1);
        }
        return {
            overall: score,
            byProject,
            metrics: {
                accuracy: score,
                consistency: 0.8,
                latency: 100,
            },
            timestamp: new Date(),
        };
    }
    /**
     * Evaluate multiple prompts in a single batch using Claude
     */
    async evaluateBatchWithLLM(prompts, expertType, _projects) {
        console.log(`[Batch Eval] Sending ${prompts.size} prompts to Claude...`);
        // 1. Construct Batch Payload
        const candidates = Array.from(prompts.entries()).map(([id, prompt]) => ({
            id,
            text: prompt
        }));
        const result = await this.evalProvider.predict({
            instructions: 'You are an AI Expert Evaluator. Grade the following list of candidate prompts.',
            input: {
                expert_role: 'The intended role',
                candidates: 'List of prompts to evaluate'
            },
            output: {
                scores: 'Map of ID to score (0.0-1.0)'
            }
        }, {
            expert_role: expertType,
            candidates: JSON.stringify(candidates, null, 2)
        }, 'For each candidate, provide a score (0.0-1.0) based on clarity, specificity, and authority. Return a JSON object with a "scores" key mapping IDs to numbers.', 0.0);
        // 2. Parse Results
        const scoreMap = new Map();
        if (result && result.scores) {
            for (const [id, score] of Object.entries(result.scores)) {
                scoreMap.set(id, typeof score === 'number' ? score : 0.5);
            }
        }
        console.log(`[Batch Eval] Received ${scoreMap.size} scores.`);
        return scoreMap;
    }
    /**
     * Generate unique ID
     */
    generateId() {
        return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
    // ============================================================================
    // Rollback Support
    // ============================================================================
    /**
     * Rollback to specific generation
     */
    rollbackToGeneration(generationNumber) {
        const generation = this.generations.find((g) => g.number === generationNumber);
        if (!generation) {
            console.error(`Generation ${generationNumber} not found`);
            return false;
        }
        this.population = generation.population.map((p) => ({ ...p }));
        this.currentGeneration = generationNumber;
        console.log(`✅ Rolled back to generation ${generationNumber}`);
        console.log(`   Best Fitness: ${generation.bestFitness.toFixed(4)}`);
        return true;
    }
    /**
     * Get evolution lineage for a prompt
     */
    getLineage(promptId) {
        const lineage = [];
        const visited = new Set();
        const trace = (id) => {
            if (visited.has(id))
                return;
            visited.add(id);
            // Find in all generations
            for (const gen of this.generations) {
                const individual = gen.population.find((p) => p.id === id);
                if (individual) {
                    lineage.push(individual);
                    individual.parentIds.forEach(trace);
                    break;
                }
            }
        };
        trace(promptId);
        return lineage.reverse(); // Oldest to newest
    }
    // ============================================================================
    // Analysis & Reporting
    // ============================================================================
    /**
     * Get evolution statistics
     */
    getStatistics() {
        if (this.generations.length === 0) {
            return {
                totalGenerations: 0,
                bestFitness: 0,
                improvementRate: 0,
                averageDiversity: 0,
                convergenceRate: 0,
            };
        }
        const bestFitness = Math.max(...this.generations.map((g) => g.bestFitness));
        const avgDiversity = this.generations.reduce((sum, g) => sum + g.diversity, 0) / this.generations.length;
        // Calculate improvement rate
        let improvements = 0;
        for (let i = 1; i < this.generations.length; i++) {
            if (this.generations[i].bestFitness > this.generations[i - 1].bestFitness) {
                improvements++;
            }
        }
        const improvementRate = improvements / (this.generations.length - 1 || 1);
        // Calculate convergence rate (how fast diversity decreases)
        const firstDiversity = this.generations[0].diversity;
        const lastDiversity = this.generations[this.generations.length - 1].diversity;
        const convergenceRate = (firstDiversity - lastDiversity) / firstDiversity;
        return {
            totalGenerations: this.generations.length,
            bestFitness,
            improvementRate,
            averageDiversity: avgDiversity,
            convergenceRate,
        };
    }
    /**
     * Export evolution data
     */
    exportEvolution() {
        return {
            config: this.config,
            generations: this.generations,
            statistics: this.getStatistics(),
        };
    }
    /**
     * Close connections
     */
    close() {
        if (this.agentDB) {
            this.agentDB.close();
        }
    }
}
/**
 * Create PromptBreeder engine
 */
export function createPromptBreeder(config) {
    return new PromptBreederEngine(config);
}
