/**
 * ReasoningBank Optimizer
 *
 * Intelligent optimizer that uses learned patterns from ReasoningBank for warm-start optimization.
 * Queries historical successful configurations before starting, uses high-confidence patterns
 * to initialize search, falls back to grid search for exploration, and stores successful
 * trials back to ReasoningBank for continuous learning.
 *
 * @module optimizers/reasoningbank-optimizer
 * @version 1.0.0
 */

import {
    BaseOptimizer,
    type SearchSpace,
    type EvaluationFunction,
    type OptimizationOptions,
    type OptimizationResult,
    type ParameterConfiguration,
    type Trial,
    type OptimizerMetadata,
    type OptimizerConfig
} from './base-optimizer.js'
import { ReasoningBankManager, type LearningTrajectory } from '../storage/reasoning-bank.js'

export interface ReasoningBankOptimizerConfig extends OptimizerConfig {
    dbPath?: string
    expertRole?: string
    warmStartRatio?: number        // Ratio of warm-start vs exploration configs (default: 0.3)
    confidenceThreshold?: number   // Minimum confidence for warm-start (default: 0.7)
    successThreshold?: number      // Minimum score to store as success (default: 0.8)
    enableLearning?: boolean       // Store results back to ReasoningBank (default: true)
}

/**
 * ReasoningBank-powered optimizer with adaptive warm-start
 */
export class ReasoningBankOptimizer extends BaseOptimizer {
    private reasoningBank: ReasoningBankManager
    private expertRole: string
    private warmStartRatio: number
    private confidenceThreshold: number
    private successThreshold: number
    private enableLearning: boolean
    private currentBest: ParameterConfiguration | null = null
    private currentBestScore: number = -Infinity

    constructor(config: ReasoningBankOptimizerConfig = {}) {
        super(config)

        this.reasoningBank = new ReasoningBankManager(config.dbPath || './data/reasoning-bank.db')
        this.expertRole = config.expertRole || 'optimizer'
        this.warmStartRatio = config.warmStartRatio ?? 0.3
        this.confidenceThreshold = config.confidenceThreshold ?? 0.7
        this.successThreshold = config.successThreshold ?? 0.8
        this.enableLearning = config.enableLearning ?? true
    }

    async healthCheck(): Promise<boolean> {
        return true // Always available (ReasoningBank gracefully degrades if DB unavailable)
    }

    getMetadata(): OptimizerMetadata {
        return {
            name: 'reasoningbank',
            version: '1.0.0',
            capabilities: {
                supportsMultiObjective: false,
                supportsParallelTrials: true,
                supportsCheckpointing: true,
                searchStrategy: 'bayesian' // Uses learned patterns + exploration
            },
            dependencies: []
        }
    }

    async optimize(
        searchSpace: SearchSpace,
        evaluationFn: EvaluationFunction,
        options?: OptimizationOptions
    ): Promise<OptimizationResult> {
        this.validateSearchSpace(searchSpace)

        const startTime = Date.now()
        const trials: Trial[] = []
        const maxTrials = options?.maxTrials || 50

        if (this.config.verbose) {
            console.log(`🧠 ReasoningBank Optimizer: Learning from past experiences...`)
        }

        // Step 1: Query ReasoningBank for successful patterns
        const warmStartConfigs = await this.generateWarmStartConfigs(searchSpace, maxTrials)

        // Step 2: Generate exploration configs (grid search)
        const explorationConfigs = this.generateExplorationConfigs(
            searchSpace,
            maxTrials - warmStartConfigs.length
        )

        // Step 3: Combine warm-start and exploration
        const allConfigs = [...warmStartConfigs, ...explorationConfigs]

        if (this.config.verbose) {
            console.log(
                `   💡 Warm-start configs: ${warmStartConfigs.length}, ` +
                `Exploration configs: ${explorationConfigs.length}`
            )
        }

        // Step 4: Evaluate all configurations
        for (let i = 0; i < allConfigs.length; i++) {
            const config = allConfigs[i]
            const trialStart = Date.now()
            const isWarmStart = i < warmStartConfigs.length

            try {
                const score = await evaluationFn(config)
                const duration = Date.now() - trialStart

                trials.push({
                    trialIndex: i,
                    configuration: config,
                    score,
                    status: 'completed',
                    duration
                })

                // Update best
                if (score.primary > this.currentBestScore) {
                    this.currentBest = config
                    this.currentBestScore = score.primary

                    if (this.config.verbose) {
                        console.log(
                            `   ✨ New best (${isWarmStart ? 'warm-start' : 'exploration'}): ` +
                            `${score.primary.toFixed(4)}`
                        )
                    }
                }

                // Step 5: Store successful trials to ReasoningBank
                if (this.enableLearning && score.primary >= this.successThreshold) {
                    await this.storeSuccessfulTrial(config, score, isWarmStart)
                }

                if (this.config.verbose && (i + 1) % 10 === 0) {
                    console.log(`   Progress: ${i + 1}/${allConfigs.length} (${((i + 1) / allConfigs.length * 100).toFixed(1)}%)`)
                }

                // Early stopping
                if (options?.earlyStoppingPatience) {
                    const recentTrials = trials.slice(-options.earlyStoppingPatience)
                    const patience = options.earlyStoppingPatience!
                    const improvements = recentTrials.filter(t =>
                        t.score.primary > (trials[trials.length - patience - 1]?.score.primary ?? -Infinity)
                    )

                    if (improvements.length === 0 && trials.length >= options.earlyStoppingPatience) {
                        if (this.config.verbose) {
                            console.log(`   ⏸️  Early stopping after ${trials.length} trials (no improvement)`)
                        }
                        break
                    }
                }

            } catch (error) {
                trials.push({
                    trialIndex: i,
                    configuration: config,
                    score: { primary: 0 },
                    status: 'failed',
                    error: error instanceof Error ? error.message : String(error),
                    duration: Date.now() - trialStart
                })

                // Store failure pattern for learning
                if (this.enableLearning) {
                    await this.storeFailedTrial(config, error)
                }
            }
        }

        // Find best trial
        const completedTrials = trials.filter(t => t.status === 'completed')

        if (completedTrials.length === 0) {
            throw new Error(
                `Optimization failed: All ${trials.length} trials failed. ` +
                `Last error: ${trials[trials.length - 1]?.error || 'Unknown error'}`
            )
        }

        const bestTrial = completedTrials.reduce((best, trial) =>
            trial.score.primary > best.score.primary ? trial : best
        )

        const elapsedTime = Date.now() - startTime

        // Generate insights
        if (this.config.verbose) {
            const warmStartBest = completedTrials
                .slice(0, warmStartConfigs.length)
                .reduce((max, t) => Math.max(max, t.score.primary), -Infinity)
            const explorationBest = completedTrials
                .slice(warmStartConfigs.length)
                .reduce((max, t) => Math.max(max, t.score.primary), -Infinity)

            console.log(`\n📊 Optimization Summary:`)
            console.log(`   Best warm-start score: ${warmStartBest.toFixed(4)}`)
            console.log(`   Best exploration score: ${explorationBest.toFixed(4)}`)
            console.log(`   Overall best: ${bestTrial.score.primary.toFixed(4)}`)
            console.log(`   Learning ${warmStartBest > explorationBest ? 'helped! 🎯' : 'potential 📈'}`)
        }

        return {
            bestConfiguration: bestTrial.configuration,
            bestScore: bestTrial.score,
            trialHistory: trials,
            convergencePlot: trials.map(t => t.score.primary),
            totalTrials: trials.length,
            elapsedTime,
            metadata: {
                optimizer: 'reasoningbank',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                warmStartConfigs: warmStartConfigs.length,
                explorationConfigs: explorationConfigs.length
            }
        }
    }

    async resume(_checkpointPath: string): Promise<OptimizationResult> {
        throw new Error('ReasoningBank optimizer does not support resume yet')
    }

    async getBestConfiguration(): Promise<ParameterConfiguration | null> {
        return this.currentBest
    }

    /**
     * Generate warm-start configurations from ReasoningBank patterns
     */
    private async generateWarmStartConfigs(
        searchSpace: SearchSpace,
        maxTrials: number
    ): Promise<ParameterConfiguration[]> {
        const warmStartCount = Math.floor(maxTrials * this.warmStartRatio)

        if (warmStartCount === 0) {
            return []
        }

        try {
            // Get successful trajectories from ReasoningBank
            const highConfidenceTrajectories = await this.reasoningBank.getTrajectories(
                this.expertRole,
                { verdict: 'success' }
            )

            const warmStartConfigs: ParameterConfiguration[] = []

            // Extract configurations from high-confidence trajectories
            for (const trajectory of highConfidenceTrajectories) {
                if (trajectory.confidence >= this.confidenceThreshold) {
                    const config = this.extractConfigFromTrajectory(trajectory, searchSpace)
                    if (config) {
                        warmStartConfigs.push(config)
                    }
                }

                if (warmStartConfigs.length >= warmStartCount) {
                    break
                }
            }

            // Fill remaining with random variations of successful configs
            while (warmStartConfigs.length < warmStartCount && warmStartConfigs.length > 0) {
                const baseConfig = warmStartConfigs[Math.floor(Math.random() * warmStartConfigs.length)]
                const variation = this.createVariation(baseConfig, searchSpace)
                warmStartConfigs.push(variation)
            }

            if (this.config.verbose && warmStartConfigs.length > 0) {
                console.log(
                    `   🎯 Found ${warmStartConfigs.length} warm-start configs from ` +
                    `${highConfidenceTrajectories.length} historical trials`
                )
            }

            return warmStartConfigs

        } catch (error) {
            if (this.config.verbose) {
                console.warn(`   ⚠️  Could not load warm-start configs:`, error)
            }
            return []
        }
    }

    /**
     * Extract parameter configuration from learning trajectory
     */
    private extractConfigFromTrajectory(
        trajectory: LearningTrajectory,
        searchSpace: SearchSpace
    ): ParameterConfiguration | null {
        try {
            // Try to extract config from trajectory context or outcome
            const config: ParameterConfiguration = {}
            const source = trajectory.context.configuration || trajectory.outcome.configuration || {}

            for (const param of searchSpace.parameters) {
                if (source[param.name] !== undefined) {
                    // Validate against search space constraints
                    const value = source[param.name]

                    if (param.type === 'range' && param.bounds) {
                        const [min, max] = param.bounds
                        if (value >= min && value <= max) {
                            config[param.name] = value
                        } else {
                            return null // Invalid config
                        }
                    } else if (param.type === 'choice' && param.values) {
                        if (param.values.includes(value)) {
                            config[param.name] = value
                        } else {
                            return null // Invalid config
                        }
                    } else if (param.type === 'fixed') {
                        config[param.name] = param.value
                    } else {
                        config[param.name] = value
                    }
                } else {
                    return null // Incomplete config
                }
            }

            return Object.keys(config).length === searchSpace.parameters.length ? config : null

        } catch {
            return null
        }
    }

    /**
     * Create variation of a configuration (for exploration around successful configs)
     */
    private createVariation(
        baseConfig: ParameterConfiguration,
        searchSpace: SearchSpace
    ): ParameterConfiguration {
        const variation = { ...baseConfig }

        // Randomly vary 1-2 parameters
        const paramsToVary = Math.min(2, Math.max(1, Math.floor(Math.random() * searchSpace.parameters.length)))
        const paramIndices = new Set<number>()

        while (paramIndices.size < paramsToVary) {
            paramIndices.add(Math.floor(Math.random() * searchSpace.parameters.length))
        }

        for (const idx of paramIndices) {
            const param = searchSpace.parameters[idx]

            if (param.type === 'range' && param.bounds) {
                const [min, max] = param.bounds
                const currentValue = variation[param.name]
                const range = max - min
                const noise = (Math.random() - 0.5) * range * 0.2 // ±10% variation

                if (param.log_scale) {
                    variation[param.name] = Math.exp(Math.log(currentValue) + noise)
                } else {
                    variation[param.name] = Math.max(min, Math.min(max, currentValue + noise))
                }
            } else if (param.type === 'choice' && param.values) {
                variation[param.name] = param.values[Math.floor(Math.random() * param.values.length)]
            }
        }

        return variation
    }

    /**
     * Generate exploration configs using grid search
     */
    private generateExplorationConfigs(
        searchSpace: SearchSpace,
        count: number
    ): ParameterConfiguration[] {
        if (count <= 0) {
            return []
        }

        const configs: ParameterConfiguration[] = []

        // Generate grid points
        const parameterGrids: Array<{ name: string; values: any[] }> = []

        for (const param of searchSpace.parameters) {
            if (param.type === 'range' && param.bounds) {
                const gridSize = Math.min(5, Math.ceil(Math.pow(count, 1 / searchSpace.parameters.length)))
                const [min, max] = param.bounds
                const values: number[] = []

                for (let i = 0; i < gridSize; i++) {
                    if (param.log_scale) {
                        const logMin = Math.log(min)
                        const logMax = Math.log(max)
                        values.push(Math.exp(logMin + (i / (gridSize - 1)) * (logMax - logMin)))
                    } else {
                        values.push(min + (i / (gridSize - 1)) * (max - min))
                    }
                }

                parameterGrids.push({ name: param.name, values })

            } else if (param.type === 'choice' && param.values) {
                parameterGrids.push({ name: param.name, values: param.values })

            } else if (param.type === 'fixed') {
                parameterGrids.push({ name: param.name, values: [param.value] })
            }
        }

        // Generate Cartesian product
        const generate = (index: number, current: ParameterConfiguration) => {
            if (index === parameterGrids.length) {
                configs.push({ ...current })
                return
            }

            const { name, values } = parameterGrids[index]
            for (const value of values) {
                if (configs.length < count) {
                    generate(index + 1, { ...current, [name]: value })
                }
            }
        }

        generate(0, {})

        // If grid is larger than needed, sample uniformly
        if (configs.length > count) {
            const step = Math.floor(configs.length / count)
            return configs.filter((_, i) => i % step === 0).slice(0, count)
        }

        return configs
    }

    /**
     * Store successful trial to ReasoningBank for future learning
     */
    private async storeSuccessfulTrial(
        config: ParameterConfiguration,
        score: any,
        isWarmStart: boolean
    ): Promise<void> {
        try {
            const trajectory: LearningTrajectory = {
                id: `opt-${this.expertRole}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: new Date().toISOString(),
                expert_role: this.expertRole,
                context: {
                    configuration: config,
                    isWarmStart,
                    optimizer: 'reasoningbank'
                },
                action: 'parameter_optimization',
                outcome: {
                    score: score.primary,
                    configuration: config,
                    secondary: score.secondary
                },
                verdict: score.primary >= 0.9 ? 'success' : 'partial',
                confidence: score.primary,
                metadata: {
                    timestamp: Date.now()
                }
            }

            await this.reasoningBank.storeTrajectory(trajectory)

        } catch (error) {
            if (this.config.verbose) {
                console.warn(`   ⚠️  Could not store successful trial:`, error)
            }
        }
    }

    /**
     * Store failed trial to learn from mistakes
     */
    private async storeFailedTrial(
        config: ParameterConfiguration,
        error: any
    ): Promise<void> {
        try {
            const trajectory: LearningTrajectory = {
                id: `opt-fail-${this.expertRole}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                timestamp: new Date().toISOString(),
                expert_role: this.expertRole,
                context: {
                    configuration: config,
                    optimizer: 'reasoningbank'
                },
                action: 'parameter_optimization',
                outcome: {
                    error: error instanceof Error ? error.message : String(error),
                    configuration: config
                },
                verdict: 'failure',
                confidence: 0,
                metadata: {
                    timestamp: Date.now()
                }
            }

            await this.reasoningBank.storeTrajectory(trajectory)

        } catch (err) {
            // Silent fail for failure logging
        }
    }

    /**
     * Get learning insights for this optimizer
     */
    async getLearningInsights() {
        return await this.reasoningBank.getInsights(this.expertRole)
    }

    /**
     * Close ReasoningBank connections
     */
    close(): void {
        this.reasoningBank.close()
    }
}
