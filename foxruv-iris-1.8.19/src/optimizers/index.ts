/**
 * Optimizers Module
 * 
 * Exports all optimizer implementations and utilities.
 * 
 * @module optimizers
 * @version 1.0.0
 */

import {
    BaseOptimizer,
    type SearchSpace,
    type Parameter,
    type Constraint,
    type EvaluationFunction,
    type ParameterConfiguration,
    type EvaluationScore,
    type OptimizationOptions,
    type OptimizationResult,
    type Trial,
    type OptimizerMetadata,
    type OptimizerConfig
} from './base-optimizer.js'

// Export types and base class
export {
    BaseOptimizer,
    type SearchSpace,
    type Parameter,
    type Constraint,
    type EvaluationFunction,
    type ParameterConfiguration,
    type EvaluationScore,
    type OptimizationOptions,
    type OptimizationResult,
    type Trial,
    type OptimizerMetadata,
    type OptimizerConfig
}

// Optimizer implementations
export { GridSearchOptimizer } from './grid-search-optimizer.js'
export { ParallelGridOptimizer } from './parallel-grid-optimizer.js'
export { ReasoningBankOptimizer, type ReasoningBankOptimizerConfig } from './reasoningbank-optimizer.js'
export { TsDspyOptimizer, AnthropicLM, type TsDspyOptimizerConfig, type AnthropicConfig } from './ts-dspy-optimizer.js'

// Registry
export { OptimizerRegistry } from './optimizer-registry.js'

// Convenience functions
export async function createOptimizer(
    name: string,
    config?: OptimizerConfig
): Promise<BaseOptimizer | null> {
    const { OptimizerRegistry } = await import('./optimizer-registry.js')
    return await OptimizerRegistry.get(name, config)
}

export async function getBestOptimizer(
    preferences: string[],
    config?: OptimizerConfig
): Promise<BaseOptimizer> {
    const { OptimizerRegistry } = await import('./optimizer-registry.js')
    return await OptimizerRegistry.getBestAvailable(preferences, config)
}