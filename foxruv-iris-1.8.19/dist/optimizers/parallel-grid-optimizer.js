/**
 * Parallel Grid Search Optimizer
 *
 * Parallel implementation of grid search using Node.js worker threads.
 * Provides significant speedup for expensive evaluation functions.
 *
 * Features:
 * - Configurable parallelism (default: number of CPUs)
 * - Batch-based evaluation for optimal throughput
 * - Progress tracking across workers
 * - Graceful error handling and fallback
 * - Feature detection (falls back to sequential if workers unavailable)
 *
 * @module optimizers/parallel-grid-optimizer
 * @version 1.0.0
 */
import { cpus } from 'os';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GridSearchOptimizer } from './grid-search-optimizer.js';
/**
 * Parallel Grid Search Optimizer using Worker Threads
 */
export class ParallelGridOptimizer extends GridSearchOptimizer {
    parallelism;
    workersAvailable = true;
    constructor(config = {}) {
        super(config);
        // Default to number of CPUs, but allow configuration
        this.parallelism = config.parallelism || cpus().length;
        // Check if workers are available
        this.checkWorkerSupport();
    }
    /**
     * Check if worker threads are available
     */
    checkWorkerSupport() {
        try {
            // Try to import worker_threads
            require.resolve('worker_threads');
            this.workersAvailable = true;
        }
        catch (error) {
            this.workersAvailable = false;
            if (this.config.verbose) {
                console.warn('⚠️  Worker threads not available, falling back to sequential execution');
            }
        }
    }
    async healthCheck() {
        // Always available (falls back to sequential)
        return true;
    }
    getMetadata() {
        return {
            name: 'parallel-grid-search',
            version: '1.0.0',
            capabilities: {
                supportsMultiObjective: false,
                supportsParallelTrials: true,
                supportsCheckpointing: true,
                searchStrategy: 'grid'
            },
            dependencies: this.workersAvailable ? [] : ['Note: Running in sequential fallback mode']
        };
    }
    /**
     * Run optimization with parallel evaluation
     */
    async optimize(searchSpace, evaluationFn, options) {
        // Fall back to sequential if workers not available
        if (!this.workersAvailable) {
            if (this.config.verbose) {
                console.log('⚠️  Running in sequential mode (workers unavailable)');
            }
            return super.optimize(searchSpace, evaluationFn, options);
        }
        this.validateSearchSpace(searchSpace);
        const startTime = Date.now();
        const trials = [];
        // Generate grid using parent class method
        const grid = this.generateGrid(searchSpace, options?.maxTrials);
        if (this.config.verbose) {
            console.log(`🚀 Parallel Grid Search: ${grid.length} configurations to evaluate`);
            console.log(`⚡ Using ${this.parallelism} parallel workers`);
        }
        // Override parallelism if specified in options
        const parallelism = options?.parallelism || this.parallelism;
        try {
            // Run parallel evaluation
            const evaluationResults = await this.evaluateParallel(grid, evaluationFn, parallelism);
            // Convert results to trials
            for (let i = 0; i < evaluationResults.length; i++) {
                const result = evaluationResults[i];
                trials.push({
                    trialIndex: i,
                    configuration: result.configuration,
                    score: result.score,
                    status: result.error ? 'failed' : 'completed',
                    error: result.error,
                    duration: 0 // Not tracked in parallel mode
                });
            }
        }
        catch (error) {
            if (this.config.verbose) {
                console.warn('⚠️  Parallel evaluation failed, falling back to sequential');
                console.error(error);
            }
            // Fall back to sequential
            return super.optimize(searchSpace, evaluationFn, options);
        }
        // Find best configuration
        const completedTrials = trials.filter(t => t.status === 'completed');
        if (completedTrials.length === 0) {
            throw new Error(`Optimization failed: All ${trials.length} trials failed. ` +
                `Last error: ${trials[trials.length - 1]?.error || 'Unknown error'}`);
        }
        const bestTrial = completedTrials.reduce((best, trial) => trial.score.primary > best.score.primary ? trial : best);
        const elapsedTime = Date.now() - startTime;
        if (this.config.verbose) {
            console.log(`✅ Optimization complete in ${(elapsedTime / 1000).toFixed(2)}s`);
            console.log(`   Best score: ${bestTrial.score.primary}`);
        }
        return {
            bestConfiguration: bestTrial.configuration,
            bestScore: bestTrial.score,
            trialHistory: trials,
            convergencePlot: trials.map(t => t.score.primary),
            totalTrials: trials.length,
            elapsedTime,
            metadata: {
                optimizer: 'parallel-grid-search',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                parallelism
            }
        };
    }
    /**
     * Evaluate configurations in parallel using worker threads
     */
    async evaluateParallel(configurations, evaluationFn, parallelism) {
        // Split configurations into batches
        const batchSize = Math.ceil(configurations.length / parallelism);
        const batches = [];
        for (let i = 0; i < configurations.length; i += batchSize) {
            batches.push(configurations.slice(i, i + batchSize));
        }
        if (this.config.verbose) {
            console.log(`   Split into ${batches.length} batches of ~${batchSize} configs each`);
        }
        // Serialize evaluation function (this is tricky - function must be serializable)
        const evaluationFnString = evaluationFn.toString();
        // Get worker script path
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const workerPath = join(__dirname, 'workers', 'evaluation-worker.js');
        // Create workers and evaluate batches
        const results = new Array(batches.length);
        const workerPromises = batches.map((batch, batchIndex) => {
            return new Promise((resolve, reject) => {
                const worker = new Worker(workerPath, {
                    workerData: { evaluationFnString }
                });
                let workerReady = false;
                worker.on('message', (message) => {
                    if (message.type === 'ready') {
                        workerReady = true;
                        // Send batch to worker
                        worker.postMessage({
                            type: 'evaluate',
                            data: { configurations: batch, batchIndex }
                        });
                    }
                    else if (message.type === 'result' && message.data) {
                        results[batchIndex] = message.data.results;
                        worker.terminate();
                        resolve();
                    }
                    else if (message.type === 'progress' && message.data && this.config.verbose) {
                        const { completedCount } = message.data;
                        console.log(`   Batch ${batchIndex + 1}: ${completedCount}/${batch.length} completed`);
                    }
                    else if (message.type === 'error') {
                        worker.terminate();
                        reject(new Error(message.error || 'Worker error'));
                    }
                });
                worker.on('error', (error) => {
                    reject(error);
                });
                worker.on('exit', (code) => {
                    if (code !== 0 && !results[batchIndex]) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
                // Timeout for worker initialization
                setTimeout(() => {
                    if (!workerReady) {
                        worker.terminate();
                        reject(new Error('Worker initialization timeout'));
                    }
                }, 10000);
            });
        });
        // Wait for all workers to complete
        try {
            await Promise.all(workerPromises);
        }
        catch (error) {
            if (this.config.verbose) {
                console.error('Worker error:', error);
            }
            throw error;
        }
        // Flatten results
        return results.flat();
    }
    /**
     * Get current parallelism level
     */
    getParallelism() {
        return this.parallelism;
    }
    /**
     * Set parallelism level
     */
    setParallelism(parallelism) {
        if (parallelism < 1) {
            throw new Error('Parallelism must be at least 1');
        }
        this.parallelism = parallelism;
    }
    /**
     * Check if workers are available
     */
    isParallelAvailable() {
        return this.workersAvailable;
    }
}
