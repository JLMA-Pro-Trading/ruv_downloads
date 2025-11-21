import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import { WasmModule } from './wasm-loader';
import { TrainingConfig, TrainingData } from './types';

// Interfaces moved to types.ts

export class TrainingEngine {
  constructor(private wasmModule: WasmModule) {}

  async train(config: TrainingConfig): Promise<void> {
    console.log(chalk.blue('🔬 Initializing training environment...'));
    
    // Load training data if provided
    let trainingData: TrainingData | null = null;
    if (config.dataFile) {
      trainingData = await this.loadTrainingData(config.dataFile);
      console.log(chalk.gray(`Loaded ${trainingData.inputs.length} training samples`));
    } else {
      // Use default XOR data for demonstration
      trainingData = {
        inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
        targets: [[0], [1], [1], [0]]
      };
      console.log(chalk.yellow('Using default XOR training data'));
    }

    // Create evolution engine
    const engine = this.wasmModule.createEvolutionEngine(
      config.populationSize,
      config.eliteCount,
      config.topology,
      config.activation
    );

    console.log(chalk.green('🧬 Starting evolution process...'));
    
    const startTime = Date.now();
    let bestFitness = -Infinity;
    let generationsWithoutImprovement = 0;
    const maxGenerationsWithoutImprovement = 10;

    // Training loop
    for (let generation = 0; generation < config.generations; generation++) {
      const spinner = ora(`Generation ${generation + 1}/${config.generations}`).start();
      
      try {
        // Evaluate fitness for all individuals
        await this.evaluatePopulation(engine, trainingData);
        
        // Evolve to next generation
        if (this.wasmModule.isWasmAvailable()) {
          engine.evolve_generation();
        } else {
          engine.evolveGeneration();
        }
        
        // Get statistics
        const stats = this.wasmModule.isWasmAvailable() 
          ? engine.get_statistics() 
          : engine.getStatistics();
        
        const currentBest = stats.best_fitness || stats.bestFitness;
        
        if (currentBest > bestFitness) {
          bestFitness = currentBest;
          generationsWithoutImprovement = 0;
          spinner.succeed(chalk.green(`Gen ${generation + 1}: Best fitness = ${currentBest.toFixed(6)} ⬆️`));
        } else {
          generationsWithoutImprovement++;
          spinner.succeed(chalk.gray(`Gen ${generation + 1}: Best fitness = ${currentBest.toFixed(6)}`));
        }
        
        // Log additional statistics every 10 generations
        if ((generation + 1) % 10 === 0) {
          console.log(chalk.cyan(`  📊 Average: ${(stats.average_fitness || stats.averageFitness).toFixed(6)}, Worst: ${(stats.worst_fitness || stats.worstFitness).toFixed(6)}`));
        }
        
        // Early stopping if no improvement
        if (generationsWithoutImprovement >= maxGenerationsWithoutImprovement) {
          console.log(chalk.yellow(`Early stopping after ${maxGenerationsWithoutImprovement} generations without improvement`));
          break;
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        spinner.fail(`Generation ${generation + 1} failed: ${errorMessage}`);
        throw error;
      }
    }

    const endTime = Date.now();
    const trainingTime = (endTime - startTime) / 1000;
    
    console.log(chalk.green(`🎉 Training completed in ${trainingTime.toFixed(2)} seconds`));
    
    // Save best DNA
    await this.saveBestDNA(engine, config.outputFile);
    
    // Display final statistics
    this.displayFinalStats(engine, trainingTime);
  }

  private async loadTrainingData(dataFile: string): Promise<TrainingData> {
    if (!await fs.pathExists(dataFile)) {
      throw new Error(`Training data file not found: ${dataFile}`);
    }
    
    const data = await fs.readJson(dataFile);
    
    if (!data.inputs || !data.targets) {
      throw new Error('Training data must contain "inputs" and "targets" arrays');
    }
    
    if (data.inputs.length !== data.targets.length) {
      throw new Error('Number of inputs must match number of targets');
    }
    
    return data;
  }

  private async evaluatePopulation(engine: any, trainingData: TrainingData): Promise<void> {
    // This is a simplified evaluation - in a real implementation,
    // you would forward propagate through each network and calculate fitness
    
    if (this.wasmModule.isWasmAvailable()) {
      // For WASM version, the engine handles evaluation internally
      // This is just a placeholder call
      return;
    } else {
      // For JS fallback, manually evaluate each individual
      for (const individual of engine.population) {
        const fitness = this.calculateFitness(individual, trainingData);
        individual.addFitnessScore(fitness);
      }
    }
  }

  private calculateFitness(dna: any, trainingData: TrainingData): number {
    // Simplified fitness calculation
    // In practice, you would implement proper forward propagation
    let totalError = 0;
    
    for (let i = 0; i < trainingData.inputs.length; i++) {
      const predicted = this.forwardPass(dna, trainingData.inputs[i]);
      const target = trainingData.targets[i];
      
      for (let j = 0; j < target.length; j++) {
        const error = Math.abs(predicted[j] - target[j]);
        totalError += error * error;
      }
    }
    
    // Convert error to fitness (lower error = higher fitness)
    const mse = totalError / (trainingData.inputs.length * trainingData.targets[0].length);
    return 1.0 / (1.0 + mse);
  }

  private forwardPass(dna: any, input: number[]): number[] {
    // Simplified forward pass implementation
    // This is a basic example - in practice you'd implement proper neural network forward propagation
    let activations = [...input];
    
    let weightIndex = 0;
    let biasIndex = 0;
    
    for (let layer = 1; layer < dna.topology.length; layer++) {
      const newActivations: number[] = [];
      
      for (let neuron = 0; neuron < dna.topology[layer]; neuron++) {
        let sum = dna.biases[biasIndex++];
        
        for (let prevNeuron = 0; prevNeuron < activations.length; prevNeuron++) {
          sum += activations[prevNeuron] * dna.weights[weightIndex++];
        }
        
        // Apply activation function (simplified sigmoid)
        newActivations.push(1 / (1 + Math.exp(-sum)));
      }
      
      activations = newActivations;
    }
    
    return activations;
  }

  private async saveBestDNA(engine: any, outputFile: string): Promise<void> {
    const spinner = ora('Saving best DNA...').start();
    
    try {
      const bestIndividual = this.wasmModule.isWasmAvailable() 
        ? engine.get_best_dna() 
        : engine.getBestIndividual();
      
      if (!bestIndividual) {
        spinner.fail('No best individual found');
        return;
      }
      
      const dnaJson = this.wasmModule.isWasmAvailable() 
        ? bestIndividual.to_json() 
        : bestIndividual.toJson();
      
      await fs.ensureDir(require('path').dirname(outputFile));
      await fs.writeFile(outputFile, dnaJson);
      
      spinner.succeed(`Best DNA saved to ${outputFile}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Failed to save DNA: ${errorMessage}`);
      throw error;
    }
  }

  private displayFinalStats(engine: any, trainingTime: number): void {
    console.log(chalk.blue('\n📈 Final Training Statistics:'));
    
    const stats = this.wasmModule.isWasmAvailable() 
      ? engine.get_statistics() 
      : engine.getStatistics();
    
    console.log(chalk.white(`  Generation: ${stats.generation || engine.generation}`));
    console.log(chalk.white(`  Best Fitness: ${(stats.best_fitness || stats.bestFitness).toFixed(6)}`));
    console.log(chalk.white(`  Average Fitness: ${(stats.average_fitness || stats.averageFitness).toFixed(6)}`));
    console.log(chalk.white(`  Training Time: ${trainingTime.toFixed(2)}s`));
    
    if (this.wasmModule.isWasmAvailable()) {
      console.log(chalk.green('  🚀 WASM acceleration: ENABLED'));
    } else {
      console.log(chalk.yellow('  ⚠️  WASM acceleration: DISABLED (using JavaScript fallback)'));
    }
    
    const fitnessHistory = this.wasmModule.isWasmAvailable() 
      ? engine.best_fitness_history 
      : engine.bestFitnessHistory;
    
    if (fitnessHistory && fitnessHistory.length > 1) {
      const improvement = fitnessHistory[fitnessHistory.length - 1] - fitnessHistory[0];
      console.log(chalk.white(`  Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(6)}`));
    }
    
    console.log('');
  }
}