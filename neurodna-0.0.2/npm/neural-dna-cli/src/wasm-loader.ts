import * as fs from 'fs-extra';
import * as path from 'path';

export class WasmModule {
  private module: any = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Try to load the WASM module
      const wasmPath = path.join(__dirname, '../wasm/neural_dna.js');
      
      if (await fs.pathExists(wasmPath)) {
        // Load the generated WASM module
        const wasmModule = require(wasmPath);
        this.module = await wasmModule.default();
        this.initialized = true;
      } else {
        // Fallback to JavaScript implementation
        console.warn('WASM module not found, using JavaScript fallback');
        this.module = new JsFallbackModule();
        this.initialized = true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to load WASM module, using JavaScript fallback:', errorMessage);
      this.module = new JsFallbackModule();
      this.initialized = true;
    }
  }

  // DNA creation methods
  createNeuralDNA(topology: number[], activation: string): any {
    if (!this.initialized) {
      throw new Error('WASM module not initialized');
    }
    
    if (this.module.WasmNeuralDNA) {
      return new this.module.WasmNeuralDNA(topology, activation);
    } else {
      return this.module.createNeuralDNA(topology, activation);
    }
  }

  createRandomDNA(topology: number[], activation: string): any {
    if (!this.initialized) {
      throw new Error('WASM module not initialized');
    }
    
    if (this.module.WasmNeuralDNA) {
      return this.module.WasmNeuralDNA.random(topology, activation);
    } else {
      return this.module.createRandomDNA(topology, activation);
    }
  }

  // Evolution methods
  createEvolutionEngine(populationSize: number, eliteCount: number, topology: number[], activation: string): any {
    if (!this.initialized) {
      throw new Error('WASM module not initialized');
    }
    
    if (this.module.WasmEvolutionEngine) {
      return new this.module.WasmEvolutionEngine(populationSize, eliteCount, topology, activation);
    } else {
      return this.module.createEvolutionEngine(populationSize, eliteCount, topology, activation);
    }
  }

  // Crossover function
  crossover(parent1: any, parent2: any): any {
    if (!this.initialized) {
      throw new Error('WASM module not initialized');
    }
    
    if (this.module.crossover_dna) {
      return this.module.crossover_dna(parent1, parent2);
    } else {
      return this.module.crossover(parent1, parent2);
    }
  }

  // Utility methods
  getDefaultMutationPolicy(): any {
    if (this.module.get_default_mutation_policy) {
      return JSON.parse(this.module.get_default_mutation_policy());
    } else {
      return this.module.getDefaultMutationPolicy();
    }
  }

  createPerformanceTimer(): any {
    if (this.module.PerformanceTimer) {
      return new this.module.PerformanceTimer();
    } else {
      return this.module.createPerformanceTimer();
    }
  }

  isWasmAvailable(): boolean {
    return this.module.WasmNeuralDNA !== undefined;
  }
}

// JavaScript fallback implementation
class JsFallbackModule {
  createNeuralDNA(topology: number[], activation: string): any {
    return new JsNeuralDNA(topology, activation);
  }

  createRandomDNA(topology: number[], activation: string): any {
    const dna = new JsNeuralDNA(topology, activation);
    dna.randomize();
    return dna;
  }

  createEvolutionEngine(populationSize: number, eliteCount: number, topology: number[], activation: string): any {
    return new JsEvolutionEngine(populationSize, eliteCount, topology, activation);
  }

  crossover(parent1: any, parent2: any): any {
    return JsNeuralDNA.crossover(parent1, parent2);
  }

  getDefaultMutationPolicy(): any {
    return {
      weight_mutation_rate: 0.1,
      bias_mutation_rate: 0.1,
      weight_mutation_strength: 0.1,
      bias_mutation_strength: 0.1,
      topology_mutation_rate: 0.01,
      activation_mutation_rate: 0.01
    };
  }

  createPerformanceTimer(): any {
    return new JsPerformanceTimer();
  }
}

class JsNeuralDNA {
  public topology: number[];
  public activation: string;
  public weights: number[];
  public biases: number[];
  public generation: number;
  public mutation_rate: number;
  public fitness_scores: number[];

  constructor(topology: number[], activation: string) {
    this.topology = topology;
    this.activation = activation;
    this.weights = [];
    this.biases = [];
    this.generation = 0;
    this.mutation_rate = 0.1;
    this.fitness_scores = [];
    
    this.initializeStructure();
  }

  private initializeStructure(): void {
    // Initialize weights and biases based on topology
    for (let i = 0; i < this.topology.length - 1; i++) {
      const layerSize = this.topology[i] * this.topology[i + 1];
      for (let j = 0; j < layerSize; j++) {
        this.weights.push(0);
      }
      for (let j = 0; j < this.topology[i + 1]; j++) {
        this.biases.push(0);
      }
    }
  }

  randomize(): void {
    this.weights = this.weights.map(() => (Math.random() - 0.5) * 2);
    this.biases = this.biases.map(() => (Math.random() - 0.5) * 2);
  }

  toJson(): string {
    return JSON.stringify({
      topology: this.topology,
      activation: this.activation,
      weights: this.weights,
      biases: this.biases,
      generation: this.generation,
      mutation_rate: this.mutation_rate,
      fitness_scores: this.fitness_scores
    });
  }

  static fromJson(json: string): JsNeuralDNA {
    const data = JSON.parse(json);
    const dna = new JsNeuralDNA(data.topology, data.activation);
    dna.weights = data.weights;
    dna.biases = data.biases;
    dna.generation = data.generation || 0;
    dna.mutation_rate = data.mutation_rate || 0.1;
    dna.fitness_scores = data.fitness_scores || [];
    return dna;
  }

  static crossover(parent1: JsNeuralDNA, parent2: JsNeuralDNA): JsNeuralDNA {
    const child = new JsNeuralDNA(parent1.topology, parent1.activation);
    
    // Simple uniform crossover
    for (let i = 0; i < parent1.weights.length; i++) {
      child.weights[i] = Math.random() < 0.5 ? parent1.weights[i] : parent2.weights[i];
    }
    
    for (let i = 0; i < parent1.biases.length; i++) {
      child.biases[i] = Math.random() < 0.5 ? parent1.biases[i] : parent2.biases[i];
    }
    
    child.generation = Math.max(parent1.generation, parent2.generation) + 1;
    return child;
  }

  mutate(mutationRate: number = this.mutation_rate): void {
    // Mutate weights
    for (let i = 0; i < this.weights.length; i++) {
      if (Math.random() < mutationRate) {
        this.weights[i] += (Math.random() - 0.5) * 0.2;
      }
    }
    
    // Mutate biases
    for (let i = 0; i < this.biases.length; i++) {
      if (Math.random() < mutationRate) {
        this.biases[i] += (Math.random() - 0.5) * 0.2;
      }
    }
  }

  addFitnessScore(score: number): void {
    this.fitness_scores.push(score);
  }

  averageFitness(): number {
    if (this.fitness_scores.length === 0) return 0;
    return this.fitness_scores.reduce((a, b) => a + b, 0) / this.fitness_scores.length;
  }
}

class JsEvolutionEngine {
  public populationSize: number;
  public eliteCount: number;
  public topology: number[];
  public activation: string;
  public generation: number;
  public population: JsNeuralDNA[];
  public bestFitnessHistory: number[];
  public diversityHistory: number[];

  constructor(populationSize: number, eliteCount: number, topology: number[], activation: string) {
    this.populationSize = populationSize;
    this.eliteCount = eliteCount;
    this.topology = topology;
    this.activation = activation;
    this.generation = 0;
    this.population = [];
    this.bestFitnessHistory = [];
    this.diversityHistory = [];
    
    this.initializePopulation();
  }

  private initializePopulation(): void {
    for (let i = 0; i < this.populationSize; i++) {
      const dna = new JsNeuralDNA(this.topology, this.activation);
      dna.randomize();
      this.population.push(dna);
    }
  }

  evolveGeneration(): void {
    // Sort by fitness (assuming higher is better)
    this.population.sort((a, b) => b.averageFitness() - a.averageFitness());
    
    // Track best fitness
    if (this.population.length > 0) {
      this.bestFitnessHistory.push(this.population[0].averageFitness());
    }
    
    // Create new generation
    const newPopulation: JsNeuralDNA[] = [];
    
    // Keep elite
    for (let i = 0; i < this.eliteCount && i < this.population.length; i++) {
      newPopulation.push(this.population[i]);
    }
    
    // Generate offspring
    while (newPopulation.length < this.populationSize) {
      const parent1 = this.selectParent();
      const parent2 = this.selectParent();
      const child = JsNeuralDNA.crossover(parent1, parent2);
      child.mutate();
      newPopulation.push(child);
    }
    
    this.population = newPopulation;
    this.generation++;
  }

  private selectParent(): JsNeuralDNA {
    // Tournament selection
    const tournamentSize = 3;
    let best = this.population[Math.floor(Math.random() * this.population.length)];
    
    for (let i = 1; i < tournamentSize; i++) {
      const candidate = this.population[Math.floor(Math.random() * this.population.length)];
      if (candidate.averageFitness() > best.averageFitness()) {
        best = candidate;
      }
    }
    
    return best;
  }

  getBestIndividual(): JsNeuralDNA | null {
    if (this.population.length === 0) return null;
    return this.population.reduce((best, current) => 
      current.averageFitness() > best.averageFitness() ? current : best
    );
  }

  getStatistics(): any {
    const fitnesses = this.population.map(dna => dna.averageFitness());
    return {
      generation: this.generation,
      population_size: this.populationSize,
      best_fitness: Math.max(...fitnesses),
      average_fitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worst_fitness: Math.min(...fitnesses)
    };
  }
}

class JsPerformanceTimer {
  private start: number;

  constructor() {
    this.start = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.start;
  }
}