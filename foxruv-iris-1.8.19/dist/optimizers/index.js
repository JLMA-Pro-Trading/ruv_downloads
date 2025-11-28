/**
 * Optimizers Module
 *
 * Exports all optimizer implementations and utilities.
 *
 * @module optimizers
 * @version 1.0.0
 */
import { BaseOptimizer } from './base-optimizer.js';
// Export types and base class
export { BaseOptimizer };
// Optimizer implementations
export { GridSearchOptimizer } from './grid-search-optimizer.js';
export { ParallelGridOptimizer } from './parallel-grid-optimizer.js';
export { ReasoningBankOptimizer } from './reasoningbank-optimizer.js';
export { TsDspyOptimizer, AnthropicLM } from './ts-dspy-optimizer.js';
// Registry
export { OptimizerRegistry } from './optimizer-registry.js';
// Convenience functions
export async function createOptimizer(name, config) {
    const { OptimizerRegistry } = await import('./optimizer-registry.js');
    return await OptimizerRegistry.get(name, config);
}
export async function getBestOptimizer(preferences, config) {
    const { OptimizerRegistry } = await import('./optimizer-registry.js');
    return await OptimizerRegistry.getBestAvailable(preferences, config);
}
