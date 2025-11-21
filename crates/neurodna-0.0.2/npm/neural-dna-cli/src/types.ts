// Type definitions for neural-dna-cli

export interface TrainingConfig {
  populationSize: number;
  generations: number;
  eliteCount: number;
  mutationRate: number;
  topology: number[];
  activation: string;
  outputFile: string;
  dataFile?: string;
  parallel?: boolean;
}

export interface GeneratorConfig {
  topology: number[];
  activation: string;
  count: number;
  outputDir: string;
  random: boolean;
  mutationRate: number;
}

export interface ScoreConfig {
  dataFile?: string;
  metric: string;
  outputFile?: string;
}

export interface TrainingData {
  inputs: number[][];
  targets: number[][];
}

export interface TestData {
  inputs: number[][];
  targets: number[][];
}

export interface DNAData {
  topology: number[];
  activation: string;
  weights: number[];
  biases: number[];
  generation: number;
  mutation_rate: number;
  fitness_scores: number[];
}

export interface IndexFileData {
  generated_at: string;
  count: number;
  files: Array<{
    id: number;
    filename: string;
    path: string;
  }>;
}

export interface ScoreData {
  dna_file: string;
  score: number;
  metric: string;
  test_data_file: string;
  timestamp: string;
  details: {
    metric_type: string;
    fitness_score: number;
  };
}

export interface BatchScoreResult {
  file: string;
  score: number;
}

// WASM-related types
export interface WasmDNA {
  to_json(): string;
  from_json(json: string): WasmDNA;
  weights: number[];
  biases: number[];
  topology: number[];
  generation: number;
  mutation_rate: number;
  set_mutation_rate(rate: number): void;
  validate(): void;
  add_fitness_score(score: number): void;
  average_fitness(): number;
  mutate(mutation_type: string): void;
  mutate_with_policy(policy_json: string, mutation_type: string): void;
}

export interface WasmEvolutionEngine {
  evolve_generation(): void;
  generation: number;
  get_best_dna(): WasmDNA | null;
  get_statistics(): any;
  best_fitness_history: number[];
  diversity_history: number[];
}

export interface WasmModule {
  WasmNeuralDNA?: {
    new(topology: number[], activation: string): WasmDNA;
    random(topology: number[], activation: string): WasmDNA;
  };
  WasmEvolutionEngine?: {
    new(populationSize: number, eliteCount: number, topology: number[], activation: string): WasmEvolutionEngine;
  };
  crossover_dna?(parent1: WasmDNA, parent2: WasmDNA): WasmDNA;
  get_default_mutation_policy?(): string;
  get_aggressive_mutation_policy?(): string;
  get_conservative_mutation_policy?(): string;
  PerformanceTimer?: {
    new(): { elapsed(): number };
  };
}

export interface JsDNA {
  topology: number[];
  activation: string;
  weights: number[];
  biases: number[];
  generation: number;
  mutation_rate: number;
  fitness_scores: number[];
  toJson(): string;
  addFitnessScore(score: number): void;
  averageFitness(): number;
  mutate(mutationRate?: number): void;
}

export interface JsEvolutionEngine {
  populationSize: number;
  eliteCount: number;
  topology: number[];
  activation: string;
  generation: number;
  population: JsDNA[];
  bestFitnessHistory: number[];
  diversityHistory: number[];
  evolveGeneration(): void;
  getBestIndividual(): JsDNA | null;
  getStatistics(): any;
}

export type NeuralDNA = WasmDNA | JsDNA;
export type EvolutionEngine = WasmEvolutionEngine | JsEvolutionEngine;