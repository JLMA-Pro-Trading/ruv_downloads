/**
 * Grid Search Optimizer
 *
 * Simple exhaustive grid search optimizer.
 * No external dependencies - always available as fallback.
 *
 * @module optimizers/grid-search-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer } from './base-optimizer.js';
export class GridSearchOptimizer extends BaseOptimizer {
    currentBest = null;
    currentBestScore = -Infinity;
    async healthCheck() {
        return true; // Always available
    }
    getMetadata() {
        return {
            name: 'grid-search',
            version: '1.0.0',
            capabilities: {
                supportsMultiObjective: false,
                supportsParallelTrials: true,
                supportsCheckpointing: true,
                searchStrategy: 'grid'
            },
            dependencies: []
        };
    }
    async optimize(searchSpace, evaluationFn, options) {
        this.validateSearchSpace(searchSpace);
        const startTime = Date.now();
        const trials = [];
        // Generate grid
        const grid = this.generateGrid(searchSpace, options?.maxTrials);
        if (this.config.verbose) {
            console.log(`🔍 Grid Search: ${grid.length} configurations to evaluate`);
        }
        // Evaluate each configuration
        for (let i = 0; i < grid.length; i++) {
            const config = grid[i];
            const trialStart = Date.now();
            try {
                const score = await evaluationFn(config);
                const duration = Date.now() - trialStart;
                trials.push({
                    trialIndex: i,
                    configuration: config,
                    score,
                    status: 'completed',
                    duration
                });
                // Update best - compare against tracked best score, not against itself
                if (score.primary > this.currentBestScore) {
                    this.currentBest = config;
                    this.currentBestScore = score.primary;
                }
                if (this.config.verbose && (i + 1) % 10 === 0) {
                    console.log(`   Progress: ${i + 1}/${grid.length} (${((i + 1) / grid.length * 100).toFixed(1)}%)`);
                }
            }
            catch (error) {
                trials.push({
                    trialIndex: i,
                    configuration: config,
                    score: { primary: 0 },
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error),
                    duration: Date.now() - trialStart
                });
            }
        }
        // Find best - handle case where all trials failed
        const completedTrials = trials.filter(t => t.status === 'completed');
        if (completedTrials.length === 0) {
            throw new Error(`Optimization failed: All ${trials.length} trials failed. ` +
                `Last error: ${trials[trials.length - 1]?.error || 'Unknown error'}`);
        }
        const bestTrial = completedTrials.reduce((best, trial) => trial.score.primary > best.score.primary ? trial : best);
        const elapsedTime = Date.now() - startTime;
        return {
            bestConfiguration: bestTrial.configuration,
            bestScore: bestTrial.score,
            trialHistory: trials,
            convergencePlot: trials.map(t => t.score.primary),
            totalTrials: trials.length,
            elapsedTime,
            metadata: {
                optimizer: 'grid-search',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString()
            }
        };
    }
    async resume(_checkpointPath) {
        throw new Error('Grid search does not support resume (runs are fast enough to restart)');
    }
    async getBestConfiguration() {
        return this.currentBest;
    }
    /**
     * Generate grid of all parameter combinations
     */
    generateGrid(space, maxConfigs) {
        const configs = [];
        // Calculate grid points for each parameter
        const parameterGrids = [];
        for (const param of space.parameters) {
            if (param.type === 'range') {
                // For ranges, create discrete grid
                const gridSize = 5; // Default grid size
                const [min, max] = param.bounds;
                const values = [];
                for (let i = 0; i < gridSize; i++) {
                    if (param.log_scale) {
                        const logMin = Math.log(min);
                        const logMax = Math.log(max);
                        values.push(Math.exp(logMin + (i / (gridSize - 1)) * (logMax - logMin)));
                    }
                    else {
                        values.push(min + (i / (gridSize - 1)) * (max - min));
                    }
                }
                parameterGrids.push({ name: param.name, values });
            }
            else if (param.type === 'choice') {
                parameterGrids.push({ name: param.name, values: param.values });
            }
            else {
                // Fixed parameter
                parameterGrids.push({ name: param.name, values: [param.value] });
            }
        }
        // Generate Cartesian product
        const generate = (index, current) => {
            if (index === parameterGrids.length) {
                configs.push({ ...current });
                return;
            }
            const { name, values } = parameterGrids[index];
            for (const value of values) {
                generate(index + 1, { ...current, [name]: value });
            }
        };
        generate(0, {});
        // Limit to maxConfigs if specified
        if (maxConfigs && configs.length > maxConfigs) {
            // Sample uniformly
            const step = Math.floor(configs.length / maxConfigs);
            return configs.filter((_, i) => i % step === 0).slice(0, maxConfigs);
        }
        return configs;
    }
}
