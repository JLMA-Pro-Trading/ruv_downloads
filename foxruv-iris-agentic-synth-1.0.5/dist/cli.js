#!/usr/bin/env node
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { AgenticSynth } from './index.js';
// Removed: createDefaultRouter and FitnessEvaluator are not directly used by the CLI commands
// import { createDefaultRouter } from './core/models';
// import { FitnessEvaluator } from './utils/fitness';
const program = new Command();
program
    .name('agentic-synth')
    .description('Synthetic prompt generation with genetic evolution')
    .version('1.0.0');
/**
 * Generate command
 */
program
    .command('generate')
    .description('Generate synthetic prompts from a seed prompt')
    .argument('<prompt>', 'Seed prompt to generate variations from')
    .option('-c, --count <number>', 'Number of prompts to generate', '10')
    .option('-d, --diversity <number>', 'Diversity level (0-1)', '0.8')
    .option('-m, --model <string>', 'Model to use', 'gemini-flash')
    .option('--no-streaming', 'Disable streaming output')
    .option('--cache', 'Enable caching', true)
    .option('-t, --temperature <number>', 'Sampling temperature (0-2)', '0.7')
    .option('--max-tokens <number>', 'Max tokens to generate', '200')
    .option('--fallback-models <items>', 'Comma-separated list of fallback models')
    .option('-o, --output <file>', 'Output file (JSON)')
    .action(async (prompt, options) => {
    const spinner = ora('Initializing generator...').start();
    try {
        const synth = new AgenticSynth({
            streaming: options.streaming,
            models: options.model ? [options.model] : [], // Ensure models array is always present
            cache: { enabled: options.cache },
        });
        spinner.text = 'Generating synthetic prompts...';
        const generateConfig = {
            seedPrompt: prompt,
            count: parseInt(options.count),
            diversity: parseFloat(options.diversity),
            streaming: options.streaming,
            model: options.model,
            temperature: parseFloat(options.temperature),
            maxTokens: parseInt(options.maxTokens),
            fallbackModels: options.fallbackModels ? options.fallbackModels.split(',') : undefined,
        };
        if (options.streaming) {
            spinner.stop();
            console.log(chalk.blue('🔄 Streaming output:\n'));
            for await (const chunk of synth.streamGenerate(generateConfig.seedPrompt)) {
                process.stdout.write(chunk);
            }
            console.log('\n');
        }
        else {
            const result = await synth.generate(generateConfig);
            spinner.succeed('Generation complete!');
            console.log(chalk.green('\n✨ Generated Prompts:\n'));
            result.prompts.forEach((p, i) => {
                console.log(chalk.cyan(`${i + 1}.`) + ` ${p}\n`);
            });
            console.log(chalk.gray('\n📊 Metadata:'));
            console.log(chalk.gray(`  Model: ${result.metadata.model}`));
            console.log(chalk.gray(`  Latency: ${result.metadata.latency?.toFixed(2)}ms`));
            console.log(chalk.gray(`  Count: ${result.metadata.count}`));
            console.log(chalk.gray(`  Tokens Used: ${result.metadata.tokensUsed || 'N/A'}`));
            if (options.output) {
                const fs = require('fs');
                fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
                console.log(chalk.green(`\n💾 Saved to ${options.output}`));
            }
        }
        const stats = synth.getStats();
        console.log(chalk.gray('\n📈 Statistics:'));
        if (stats.cache) {
            console.log(chalk.gray(`  Cache Hits: ${stats.cache.hits}`));
            console.log(chalk.gray(`  Cache Misses: ${stats.cache.misses}`));
        }
    }
    catch (error) {
        spinner.fail('Generation failed');
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
    }
});
/**
 * Evolve command
 */
program
    .command('evolve')
    .description('Evolve prompts using genetic algorithm')
    .argument('<prompt>', 'Seed prompt for evolution')
    .option('-g, --generations <number>', 'Number of generations', '10')
    .option('-p, --population <number>', 'Population size', '20')
    .option('-m, --mutation-rate <number>', 'Mutation rate (0-1)', '0.1')
    .option('-c, --crossover-rate <number>', 'Crossover rate (0-1)', '0.7')
    .option('-e, --elite <number>', 'Elite count', '2')
    .option('--model <string>', 'Model to use', 'gemini-flash')
    .option('--mutation-strategies <items>', 'Comma-separated list of mutation strategies', 'zero_order,first_order,semantic_rewrite,hypermutation')
    .option('--crossover-operations <items>', 'Comma-separated list of crossover operations', 'uniform,single_point,semantic')
    .option('--max-fitness-evals <number>', 'Max fitness evaluations before stopping')
    .option('--convergence-threshold <number>', 'Convergence threshold (0-1)')
    .option('-o, --output <file>', 'Output file (JSON)')
    .option('--verbose', 'Verbose output', false)
    .action(async (prompt, options) => {
    const spinner = ora('Initializing evolution engine...').start();
    try {
        const synth = new AgenticSynth({
            streaming: false,
            models: options.model ? [options.model] : [],
        });
        spinner.text = 'Starting evolution...';
        const evolutionConfig = {
            seedPrompts: [prompt],
            generations: parseInt(options.generations),
            populationSize: parseInt(options.population),
            mutationRate: parseFloat(options.mutationRate),
            crossoverRate: parseFloat(options.crossoverRate),
            eliteCount: parseInt(options.elite),
            mutationStrategies: options.mutationStrategies.split(','),
            crossoverOperations: options.crossoverOperations.split(','),
            maxFitnessEvaluations: options.maxFitnessEvals ? parseInt(options.maxFitnessEvals) : undefined,
            convergenceThreshold: options.convergenceThreshold ? parseFloat(options.convergenceThreshold) : undefined,
        };
        const results = await synth.evolve(evolutionConfig);
        spinner.succeed('Evolution complete!');
        console.log(chalk.green('\n🧬 Evolution Results:\n'));
        console.log(chalk.yellow(`Top ${Math.min(5, results.length)} Prompts:\n`));
        results.slice(0, 5).forEach((p, i) => {
            console.log(chalk.cyan(`${i + 1}. [Fitness: ${p.fitness.toFixed(3)}]`));
            console.log(`   ${p.content}`);
            console.log(chalk.gray(`   Generation: ${p.generation}, ID: ${p.id}\n`));
        });
        if (options.verbose) {
            console.log(chalk.gray('\n📊 Detailed Statistics:'));
            const stats = synth.getStats();
            if (stats.optimizer) {
                console.log(chalk.gray(`  Generations: ${stats.optimizer.generation}`));
                console.log(chalk.gray(`  Best Fitness: ${stats.optimizer.bestFitness.toFixed(3)}`));
                console.log(chalk.gray(`  Fitness Evaluations: ${stats.optimizer.fitnessCache.size}`));
                const avgFitness = (results.reduce((sum, p) => sum + p.fitness, 0) / results.length).toFixed(3);
                console.log(chalk.gray(`  Avg Fitness: ${avgFitness}`));
                console.log(chalk.gray(`  Convergence History: ${stats.optimizer.convergenceHistory.map((f) => f.toFixed(3)).join(', ')}`));
            }
            else {
                console.log(chalk.gray('  Optimizer stats not available.'));
            }
        }
        if (options.output) {
            const fs = require('fs');
            fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
            console.log(chalk.green(`\n💾 Saved to ${options.output}`));
        }
    }
    catch (error) {
        spinner.fail('Evolution failed');
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
    }
});
/**
 * Benchmark command
 */
program
    .command('benchmark')
    .description('Run performance benchmarks')
    .option('-i, --iterations <number>', 'Number of iterations', '100')
    .option('-c, --concurrency <number>', 'Concurrent requests', '10')
    .option('-m, --model <string>', 'Model to use', 'gemini-flash')
    .option('-p, --prompt <string>', 'Test prompt', 'You are an expert assistant')
    .action(async (options) => {
    const spinner = ora('Running benchmarks...').start();
    try {
        const synth = new AgenticSynth({
            streaming: false,
            models: options.model ? [options.model] : [],
        });
        const iterations = parseInt(options.iterations);
        const concurrency = parseInt(options.concurrency);
        const testPrompt = options.prompt;
        spinner.text = `Running ${iterations} iterations with concurrency ${concurrency}...`;
        const start = Date.now();
        const latencies = [];
        let successfulRequests = 0;
        const generateConfig = {
            seedPrompt: testPrompt,
            count: 1, // Generate one prompt per iteration for latency measurement
            diversity: 0.8,
            streaming: false,
            model: options.model,
        };
        const runIteration = async () => {
            const iterationStart = Date.now();
            try {
                const result = await synth.generate(generateConfig);
                const latency = Date.now() - iterationStart;
                latencies.push(latency);
                if (result.prompts && result.prompts.length > 0) {
                    successfulRequests++;
                }
            }
            catch (error) {
                // console.error(`Benchmark iteration failed: ${error.message}`);
            }
        };
        const concurrentPromises = [];
        for (let i = 0; i < iterations; i++) {
            // Simple queue management for concurrency
            if (concurrentPromises.length >= concurrency) {
                await Promise.race(concurrentPromises);
                // Remove the first completed promise
                const index = await Promise.race(concurrentPromises.map((p, idx) => p.then(() => idx)));
                concurrentPromises.splice(index, 1);
            }
            concurrentPromises.push(runIteration());
        }
        await Promise.all(concurrentPromises);
        const totalTime = Date.now() - start;
        // Calculate statistics
        latencies.sort((a, b) => a - b);
        const calculatePercentile = (arr, p) => {
            if (!arr.length)
                return 0;
            const index = Math.min(Math.floor(arr.length * p), arr.length - 1);
            return arr[index];
        };
        const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length || 0;
        const p50Latency = calculatePercentile(latencies, 0.50);
        const p95Latency = calculatePercentile(latencies, 0.95);
        const p99Latency = calculatePercentile(latencies, 0.99);
        const successRate = iterations > 0 ? successfulRequests / iterations : 0;
        const throughput = totalTime > 0 ? (iterations / (totalTime / 1000)).toFixed(2) : 0;
        spinner.succeed('Benchmark complete!');
        const stats = synth.getStats(); // Get cache stats for display
        console.log(chalk.green('\n📊 Benchmark Results:\n'));
        console.log(chalk.cyan(`Total Time: ${totalTime}ms`));
        console.log(chalk.cyan(`Iterations: ${iterations}`));
        console.log(chalk.cyan(`Avg Latency: ${avgLatency.toFixed(2)}ms`));
        console.log(chalk.cyan(`P50 Latency: ${p50Latency.toFixed(2)}ms`));
        console.log(chalk.cyan(`P95 Latency: ${p95Latency.toFixed(2)}ms`));
        console.log(chalk.cyan(`P99 Latency: ${p99Latency.toFixed(2)}ms`));
        console.log(chalk.cyan(`Success Rate: ${(successRate * 100).toFixed(2)}%`));
        console.log(chalk.cyan(`Cache Hit Rate: ${(stats.cache?.hitRate * 100).toFixed(2) || 0}%`));
        console.log(chalk.cyan(`Throughput: ${throughput} req/s`));
        if (p99Latency < 100) {
            console.log(chalk.green('\n✅ P99 latency target met (<100ms)'));
        }
        else {
            console.log(chalk.yellow(`\n⚠️  P99 latency above target: ${p99Latency.toFixed(2)}ms`));
        }
    }
    catch (error) {
        spinner.fail('Benchmark failed');
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
        process.exit(1);
    }
});
/**
 * Init command
 */
program
    .command('init')
    .description('Initialize configuration file')
    .option('-o, --output <file>', 'Config file path', 'agentic-synth.config.json')
    .action((options) => {
    const fs = require('fs');
    const config = {
        streaming: true,
        models: ['gemini-flash', 'claude-sonnet'],
        primaryModel: 'gemini-flash',
        cache: {
            enabled: true,
            ttl: 3600000,
            maxSize: 1000,
            strategy: 'lru',
        },
        vectorStore: {
            enabled: false,
            dimensions: 384,
            indexType: 'hnsw',
        },
        automation: {
            enabled: false,
            workflows: [],
        },
        performance: {
            enableMetrics: true,
            trackLatency: true,
            trackTokens: true,
        },
    };
    fs.writeFileSync(options.output, JSON.stringify(config, null, 2));
    console.log(chalk.green(`✅ Configuration created: ${options.output}`));
    console.log(chalk.gray('\nEdit the file to customize settings.'));
});
program.parse();
//# sourceMappingURL=cli.js.map