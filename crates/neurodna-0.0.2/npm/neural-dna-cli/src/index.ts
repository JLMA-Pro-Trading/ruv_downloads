#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import { WasmModule } from './wasm-loader';
import { TrainingEngine } from './training';
import { DNAGenerator } from './generator';
import { ScoreCalculator } from './scorer';

const program = new Command();

program
  .name('neural-dna')
  .description('Neural DNA CLI - Genetic algorithms for neural networks')
  .version('1.0.0');

// Initialize WASM module
let wasmModule: WasmModule | null = null;

async function initWasm(): Promise<WasmModule> {
  if (!wasmModule) {
    const spinner = ora('Loading WASM module...').start();
    try {
      wasmModule = new WasmModule();
      await wasmModule.init();
      spinner.succeed('WASM module loaded successfully');
    } catch (error) {
      spinner.fail('Failed to load WASM module');
      console.error(chalk.red(error));
      process.exit(1);
    }
  }
  return wasmModule;
}

// Train command
program
  .command('train')
  .description('Train neural DNA using genetic algorithms')
  .option('-p, --population <size>', 'Population size', '100')
  .option('-g, --generations <count>', 'Number of generations', '50')
  .option('-e, --elite <count>', 'Elite count', '10')
  .option('-m, --mutation-rate <rate>', 'Mutation rate', '0.1')
  .option('-t, --topology <topology>', 'Network topology (comma-separated)', '2,4,1')
  .option('-a, --activation <function>', 'Activation function', 'sigmoid')
  .option('-o, --output <file>', 'Output file for best DNA', 'best_dna.json')
  .option('--data <file>', 'Training data file (JSON)')
  .option('--parallel', 'Use parallel processing')
  .action(async (options) => {
    const wasm = await initWasm();
    const engine = new TrainingEngine(wasm);
    
    const topology = options.topology.split(',').map(Number);
    const config = {
      populationSize: parseInt(options.population),
      generations: parseInt(options.generations),
      eliteCount: parseInt(options.elite),
      mutationRate: parseFloat(options.mutationRate),
      topology,
      activation: options.activation,
      outputFile: options.output,
      dataFile: options.data,
      parallel: options.parallel
    };
    
    console.log(chalk.blue('🧬 Starting Neural DNA training...'));
    console.log(chalk.gray(`Population: ${config.populationSize}, Generations: ${config.generations}`));
    console.log(chalk.gray(`Topology: [${topology.join(', ')}], Activation: ${config.activation}`));
    
    await engine.train(config);
  });

// Spawn command
program
  .command('spawn')
  .description('Generate new neural DNA')
  .option('-t, --topology <topology>', 'Network topology (comma-separated)', '2,4,1')
  .option('-a, --activation <function>', 'Activation function', 'sigmoid')
  .option('-c, --count <number>', 'Number of DNA to generate', '1')
  .option('-o, --output <directory>', 'Output directory', './dna')
  .option('-r, --random', 'Generate random DNA')
  .option('--mutation-rate <rate>', 'Mutation rate', '0.1')
  .action(async (options) => {
    const wasm = await initWasm();
    const generator = new DNAGenerator(wasm);
    
    const topology = options.topology.split(',').map(Number);
    const config = {
      topology,
      activation: options.activation,
      count: parseInt(options.count),
      outputDir: options.output,
      random: options.random,
      mutationRate: parseFloat(options.mutationRate)
    };
    
    console.log(chalk.green('🧬 Generating Neural DNA...'));
    console.log(chalk.gray(`Count: ${config.count}, Topology: [${topology.join(', ')}]`));
    
    await generator.generate(config);
  });

// Score command
program
  .command('score')
  .description('Calculate fitness score for neural DNA')
  .argument('<dna-file>', 'DNA file to score')
  .option('--data <file>', 'Test data file (JSON)')
  .option('--metric <metric>', 'Scoring metric', 'mse')
  .option('-o, --output <file>', 'Output score file')
  .action(async (dnaFile, options) => {
    const wasm = await initWasm();
    const scorer = new ScoreCalculator(wasm);
    
    console.log(chalk.yellow('📊 Calculating fitness score...'));
    
    const score = await scorer.calculateScore(dnaFile, {
      dataFile: options.data,
      metric: options.metric,
      outputFile: options.output
    });
    
    console.log(chalk.green(`Fitness Score: ${score.toFixed(6)}`));
  });

// Evolve command
program
  .command('evolve')
  .description('Evolve existing DNA')
  .argument('<parent-files...>', 'Parent DNA files')
  .option('-g, --generations <count>', 'Number of generations', '10')
  .option('-m, --mutation-rate <rate>', 'Mutation rate', '0.1')
  .option('-o, --output <file>', 'Output file', 'evolved_dna.json')
  .option('--crossover-rate <rate>', 'Crossover rate', '0.7')
  .action(async (parentFiles, options) => {
    const wasm = await initWasm();
    
    console.log(chalk.magenta('🔬 Evolving Neural DNA...'));
    console.log(chalk.gray(`Parents: ${parentFiles.length}, Generations: ${options.generations}`));
    
    // Implementation for evolution
    // This would use the WASM crossover and mutation functions
  });

// Analyze command
program
  .command('analyze')
  .description('Analyze neural DNA structure and performance')
  .argument('<dna-file>', 'DNA file to analyze')
  .option('--verbose', 'Verbose output')
  .option('--visualization', 'Generate visualization')
  .action(async (dnaFile, options) => {
    console.log(chalk.cyan('🔍 Analyzing Neural DNA...'));
    
    if (!await fs.pathExists(dnaFile)) {
      console.error(chalk.red(`Error: DNA file ${dnaFile} not found`));
      process.exit(1);
    }
    
    const dnaData = await fs.readJson(dnaFile);
    
    console.log(chalk.white('DNA Analysis:'));
    console.log(chalk.gray(`Topology: [${dnaData.topology?.join(', ') || 'Unknown'}]`));
    console.log(chalk.gray(`Weights: ${dnaData.weights?.length || 0}`));
    console.log(chalk.gray(`Biases: ${dnaData.biases?.length || 0}`));
    console.log(chalk.gray(`Generation: ${dnaData.generation || 'Unknown'}`));
    console.log(chalk.gray(`Mutation Rate: ${dnaData.mutation_rate || 'Unknown'}`));
    
    if (dnaData.fitness_scores && dnaData.fitness_scores.length > 0) {
      const avgFitness = dnaData.fitness_scores.reduce((a: number, b: number) => a + b, 0) / dnaData.fitness_scores.length;
      console.log(chalk.gray(`Average Fitness: ${avgFitness.toFixed(6)}`));
    }
  });

// Benchmark command
program
  .command('benchmark')
  .description('Run performance benchmarks')
  .option('-t, --topology <topology>', 'Network topology', '2,4,1')
  .option('-p, --population <size>', 'Population size', '100')
  .option('-g, --generations <count>', 'Generations to run', '10')
  .option('--wasm-only', 'Test WASM performance only')
  .action(async (options) => {
    const wasm = await initWasm();
    
    console.log(chalk.blue('⚡ Running Neural DNA benchmarks...'));
    
    const startTime = Date.now();
    // Benchmark implementation would go here
    const endTime = Date.now();
    
    console.log(chalk.green(`Benchmark completed in ${endTime - startTime}ms`));
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (err) {
  const errorMessage = err instanceof Error ? err.message : String(err);
  console.error(chalk.red('Error:'), errorMessage);
  process.exit(1);
}

export { program };