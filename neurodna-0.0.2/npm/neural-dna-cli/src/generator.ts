import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs-extra';
import * as path from 'path';
import { WasmModule } from './wasm-loader';
import { GeneratorConfig, IndexFileData } from './types';

// Interface moved to types.ts

export class DNAGenerator {
  constructor(private wasmModule: WasmModule) {}

  async generate(config: GeneratorConfig): Promise<void> {
    const spinner = ora('Generating Neural DNA...').start();
    
    try {
      // Ensure output directory exists
      await fs.ensureDir(config.outputDir);
      
      const generated: any[] = [];
      
      for (let i = 0; i < config.count; i++) {
        let dna;
        
        if (config.random) {
          dna = this.wasmModule.createRandomDNA(config.topology, config.activation);
        } else {
          dna = this.wasmModule.createNeuralDNA(config.topology, config.activation);
        }
        
        // Set mutation rate
        if (this.wasmModule.isWasmAvailable()) {
          dna.set_mutation_rate(config.mutationRate);
        } else {
          dna.mutation_rate = config.mutationRate;
        }
        
        generated.push(dna);
        
        // Save individual DNA file
        const filename = `dna_${i.toString().padStart(3, '0')}.json`;
        const filepath = path.join(config.outputDir, filename);
        
        const dnaJson = this.wasmModule.isWasmAvailable() 
          ? dna.to_json() 
          : dna.toJson();
        
        await fs.writeFile(filepath, dnaJson);
      }
      
      spinner.succeed(`Generated ${config.count} DNA files in ${config.outputDir}`);
      
      // Display summary
      this.displayGenerationSummary(generated, config);
      
      // Create index file
      await this.createIndexFile(config.outputDir, config.count);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Generation failed: ${errorMessage}`);
      throw error;
    }
  }

  private displayGenerationSummary(generated: any[], config: GeneratorConfig): void {
    console.log(chalk.blue('\n🧬 Generation Summary:'));
    console.log(chalk.white(`  Count: ${generated.length}`));
    console.log(chalk.white(`  Topology: [${config.topology.join(', ')}]`));
    console.log(chalk.white(`  Activation: ${config.activation}`));
    console.log(chalk.white(`  Random: ${config.random ? 'Yes' : 'No'}`));
    console.log(chalk.white(`  Mutation Rate: ${config.mutationRate}`));
    
    if (generated.length > 0) {
      const firstDna = generated[0];
      const weightsCount = this.wasmModule.isWasmAvailable() 
        ? firstDna.weights.length 
        : firstDna.weights.length;
      const biasesCount = this.wasmModule.isWasmAvailable() 
        ? firstDna.biases.length 
        : firstDna.biases.length;
      
      console.log(chalk.white(`  Weights per DNA: ${weightsCount}`));
      console.log(chalk.white(`  Biases per DNA: ${biasesCount}`));
    }
    
    console.log(chalk.white(`  Output Directory: ${config.outputDir}`));
    console.log('');
  }

  private async createIndexFile(outputDir: string, count: number): Promise<void> {
    const indexData = {
      generated_at: new Date().toISOString(),
      count: count,
      files: []
    };
    
    for (let i = 0; i < count; i++) {
      const filename = `dna_${i.toString().padStart(3, '0')}.json`;
      (indexData.files as Array<{id: number; filename: string; path: string}>).push({
        id: i,
        filename: filename,
        path: `./${filename}`
      });
    }
    
    const indexPath = path.join(outputDir, 'index.json');
    await fs.writeJson(indexPath, indexData, { spaces: 2 });
    
    console.log(chalk.gray(`Index file created: ${indexPath}`));
  }

  async generateFromTemplate(templateFile: string, outputDir: string, variations: number): Promise<void> {
    const spinner = ora('Generating variations from template...').start();
    
    try {
      if (!await fs.pathExists(templateFile)) {
        throw new Error(`Template file not found: ${templateFile}`);
      }
      
      const templateData = await fs.readJson(templateFile);
      const templateDna = this.wasmModule.isWasmAvailable() 
        ? this.wasmModule.createNeuralDNA(templateData.topology, templateData.activation)
        : templateData;
      
      await fs.ensureDir(outputDir);
      
      for (let i = 0; i < variations; i++) {
        // Create a copy of the template
        let variationDna;
        
        if (this.wasmModule.isWasmAvailable()) {
          const templateJson = JSON.stringify(templateData);
          variationDna = this.wasmModule.createNeuralDNA(templateData.topology, templateData.activation);
          // Load template data into the DNA
          variationDna = templateDna; // This would need proper implementation
        } else {
          variationDna = Object.assign(Object.create(Object.getPrototypeOf(templateDna)), templateData);
        }
        
        // Apply mutations to create variation
        if (this.wasmModule.isWasmAvailable()) {
          variationDna.mutate('all');
        } else {
          variationDna.mutate();
        }
        
        // Save variation
        const filename = `variation_${i.toString().padStart(3, '0')}.json`;
        const filepath = path.join(outputDir, filename);
        
        const dnaJson = this.wasmModule.isWasmAvailable() 
          ? variationDna.to_json() 
          : variationDna.toJson();
        
        await fs.writeFile(filepath, dnaJson);
      }
      
      spinner.succeed(`Generated ${variations} variations from template`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(`Template generation failed: ${errorMessage}`);
      throw error;
    }
  }

  async batchGenerate(configs: GeneratorConfig[]): Promise<void> {
    console.log(chalk.blue(`🧬 Starting batch generation of ${configs.length} configurations...`));
    
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      console.log(chalk.cyan(`\nConfiguration ${i + 1}/${configs.length}:`));
      console.log(chalk.gray(`  Topology: [${config.topology.join(', ')}]`));
      console.log(chalk.gray(`  Count: ${config.count}`));
      
      await this.generate(config);
    }
    
    console.log(chalk.green(`\n🎉 Batch generation completed for ${configs.length} configurations`));
  }
}