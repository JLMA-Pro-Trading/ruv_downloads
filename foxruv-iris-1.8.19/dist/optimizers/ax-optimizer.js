/**
 * Ax Optimizer Implementation
 *
 * Bayesian optimization using Ax platform via Python service.
 * Requires: ax-platform (Python), ax_service.py running
 *
 * @module optimizers/ax-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer } from './base-optimizer.js';
import { checkDependency } from '../utils/dependency-checker.js';
import path from 'path';
import fs from 'fs/promises';
export class AxOptimizer extends BaseOptimizer {
    baseUrl;
    currentExperimentId = null;
    constructor(config = {}) {
        super(config);
        this.baseUrl = config.baseUrl || process.env.AX_SERVICE_URL || 'http://localhost:8001';
    }
    async healthCheck() {
        try {
            // Check if Ax Python package is installed
            const axInstalled = await checkDependency('python', 'ax');
            if (!axInstalled) {
                if (this.config.verbose) {
                    console.warn('⚠️  ax-platform not installed');
                    console.warn('   Install with: pip install ax-platform');
                }
                return false;
            }
            // Check if service is running
            const response = await fetch(`${this.baseUrl}/health`, {
                signal: AbortSignal.timeout(3000)
            });
            if (!response.ok) {
                if (this.config.verbose) {
                    console.warn('⚠️  Ax service not healthy');
                    console.warn('   Start with: python services/ax_service.py');
                }
                return false;
            }
            return true;
        }
        catch (error) {
            if (this.config.verbose) {
                console.warn('⚠️  Ax service not reachable at', this.baseUrl);
                console.warn('   Start with: python services/ax_service.py');
            }
            return false;
        }
    }
    getMetadata() {
        return {
            name: 'ax',
            version: '1.0.0',
            capabilities: {
                supportsMultiObjective: true,
                supportsParallelTrials: true,
                supportsCheckpointing: true,
                searchStrategy: 'bayesian'
            },
            dependencies: ['ax-platform (Python)', 'ax_service.py running']
        };
    }
    async optimize(searchSpace, evaluationFn, options) {
        this.validateSearchSpace(searchSpace);
        const startTime = Date.now();
        const maxTrials = options?.maxTrials || 30;
        const checkpointInterval = options?.checkpointInterval || 1; // Default: Save every trial
        if (this.config.verbose) {
            console.log(`🔬 Ax Bayesian Optimization`);
            console.log(`   Max trials: ${maxTrials}`);
            console.log(`   Search space: ${searchSpace.parameters.length} parameters`);
        }
        // Create experiment
        const experimentId = await this.createExperiment(searchSpace);
        this.currentExperimentId = experimentId;
        // Run trials
        const trials = [];
        for (let i = 0; i < maxTrials; i++) {
            // Get next configuration from Ax
            const { parameters, trial_index } = await this.getNextTrial(experimentId);
            // Evaluate
            const trialStart = Date.now();
            try {
                const score = await evaluationFn(parameters);
                const duration = Date.now() - trialStart;
                trials.push({
                    trialIndex: trial_index,
                    configuration: parameters,
                    score,
                    status: 'completed',
                    duration
                });
                // Report to Ax
                await this.completeTrial(experimentId, trial_index, score.primary);
                if (this.config.verbose && (i + 1) % 5 === 0) {
                    console.log(`   Trial ${i + 1}/${maxTrials}: score = ${score.primary.toFixed(4)}`);
                }
                // Checkpoint
                if (checkpointInterval && (i + 1) % checkpointInterval === 0) {
                    await this.saveCheckpoint(experimentId);
                    if (this.config.verbose) {
                        console.log(`   💾 Checkpoint saved at trial ${i + 1}`);
                    }
                }
            }
            catch (error) {
                trials.push({
                    trialIndex: trial_index,
                    configuration: parameters,
                    score: { primary: 0 },
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error),
                    duration: Date.now() - trialStart
                });
            }
            // Early stopping
            if (options?.earlyStoppingPatience) {
                const recentTrials = trials.slice(-options.earlyStoppingPatience);
                const scores = recentTrials.map(t => t.score.primary);
                const improving = scores.some((s, idx) => idx > 0 && s > scores[idx - 1]);
                if (!improving && recentTrials.length === options.earlyStoppingPatience) {
                    if (this.config.verbose) {
                        console.log(`   ⏹️  Early stopping at trial ${i + 1} (no improvement)`);
                    }
                    break;
                }
            }
        }
        // Get best configuration
        const bestResult = await this.getBest(experimentId);
        // Handle case where getBest returns undefined or incomplete data
        if (!bestResult || bestResult.parameters === undefined || bestResult.score === undefined) {
            // Fall back to finding best from local trials
            const completedTrials = trials.filter(t => t.status === 'completed');
            if (completedTrials.length === 0) {
                throw new Error(`Optimization failed: All ${trials.length} trials failed and Ax service returned no best. ` +
                    `Last error: ${trials[trials.length - 1]?.error || 'Unknown'}`);
            }
            const localBest = completedTrials.reduce((best, trial) => trial.score.primary > best.score.primary ? trial : best);
            const elapsedTime = Date.now() - startTime;
            if (this.config.verbose) {
                console.log(`\n⚠️ Ax getBest failed, using local best from trials`);
                console.log(`   Best score: ${localBest.score.primary.toFixed(4)}`);
                console.log(`   Total trials: ${trials.length}`);
                console.log(`   Time: ${(elapsedTime / 1000).toFixed(1)}s`);
            }
            return {
                bestConfiguration: localBest.configuration,
                bestScore: localBest.score,
                trialHistory: trials,
                convergencePlot: trials.map(t => t.score.primary),
                totalTrials: trials.length,
                elapsedTime,
                metadata: {
                    optimizer: 'ax',
                    startTime: new Date(startTime).toISOString(),
                    endTime: new Date().toISOString(),
                    checkpointSaved: this.config.checkpointDir
                        ? `${this.config.checkpointDir}/ax_${experimentId}.json`
                        : undefined
                }
            };
        }
        const { parameters: bestConfig, score: bestScore } = bestResult;
        const elapsedTime = Date.now() - startTime;
        if (this.config.verbose) {
            console.log(`\n✅ Optimization complete!`);
            console.log(`   Best score: ${bestScore.toFixed(4)}`);
            console.log(`   Total trials: ${trials.length}`);
            console.log(`   Time: ${(elapsedTime / 1000).toFixed(1)}s`);
        }
        return {
            bestConfiguration: bestConfig,
            bestScore: { primary: bestScore },
            trialHistory: trials,
            convergencePlot: trials.map(t => t.score.primary),
            totalTrials: trials.length,
            elapsedTime,
            metadata: {
                optimizer: 'ax',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                checkpointSaved: this.config.checkpointDir
                    ? `${this.config.checkpointDir}/ax_${experimentId}.json`
                    : undefined
            }
        };
    }
    async resume(checkpointPath) {
        // Load from checkpoint
        const response = await fetch(`${this.baseUrl}/load_checkpoint`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath: checkpointPath })
        });
        if (!response.ok) {
            throw new Error(`Failed to load checkpoint: ${response.statusText}`);
        }
        const { experiment_id } = await response.json();
        this.currentExperimentId = experiment_id;
        // Would need to continue optimization here
        throw new Error('Resume not fully implemented yet');
    }
    async getBestConfiguration() {
        if (!this.currentExperimentId) {
            return null;
        }
        try {
            const { parameters } = await this.getBest(this.currentExperimentId);
            return parameters;
        }
        catch {
            return null;
        }
    }
    // ============================================================================
    // Private Methods
    // ============================================================================
    async createExperiment(searchSpace) {
        const experimentName = `iris_experiment_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const response = await fetch(`${this.baseUrl}/create_experiment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: experimentName,
                parameters: searchSpace.parameters.map(p => ({
                    name: p.name,
                    type: p.type,
                    bounds: p.bounds,
                    values: p.values,
                    value: p.value,
                    log_scale: p.log_scale
                })),
                objective_name: 'score',
                minimize: false
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to create experiment: ${response.statusText}`);
        }
        const { experiment_id } = await response.json();
        return experiment_id;
    }
    async getNextTrial(experimentId) {
        const response = await fetch(`${this.baseUrl}/get_next_trial/${experimentId}`);
        if (!response.ok) {
            throw new Error(`Failed to get next trial: ${response.statusText}`);
        }
        return await response.json();
    }
    async completeTrial(experimentId, trialIndex, score) {
        // Validate score is a finite number (NaN/Infinity serialize to null, causing 422)
        if (!Number.isFinite(score)) {
            throw new Error(`Invalid score value: ${score}. Score must be a finite number.`);
        }
        const response = await fetch(`${this.baseUrl}/complete_trial/${experimentId}/${trialIndex}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score })
        });
        if (!response.ok) {
            const errorBody = await response.text().catch(() => '');
            throw new Error(`Failed to complete trial: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`);
        }
    }
    async getBest(experimentId) {
        const response = await fetch(`${this.baseUrl}/get_best/${experimentId}`);
        if (!response.ok) {
            throw new Error(`Failed to get best: ${response.statusText}`);
        }
        return await response.json();
    }
    async saveCheckpoint(experimentId) {
        const dir = this.config.checkpointDir || './checkpoints';
        // Ensure directory exists
        try {
            await fs.mkdir(dir, { recursive: true });
        }
        catch {
            // Ignore if exists or fails (Python might handle it or it will fail loudly later)
        }
        const filename = `ax_${experimentId}.json`;
        const filepath = path.resolve(process.cwd(), dir, filename);
        await fetch(`${this.baseUrl}/save_checkpoint/${experimentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filepath })
        });
    }
}
