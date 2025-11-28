/**
 * DSPy Optimizer Adapter
 *
 * Adapts the specific PythonOptimizerClient (DSPy MIPROv2) to the generic BaseOptimizer interface.
 * Allows DSPy to be used interchangeably with other optimizers in the registry.
 *
 * note: Unlike Ax (which calls back for evaluation), DSPy runs the optimization loop
 * entirely server-side (in Python). The `evaluationFn` passed to optimize() is largely
 * unused here, as the metric is implicit in the training data/Python service.
 *
 * @module optimizers/dspy-optimizer
 * @version 1.0.0
 */
import { BaseOptimizer } from './base-optimizer.js';
import { PythonOptimizerClient } from '../clients/python-optimizer-client.js';
export class DSPyOptimizer extends BaseOptimizer {
    client;
    constructor(config = {}) {
        super(config);
        this.client = new PythonOptimizerClient({
            baseUrl: config.baseUrl,
            timeout: config.verbose ? 600000 : undefined // Pass timeout if needed
        });
    }
    async healthCheck() {
        return await this.client.healthCheck();
    }
    getMetadata() {
        return {
            name: 'dspy',
            version: '2.4.0', // Tracking DSPy version
            capabilities: {
                supportsMultiObjective: false, // Usually single metric (quality)
                supportsParallelTrials: true, // MIPRO does this internally
                supportsCheckpointing: false, // Not exposed via current API
                searchStrategy: 'bayesian' // MIPRO uses Bayesian optimization
            },
            dependencies: ['dspy-ai (Python)', 'python-optimizer-service']
        };
    }
    async optimize(searchSpace, _evaluationFn, options) {
        const startTime = Date.now();
        if (this.config.verbose) {
            console.log('🔮 DSPy Prompt Optimization');
        }
        // 1. Extract DSPy-specific parameters from the generic SearchSpace
        // We expect the SearchSpace to contain 'fixed' parameters holding the request data
        const request = this.convertToDSPyRequest(searchSpace, options);
        // 2. Run Optimization (Server-side loop)
        // The evaluationFn is NOT used here because DSPy controls the loop in Python
        let dspyResult;
        try {
            dspyResult = await this.client.optimize(request);
        }
        catch (error) {
            throw new Error(`DSPy optimization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        const duration = Date.now() - startTime;
        // 3. Convert DSPy result back to generic OptimizationResult
        const bestScore = dspyResult.quality_after;
        // Construct the "best configuration" - for DSPy this is the optimized signature & demos
        const bestConfig = {
            expert_role: dspyResult.expert_role,
            optimized_signature: dspyResult.optimized_signature,
            few_shot_examples: dspyResult.few_shot_examples,
            version: dspyResult.version
        };
        // Create a synthetic trial history since we don't get per-step callbacks from this API
        // We only know the start and end state
        const trials = [
            {
                trialIndex: 0,
                configuration: { status: 'baseline' },
                score: { primary: dspyResult.quality_before },
                status: 'completed',
                duration: 0
            },
            {
                trialIndex: dspyResult.trials_completed || options?.maxTrials || 30,
                configuration: bestConfig,
                score: { primary: dspyResult.quality_after },
                status: 'completed',
                duration: duration
            }
        ];
        return {
            bestConfiguration: bestConfig,
            bestScore: {
                primary: bestScore,
                metadata: {
                    improvement: dspyResult.improvement,
                    baseline: dspyResult.quality_before
                }
            },
            trialHistory: trials,
            totalTrials: dspyResult.trials_completed || options?.maxTrials || 0,
            elapsedTime: duration,
            metadata: {
                optimizer: 'dspy',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                checkpointSaved: undefined
            }
        };
    }
    async resume(_checkpointPath) {
        throw new Error('Resume not supported for DSPy optimizer via this adapter');
    }
    async getBestConfiguration() {
        // Not supported during run, only at end
        return null;
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
    convertToDSPyRequest(space, options) {
        // Helper to find a fixed parameter value
        const getFixedParam = (name) => {
            const param = space.parameters.find(p => p.name === name);
            if (!param || param.type !== 'fixed') {
                // Try to look in "value" if it was passed as a single object config
                return undefined;
            }
            return param.value;
        };
        // Mandatory fields
        const expert_role = getFixedParam('expert_role');
        const signature = getFixedParam('signature');
        const training_data = getFixedParam('training_data');
        if (!expert_role || !signature || !training_data) {
            throw new Error('DSPyOptimizer requires "expert_role", "signature", and "training_data" as fixed parameters in SearchSpace');
        }
        // Optional config mapping
        // We map the generic options to DSPy config where applicable
        const config = {
            num_trials: options?.maxTrials,
            // other DSPy specific configs could be passed via extra fixed params if needed
            ...(getFixedParam('config') || {})
        };
        return {
            expert_role,
            signature,
            training_data,
            config,
            lm_config: getFixedParam('lm_config')
        };
    }
}
