/**
 * Optimizer Registry
 * 
 * Central plugin system for managing optimizers.
 * Handles registration, instantiation, health checking, and fallback.
 * 
 * @module optimizers/optimizer-registry
 * @version 1.0.0
 */

import type { BaseOptimizer, OptimizerConfig } from './base-optimizer.js'

/**
 * Central registry for all optimization strategies
 */
export class OptimizerRegistry {
    private static optimizers = new Map<string, new (config: OptimizerConfig) => BaseOptimizer>()
    private static instances = new Map<string, BaseOptimizer>()

    /**
     * Register an optimizer class
     * 
     * @param name - Optimizer identifier (e.g., 'ax', 'dspy', 'grid')
     * @param OptimizerClass - Class that extends BaseOptimizer
     */
    static register(name: string, OptimizerClass: new (config: OptimizerConfig) => BaseOptimizer): void {
        this.optimizers.set(name, OptimizerClass)
    }

    /**
     * Get optimizer by name (lazy instantiation)
     * 
     * @param name - Optimizer identifier
     * @param config - Optional configuration
     * @returns Optimizer instance or null if not available/healthy
     */
    static async get(name: string, config?: OptimizerConfig): Promise<BaseOptimizer | null> {
        // Check if already instantiated
        const cacheKey = `${name}-${JSON.stringify(config || {})}`
        if (this.instances.has(cacheKey)) {
            return this.instances.get(cacheKey)!
        }

        // Get class
        const OptimizerClass = this.optimizers.get(name)
        if (!OptimizerClass) {
            console.warn(`⚠️  Optimizer '${name}' not registered`)
            return null
        }

        // Instantiate
        const instance = new OptimizerClass(config || {})

        // Health check
        const healthy = await instance.healthCheck()
        if (!healthy) {
            const metadata = instance.getMetadata()
            console.warn(
                `⚠️  Optimizer '${name}' failed health check (missing dependencies: ${metadata.dependencies.join(', ')})`
            )
            return null
        }

        // Cache
        this.instances.set(cacheKey, instance)
        return instance
    }

    /**
     * Get best available optimizer from preference list
     * 
     * @param preferences - Ordered list of optimizer names (tries in order)
     * @param config - Optional configuration
     * @returns First available optimizer, or grid search as final fallback
     */
    static async getBestAvailable(
        preferences: string[],
        config?: OptimizerConfig
    ): Promise<BaseOptimizer> {
        for (const name of preferences) {
            const optimizer = await this.get(name, config)
            if (optimizer) {
                console.log(`✅ Using optimizer: ${name}`)
                return optimizer
            }
        }

        // Final fallback to grid search
        console.warn('⚠️  No preferred optimizer available, falling back to grid search')
        const gridSearch = await this.get('grid', config)

        if (!gridSearch) {
            throw new Error('Grid search optimizer not available (should never happen)')
        }

        return gridSearch
    }

    /**
     * List all registered optimizers
     * 
     * @returns Array of optimizer names
     */
    static listRegistered(): string[] {
        return Array.from(this.optimizers.keys())
    }

    /**
     * List all available (healthy) optimizers
     * 
     * @returns Array of optimizer names that passed health check
     */
    static async listAvailable(): Promise<string[]> {
        const available: string[] = []

        for (const name of this.optimizers.keys()) {
            const optimizer = await this.get(name)
            if (optimizer) {
                available.push(name)
            }
        }

        return available
    }

    /**
     * Get metadata for all registered optimizers
     */
    static async getAllMetadata(): Promise<Array<{ name: string; metadata: any; available: boolean }>> {
        const results: Array<{ name: string; metadata: any; available: boolean }> = []

        for (const [name, OptimizerClass] of this.optimizers) {
            const instance = new OptimizerClass({})
            const metadata = instance.getMetadata()
            const healthy = await instance.healthCheck()

            results.push({
                name,
                metadata,
                available: healthy
            })
        }

        return results
    }

    private static loadingPromise: Promise<void> | null = null

    /**
     * Load optional optimizer plugins (Async)
     * Call this before listRegistered() if you need to ensure all plugins are loaded.
     */
    static async loadPlugins(): Promise<void> {
        if (this.loadingPromise) return this.loadingPromise

        this.loadingPromise = (async () => {
            try {
                const axModule = await import('./ax-optimizer.js')
                OptimizerRegistry.register('ax', axModule.AxOptimizer)
            } catch (error) {
                // Ax not available
                console.error('⚠️ Failed to load Ax plugin:', error)
            }

            try {
                const { DSPyOptimizer } = await import('./dspy-optimizer.js')
                OptimizerRegistry.register('dspy', DSPyOptimizer)
            } catch (error) {
                // DSPy not available
                console.error('⚠️ Failed to load DSPy plugin:', error)
            }
        })()

        return this.loadingPromise
    }
}

// ============================================================================
// Auto-register built-in optimizers
// ============================================================================

// Grid search (always available, no dependencies)
import { GridSearchOptimizer } from './grid-search-optimizer.js'
OptimizerRegistry.register('grid', GridSearchOptimizer)

// Parallel grid search (falls back to sequential if workers unavailable)
import { ParallelGridOptimizer } from './parallel-grid-optimizer.js'
OptimizerRegistry.register('parallel-grid', ParallelGridOptimizer)

// ReasoningBank optimizer (always available, learns from past experience)
import { ReasoningBankOptimizer } from './reasoningbank-optimizer.js'
OptimizerRegistry.register('reasoningbank', ReasoningBankOptimizer)

// TypeScript DSPy optimizer (native TS, no Python required)
import { TsDspyOptimizer } from './ts-dspy-optimizer.js'
OptimizerRegistry.register('ts-dspy', TsDspyOptimizer)

// Start loading plugins (fire and forget for standard usage)
OptimizerRegistry.loadPlugins()
