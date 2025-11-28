/**
 * TypeScript DSPy Optimizer
 *
 * Native TypeScript implementation using @ts-dspy/core.
 * No Python service required - runs entirely in TypeScript.
 *
 * Features:
 * - Type-safe signatures with validation
 * - Chain-of-thought reasoning
 * - Automatic prompt optimization
 * - Works with Anthropic, OpenAI, or custom LMs
 *
 * @module optimizers/ts-dspy-optimizer
 * @version 1.0.0
 */

import {
    BaseOptimizer,
    type SearchSpace,
    type EvaluationFunction,
    type OptimizationOptions,
    type OptimizationResult,
    type ParameterConfiguration,
    type OptimizerMetadata,
    type OptimizerConfig,
    type Trial
} from './base-optimizer.js'

import {
    Predict,
    ChainOfThought,
    Signature,
    InputField,
    OutputField,
    configure
} from '@ts-dspy/core'

import type {
    ILanguageModel,
    LLMCallOptions,
    ChatMessage,
    UsageStats,
    ModelCapabilities
} from '@ts-dspy/core'

// ============================================================================
// Anthropic Language Model Adapter
// ============================================================================

export interface AnthropicConfig {
    apiKey?: string
    model?: string
    maxTokens?: number
    temperature?: number
}

/**
 * Anthropic Claude adapter for ts-dspy
 */
export class AnthropicLM implements ILanguageModel {
    private apiKey: string
    private model: string
    private maxTokens: number
    private temperature: number
    private usage: UsageStats = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        requestCount: 0,
        errorCount: 0
    }

    constructor(config: AnthropicConfig = {}) {
        this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || ''
        this.model = config.model || 'claude-sonnet-4-20250514'
        this.maxTokens = config.maxTokens || 4096
        this.temperature = config.temperature || 0.7
    }

    async generate(prompt: string, options?: LLMCallOptions): Promise<string> {
        return this.chat([{ role: 'user', content: prompt }], options)
    }

    async generateStructured<T>(prompt: string, _schema: any, options?: LLMCallOptions): Promise<T> {
        const response = await this.generate(prompt, options)
        try {
            return JSON.parse(response) as T
        } catch {
            // Try to extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]) as T
            }
            throw new Error('Failed to parse structured output')
        }
    }

    async chat(messages: ChatMessage[], options?: LLMCallOptions): Promise<string> {
        const startTime = Date.now()

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: options?.model || this.model,
                    max_tokens: options?.maxTokens || this.maxTokens,
                    temperature: options?.temperature ?? this.temperature,
                    messages: messages.map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content
                    }))
                })
            })

            if (!response.ok) {
                this.usage.errorCount = (this.usage.errorCount || 0) + 1
                const error = await response.text()
                throw new Error(`Anthropic API error: ${response.status} - ${error}`)
            }

            const data = await response.json() as {
                content: Array<{ type: string; text: string }>
                usage: { input_tokens: number; output_tokens: number }
            }

            // Update usage stats
            this.usage.promptTokens += data.usage.input_tokens
            this.usage.completionTokens += data.usage.output_tokens
            this.usage.totalTokens += data.usage.input_tokens + data.usage.output_tokens
            this.usage.requestCount = (this.usage.requestCount || 0) + 1

            const latency = Date.now() - startTime
            this.usage.averageLatency = this.usage.averageLatency
                ? (this.usage.averageLatency + latency) / 2
                : latency

            return data.content[0]?.text || ''
        } catch (error) {
            this.usage.errorCount = (this.usage.errorCount || 0) + 1
            throw error
        }
    }

    getUsage(): UsageStats {
        return { ...this.usage }
    }

    resetUsage(): void {
        this.usage = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            requestCount: 0,
            errorCount: 0
        }
    }

    getCapabilities(): ModelCapabilities {
        return {
            supportsStreaming: true,
            supportsStructuredOutput: true,
            supportsFunctionCalling: true,
            supportsVision: true,
            maxContextLength: 200000,
            supportedFormats: ['text', 'json']
        }
    }

    getModelName(): string {
        return this.model
    }

    setModel(model: string): void {
        this.model = model
    }

    async isHealthy(): Promise<boolean> {
        return !!this.apiKey
    }
}

// ============================================================================
// Dynamic Signature Factory
// ============================================================================

/**
 * Create a dynamic signature class from configuration
 */
function createDynamicSignature(
    inputs: Array<{ name: string; description?: string }>,
    outputs: Array<{ name: string; description?: string }>,
    description?: string
): typeof Signature {
    // Create a new class extending Signature
    class DynamicSignature extends Signature {
        static description = description
    }

    // Add input fields
    for (const input of inputs) {
        InputField({ description: input.description || input.name })(DynamicSignature.prototype, input.name)
    }

    // Add output fields
    for (const output of outputs) {
        OutputField({ description: output.description || output.name })(DynamicSignature.prototype, output.name)
    }

    return DynamicSignature
}

// ============================================================================
// TypeScript DSPy Optimizer
// ============================================================================

export interface TsDspyOptimizerConfig extends OptimizerConfig {
    /** Language model to use */
    lm?: ILanguageModel
    /** Anthropic config (if not providing lm) */
    anthropicConfig?: AnthropicConfig
    /** Use chain-of-thought reasoning */
    useChainOfThought?: boolean
    /** Number of bootstrap demonstrations */
    numBootstrapDemos?: number
    /** Temperature for exploration */
    explorationTemperature?: number
}

export class TsDspyOptimizer extends BaseOptimizer {
    private lm: ILanguageModel
    private useChainOfThought: boolean
    private numBootstrapDemos: number
    private explorationTemperature: number

    constructor(config: TsDspyOptimizerConfig = {}) {
        super(config)

        // Initialize language model
        this.lm = config.lm || new AnthropicLM(config.anthropicConfig)
        this.useChainOfThought = config.useChainOfThought ?? true
        this.numBootstrapDemos = config.numBootstrapDemos ?? 4
        this.explorationTemperature = config.explorationTemperature ?? 0.7

        // Configure ts-dspy with our LM
        configure({ lm: this.lm })
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (this.lm.isHealthy) {
                return await this.lm.isHealthy()
            }
            // Try a simple generate
            const result = await this.lm.generate('Say "ok"', { maxTokens: 10 })
            return result.length > 0
        } catch {
            return false
        }
    }

    getMetadata(): OptimizerMetadata {
        return {
            name: 'ts-dspy',
            version: '1.0.0',
            capabilities: {
                supportsMultiObjective: false,
                supportsParallelTrials: true,
                supportsCheckpointing: false,
                searchStrategy: 'bayesian'
            },
            dependencies: ['@ts-dspy/core']
        }
    }

    async optimize(
        searchSpace: SearchSpace,
        evaluationFn: EvaluationFunction,
        options?: OptimizationOptions
    ): Promise<OptimizationResult> {
        const startTime = Date.now()
        const maxTrials = options?.maxTrials ?? 10
        const trials: Trial[] = []

        if (this.config.verbose) {
            console.log('🔮 TypeScript DSPy Optimization')
            console.log(`   Using: ${this.lm.getModelName()}`)
            console.log(`   Chain-of-Thought: ${this.useChainOfThought}`)
        }

        // Extract signature definition from search space
        const signatureConfig = this.extractSignatureConfig(searchSpace)

        // Create dynamic signature
        const SignatureClass = createDynamicSignature(
            signatureConfig.inputs,
            signatureConfig.outputs,
            signatureConfig.description
        )

        // Create module (Predict or ChainOfThought)
        const ModuleClass = this.useChainOfThought ? ChainOfThought : Predict
        const module = new ModuleClass(SignatureClass, this.lm)

        // Extract training examples if provided
        const trainingData = this.extractTrainingData(searchSpace)

        // Bootstrap optimization loop
        let bestConfig: ParameterConfiguration | null = null
        let bestScore = -Infinity

        for (let i = 0; i < maxTrials; i++) {
            const trialStart = Date.now()

            try {
                // Generate configuration variations
                const config = await this.generateConfiguration(
                    module,
                    signatureConfig,
                    trainingData,
                    i,
                    maxTrials
                )

                // Evaluate
                const score = await evaluationFn(config)
                const evaluationScore = typeof score === 'number'
                    ? { primary: score }
                    : score

                const trial: Trial = {
                    trialIndex: i,
                    configuration: config,
                    score: evaluationScore,
                    status: 'completed',
                    duration: Date.now() - trialStart
                }
                trials.push(trial)

                if (evaluationScore.primary > bestScore) {
                    bestScore = evaluationScore.primary
                    bestConfig = config

                    if (this.config.verbose) {
                        console.log(`   ✨ Trial ${i + 1}: New best score ${bestScore.toFixed(4)}`)
                    }
                } else if (this.config.verbose) {
                    console.log(`   📊 Trial ${i + 1}: Score ${evaluationScore.primary.toFixed(4)}`)
                }

            } catch (error) {
                const trial: Trial = {
                    trialIndex: i,
                    configuration: {},
                    score: { primary: 0 },
                    status: 'failed',
                    duration: Date.now() - trialStart,
                    error: error instanceof Error ? error.message : String(error)
                }
                trials.push(trial)

                if (this.config.verbose) {
                    console.log(`   ❌ Trial ${i + 1}: Failed - ${trial.error}`)
                }
            }
        }

        if (!bestConfig) {
            throw new Error('All trials failed - no valid configuration found')
        }

        const elapsedTime = Date.now() - startTime
        const usage = this.lm.getUsage()

        return {
            bestConfiguration: bestConfig,
            bestScore: { primary: bestScore },
            trialHistory: trials,
            totalTrials: trials.length,
            elapsedTime,
            metadata: {
                optimizer: 'ts-dspy',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                totalTokens: usage.totalTokens,
                model: this.lm.getModelName()
            }
        }
    }

    async resume(_checkpointPath: string): Promise<OptimizationResult> {
        throw new Error('Resume not supported for TypeScript DSPy optimizer')
    }

    async getBestConfiguration(): Promise<ParameterConfiguration | null> {
        // Not available during optimization
        return null
    }

    // ============================================================================
    // Private Helpers
    // ============================================================================

    private extractSignatureConfig(space: SearchSpace): {
        inputs: Array<{ name: string; description?: string }>
        outputs: Array<{ name: string; description?: string }>
        description?: string
    } {
        // Look for signature definition in fixed parameters
        const signatureParam = space.parameters.find(p => p.name === 'signature')

        if (signatureParam?.type === 'fixed' && signatureParam.value) {
            const sig = signatureParam.value as {
                inputs?: Array<{ name: string; description?: string }>
                outputs?: Array<{ name: string; description?: string }>
                description?: string
            }
            return {
                inputs: sig.inputs || [{ name: 'input', description: 'Input text' }],
                outputs: sig.outputs || [{ name: 'output', description: 'Output text' }],
                description: sig.description
            }
        }

        // Default signature for prompt optimization
        return {
            inputs: [
                { name: 'context', description: 'Context or background information' },
                { name: 'question', description: 'Question or task to complete' }
            ],
            outputs: [
                { name: 'answer', description: 'Response or solution' }
            ],
            description: 'Answer questions based on context'
        }
    }

    private extractTrainingData(space: SearchSpace): Array<{
        inputs: Record<string, any>
        outputs: Record<string, any>
    }> {
        const trainingParam = space.parameters.find(p => p.name === 'training_data')

        if (trainingParam?.type === 'fixed' && Array.isArray(trainingParam.value)) {
            return trainingParam.value
        }

        return []
    }

    private async generateConfiguration(
        module: Predict | ChainOfThought,
        signatureConfig: {
            inputs: Array<{ name: string; description?: string }>
            outputs: Array<{ name: string; description?: string }>
            description?: string
        },
        trainingData: Array<{ inputs: Record<string, any>; outputs: Record<string, any> }>,
        trialIndex: number,
        _maxTrials: number
    ): Promise<ParameterConfiguration> {
        // Bootstrap: use training examples to generate demonstrations
        const demos: string[] = []

        if (trainingData.length > 0) {
            // Select random subset for this trial
            const shuffled = [...trainingData].sort(() => Math.random() - 0.5)
            const selectedDemos = shuffled.slice(0, this.numBootstrapDemos)

            for (const example of selectedDemos) {
                const demoStr = Object.entries(example.inputs)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')
                const outputStr = Object.entries(example.outputs)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')
                demos.push(`Input:\n${demoStr}\n\nOutput:\n${outputStr}`)
            }
        }

        // Generate optimized prompt template
        const promptTemplate = await this.generatePromptTemplate(
            module,
            signatureConfig,
            demos,
            trialIndex
        )

        return {
            prompt_template: promptTemplate,
            demonstrations: demos,
            chain_of_thought: this.useChainOfThought,
            trial_index: trialIndex,
            model: this.lm.getModelName(),
            temperature: this.explorationTemperature
        }
    }

    private async generatePromptTemplate(
        _module: Predict | ChainOfThought,
        signatureConfig: {
            inputs: Array<{ name: string; description?: string }>
            outputs: Array<{ name: string; description?: string }>
            description?: string
        },
        demos: string[],
        trialIndex: number
    ): Promise<string> {
        // For first trial, use base template
        if (trialIndex === 0 || demos.length === 0) {
            const inputFields = signatureConfig.inputs
                .map(i => `${i.name}: {${i.name}}`)
                .join('\n')
            const outputFields = signatureConfig.outputs
                .map(o => `${o.name}:`)
                .join('\n')

            return `${signatureConfig.description || 'Complete the following task.'}

${inputFields}

${this.useChainOfThought ? 'Let me think step by step.\n\n' : ''}${outputFields}`
        }

        // For subsequent trials, use LM to optimize the template
        const optimizationPrompt = `You are optimizing a prompt template. Given these example demonstrations and the current template, suggest an improved version.

Current signature:
- Inputs: ${signatureConfig.inputs.map(i => i.name).join(', ')}
- Outputs: ${signatureConfig.outputs.map(o => o.name).join(', ')}
- Description: ${signatureConfig.description || 'N/A'}

Example demonstrations:
${demos.slice(0, 2).join('\n---\n')}

Generate an optimized prompt template that will produce better outputs. Include placeholders like {input_name} for inputs. Be concise but clear.`

        try {
            const optimizedTemplate = await this.lm.generate(optimizationPrompt, {
                temperature: this.explorationTemperature,
                maxTokens: 500
            })
            return optimizedTemplate
        } catch {
            // Fallback to base template
            return `${signatureConfig.description || 'Complete the task.'}

${signatureConfig.inputs.map(i => `${i.name}: {${i.name}}`).join('\n')}

${signatureConfig.outputs.map(o => `${o.name}:`).join('\n')}`
        }
    }
}
