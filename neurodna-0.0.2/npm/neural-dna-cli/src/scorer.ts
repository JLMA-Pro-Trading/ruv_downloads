import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import { WasmModule } from './wasm-loader';
import { ScoreConfig, TestData, BatchScoreResult, ScoreData } from './types';

// Interfaces moved to types.ts

export class ScoreCalculator {
  constructor(private wasmModule: WasmModule) {}

  async calculateScore(dnaFile: string, config: ScoreConfig): Promise<number> {
    const spinner = ora('Loading DNA and test data...').start();
    
    try {
      // Load DNA
      if (!await fs.pathExists(dnaFile)) {
        throw new Error(`DNA file not found: ${dnaFile}`);
      }
      
      const dnaData = await fs.readJson(dnaFile);
      const dna = this.wasmModule.isWasmAvailable() 
        ? this.wasmModule.createNeuralDNA(dnaData.topology, dnaData.activation)
        : dnaData;
      
      spinner.text = 'Loading test data...';
      
      // Load test data
      let testData: TestData;
      if (config.dataFile) {
        if (!await fs.pathExists(config.dataFile)) {
          throw new Error(`Test data file not found: ${config.dataFile}`);
        }
        testData = await fs.readJson(config.dataFile);
      } else {
        // Use default XOR test data
        testData = {
          inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
          targets: [[0], [1], [1], [0]]
        };
        spinner.text = 'Using default XOR test data...';
      }
      
      spinner.text = 'Calculating fitness score...';
      
      // Calculate score based on metric
      const score = this.calculateMetric(dna, testData, config.metric);
      
      spinner.succeed(`Fitness score calculated: ${score.toFixed(6)}`);
      
      // Save score if output file specified
      if (config.outputFile) {
        await this.saveScore(score, config.outputFile, dnaFile, config);
      }
      
      return score;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Scoring failed: ${errorMessage}`);
      throw error;
    }
  }

  private calculateMetric(dna: any, testData: TestData, metric: string): number {
    switch (metric.toLowerCase()) {
      case 'mse':
      case 'mean_squared_error':
        return this.calculateMSE(dna, testData);
      case 'mae':
      case 'mean_absolute_error':
        return this.calculateMAE(dna, testData);
      case 'accuracy':
        return this.calculateAccuracy(dna, testData);
      case 'r2':
      case 'r_squared':
        return this.calculateR2(dna, testData);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private calculateMSE(dna: any, testData: TestData): number {
    let totalError = 0;
    let totalSamples = 0;
    
    for (let i = 0; i < testData.inputs.length; i++) {
      const predicted = this.forwardPass(dna, testData.inputs[i]);
      const target = testData.targets[i];
      
      for (let j = 0; j < target.length; j++) {
        const error = predicted[j] - target[j];
        totalError += error * error;
        totalSamples++;
      }
    }
    
    const mse = totalError / totalSamples;
    // Convert to fitness (lower MSE = higher fitness)
    return 1.0 / (1.0 + mse);
  }

  private calculateMAE(dna: any, testData: TestData): number {
    let totalError = 0;
    let totalSamples = 0;
    
    for (let i = 0; i < testData.inputs.length; i++) {
      const predicted = this.forwardPass(dna, testData.inputs[i]);
      const target = testData.targets[i];
      
      for (let j = 0; j < target.length; j++) {
        totalError += Math.abs(predicted[j] - target[j]);
        totalSamples++;
      }
    }
    
    const mae = totalError / totalSamples;
    // Convert to fitness (lower MAE = higher fitness)
    return 1.0 / (1.0 + mae);
  }

  private calculateAccuracy(dna: any, testData: TestData): number {
    let correct = 0;
    
    for (let i = 0; i < testData.inputs.length; i++) {
      const predicted = this.forwardPass(dna, testData.inputs[i]);
      const target = testData.targets[i];
      
      // For classification, check if prediction is close to target
      let sampleCorrect = true;
      for (let j = 0; j < target.length; j++) {
        const predictedClass = predicted[j] > 0.5 ? 1 : 0;
        const targetClass = target[j] > 0.5 ? 1 : 0;
        if (predictedClass !== targetClass) {
          sampleCorrect = false;
          break;
        }
      }
      
      if (sampleCorrect) correct++;
    }
    
    return correct / testData.inputs.length;
  }

  private calculateR2(dna: any, testData: TestData): number {
    // Calculate R-squared coefficient
    let ssRes = 0; // Sum of squares of residuals
    let ssTot = 0; // Total sum of squares
    
    // Calculate mean of targets
    let targetSum = 0;
    let targetCount = 0;
    for (const target of testData.targets) {
      for (const value of target) {
        targetSum += value;
        targetCount++;
      }
    }
    const targetMean = targetSum / targetCount;
    
    // Calculate sums
    for (let i = 0; i < testData.inputs.length; i++) {
      const predicted = this.forwardPass(dna, testData.inputs[i]);
      const target = testData.targets[i];
      
      for (let j = 0; j < target.length; j++) {
        const residual = target[j] - predicted[j];
        ssRes += residual * residual;
        
        const deviation = target[j] - targetMean;
        ssTot += deviation * deviation;
      }
    }
    
    return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  private forwardPass(dna: any, input: number[]): number[] {
    // Simplified forward pass implementation
    // This matches the implementation in training.ts
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
        
        // Apply activation function based on DNA activation type
        newActivations.push(this.applyActivation(sum, dna.activation));
      }
      
      activations = newActivations;
    }
    
    return activations;
  }

  private applyActivation(value: number, activationType: string): number {
    switch (activationType.toLowerCase()) {
      case 'sigmoid':
        return 1 / (1 + Math.exp(-value));
      case 'tanh':
        return Math.tanh(value);
      case 'relu':
        return Math.max(0, value);
      case 'leaky_relu':
        return value > 0 ? value : 0.01 * value;
      case 'linear':
      case 'identity':
        return value;
      default:
        // Default to sigmoid
        return 1 / (1 + Math.exp(-value));
    }
  }

  private async saveScore(score: number, outputFile: string, dnaFile: string, config: ScoreConfig): Promise<void> {
    const scoreData = {
      dna_file: dnaFile,
      score: score,
      metric: config.metric,
      test_data_file: config.dataFile || 'default_xor',
      timestamp: new Date().toISOString(),
      details: {
        metric_type: config.metric,
        fitness_score: score
      }
    };
    
    await fs.ensureDir(require('path').dirname(outputFile));
    await fs.writeJson(outputFile, scoreData, { spaces: 2 });
    
    console.log(chalk.gray(`Score saved to ${outputFile}`));
  }

  async batchScore(dnaFiles: string[], config: ScoreConfig): Promise<{ file: string; score: number }[]> {
    console.log(chalk.blue(`📊 Starting batch scoring of ${dnaFiles.length} DNA files...`));
    
    const results: { file: string; score: number }[] = [];
    
    for (let i = 0; i < dnaFiles.length; i++) {
      const dnaFile = dnaFiles[i];
      console.log(chalk.cyan(`\nScoring ${i + 1}/${dnaFiles.length}: ${dnaFile}`));
      
      try {
        const score = await this.calculateScore(dnaFile, config);
        results.push({ file: dnaFile, score });
        console.log(chalk.green(`  Score: ${score.toFixed(6)}`));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`  Error: ${errorMessage}`));
        results.push({ file: dnaFile, score: -1 });
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    console.log(chalk.green(`\n🎉 Batch scoring completed`));
    console.log(chalk.blue('Top 5 performers:'));
    
    for (let i = 0; i < Math.min(5, results.length); i++) {
      const result = results[i];
      if (result.score >= 0) {
        console.log(chalk.white(`  ${i + 1}. ${result.file}: ${result.score.toFixed(6)}`));
      }
    }
    
    return results;
  }

  async compareScores(dnaFiles: string[], config: ScoreConfig): Promise<void> {
    const results = await this.batchScore(dnaFiles, config);
    
    // Generate comparison report
    console.log(chalk.blue('\n📈 Score Comparison Report:'));
    
    const validResults = results.filter(r => r.score >= 0);
    if (validResults.length === 0) {
      console.log(chalk.red('No valid scores calculated'));
      return;
    }
    
    const scores = validResults.map(r => r.score);
    const best = Math.max(...scores);
    const worst = Math.min(...scores);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    console.log(chalk.white(`  Best Score: ${best.toFixed(6)}`));
    console.log(chalk.white(`  Worst Score: ${worst.toFixed(6)}`));
    console.log(chalk.white(`  Average Score: ${average.toFixed(6)}`));
    console.log(chalk.white(`  Score Range: ${(best - worst).toFixed(6)}`));
    console.log(chalk.white(`  Valid Samples: ${validResults.length}/${results.length}`));
  }
}