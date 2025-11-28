/**
 * Base Optimizer Interface
 * 
 * Abstract class defining the contract for all optimization strategies.
 * Domain-agnostic - works for any AI task (trading, NLP, robotics, etc.)
 * 
 * @module optimizers/base-optimizer
 * @version 1.0.0
 */

// ============================================================================
// Types
// ============================================================================

export interface SearchSpace {
    parameters: Parameter[]
    constraints?: Constraint[]
}

export interface Parameter {
    name: string
    type: 'range' | 'choice' | 'fixed'
    bounds?: [number, number]  // for range
    values?: any[]              // for choice
    value?: any                 // for fixed
    log_scale?: boolean         // for range (logarithmic scale)
}

export interface Constraint {
    type: 'linear' | 'order' | 'sum'
    parameters: string[]
    bound?: number
}

export type EvaluationFunction = (
    config: ParameterConfiguration
) => Promise<EvaluationScore>

export interface ParameterConfiguration {
    [key: string]: any
}

export interface EvaluationScore {
    primary: number                    // Main objective (e.g., accuracy)
    secondary?: Record<string, number> // Multi-objective (e.g., latency, cost)
    metadata?: Record<string, any>
}

export interface OptimizationOptions {
    maxTrials?: number
    timeout?: number                   // milliseconds
    parallelism?: number
    earlyStoppingPatience?: number
    checkpointInterval?: number        // save every N trials
}

export interface OptimizationResult {
    bestConfiguration: ParameterConfiguration
    bestScore: EvaluationScore
    trialHistory: Trial[]
    convergencePlot?: number[]         // scores over time
    totalTrials: number
    elapsedTime: number                // milliseconds
    metadata: {
        optimizer: string
        startTime: string
        endTime: string
        checkpointSaved?: string
        [key: string]: string | number | boolean | undefined
    }
}

export interface Trial {
    trialIndex: number
    configuration: ParameterConfiguration
    score: EvaluationScore
    status: 'completed' | 'failed' | 'abandoned'
    error?: string
    duration: number                   // milliseconds
}

export interface OptimizerMetadata {
    name: string
    version: string
    capabilities: {
        supportsMultiObjective: boolean
        supportsParallelTrials: boolean
        supportsCheckpointing: boolean
        searchStrategy: 'bayesian' | 'evolutionary' | 'grid' | 'random'
    }
    dependencies: string[]             // e.g., ['ax-llm', 'python3']
}

export interface OptimizerConfig {
    checkpointDir?: string
    verbose?: boolean
    seed?: number
}

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Base optimizer that all optimization strategies must extend
 */
export abstract class BaseOptimizer {
    protected config: OptimizerConfig

    constructor(config: OptimizerConfig = {}) {
        this.config = {
            checkpointDir: config.checkpointDir || './checkpoints',
            verbose: config.verbose ?? true,
            seed: config.seed
        }
    }

    /**
     * Run optimization experiment
     * 
     * @param searchSpace - Parameters to optimize
     * @param evaluationFn - Function that scores a parameter configuration
     * @param options - Experiment-specific options
     * @returns Best configuration found
     */
    abstract optimize(
        searchSpace: SearchSpace,
        evaluationFn: EvaluationFunction,
        options?: OptimizationOptions
    ): Promise<OptimizationResult>

    /**
     * Resume optimization from checkpoint
     * 
     * @param checkpointPath - Path to checkpoint file
     * @returns Resumed optimization result
     */
    abstract resume(checkpointPath: string): Promise<OptimizationResult>

    /**
     * Get current best configuration (during optimization)
     * 
     * @returns Best config so far, or null if not started
     */
    abstract getBestConfiguration(): Promise<ParameterConfiguration | null>

    /**
     * Health check - is optimizer ready to use?
     * 
     * @returns true if all dependencies are available
     */
    abstract healthCheck(): Promise<boolean>

    /**
     * Get optimizer metadata
     * 
     * @returns Metadata describing capabilities and requirements
     */
    abstract getMetadata(): OptimizerMetadata

    /**
     * Validate search space (called before optimization)
     */
    protected validateSearchSpace(space: SearchSpace): void {
        if (!space.parameters || space.parameters.length === 0) {
            throw new Error('Search space must have at least one parameter')
        }

        for (const param of space.parameters) {
            if (!param.name) {
                throw new Error('Parameter must have a name')
            }

            if (param.type === 'range' && !param.bounds) {
                throw new Error(`Range parameter '${param.name}' must have bounds`)
            }

            if (param.type === 'choice' && !param.values) {
                throw new Error(`Choice parameter '${param.name}' must have values`)
            }

            if (param.type === 'fixed' && param.value === undefined) {
                throw new Error(`Fixed parameter '${param.name}' must have a value`)
            }
        }
    }

    /**
     * Generate random configuration from search space (helper)
     */
    protected generateRandomConfiguration(space: SearchSpace): ParameterConfiguration {
        const config: ParameterConfiguration = {}

        for (const param of space.parameters) {
            if (param.type === 'range') {
                const [min, max] = param.bounds!
                if (param.log_scale) {
                    const logMin = Math.log(min)
                    const logMax = Math.log(max)
                    config[param.name] = Math.exp(logMin + Math.random() * (logMax - logMin))
                } else {
                    config[param.name] = min + Math.random() * (max - min)
                }
            } else if (param.type === 'choice') {
                const randomIndex = Math.floor(Math.random() * param.values!.length)
                config[param.name] = param.values![randomIndex]
            } else {
                config[param.name] = param.value
            }
        }

        return config
    }
}
