/**
 * Optimizer Registry
 *
 * Central plugin system for managing optimizers.
 * Handles registration, instantiation, health checking, and fallback.
 *
 * @module optimizers/optimizer-registry
 * @version 1.0.0
 */
import type { BaseOptimizer, OptimizerConfig } from './base-optimizer.js';
/**
 * Central registry for all optimization strategies
 */
export declare class OptimizerRegistry {
    private static optimizers;
    private static instances;
    /**
     * Register an optimizer class
     *
     * @param name - Optimizer identifier (e.g., 'ax', 'dspy', 'grid')
     * @param OptimizerClass - Class that extends BaseOptimizer
     */
    static register(name: string, OptimizerClass: new (config: OptimizerConfig) => BaseOptimizer): void;
    /**
     * Get optimizer by name (lazy instantiation)
     *
     * @param name - Optimizer identifier
     * @param config - Optional configuration
     * @returns Optimizer instance or null if not available/healthy
     */
    static get(name: string, config?: OptimizerConfig): Promise<BaseOptimizer | null>;
    /**
     * Get best available optimizer from preference list
     *
     * @param preferences - Ordered list of optimizer names (tries in order)
     * @param config - Optional configuration
     * @returns First available optimizer, or grid search as final fallback
     */
    static getBestAvailable(preferences: string[], config?: OptimizerConfig): Promise<BaseOptimizer>;
    /**
     * List all registered optimizers
     *
     * @returns Array of optimizer names
     */
    static listRegistered(): string[];
    /**
     * List all available (healthy) optimizers
     *
     * @returns Array of optimizer names that passed health check
     */
    static listAvailable(): Promise<string[]>;
    /**
     * Get metadata for all registered optimizers
     */
    static getAllMetadata(): Promise<Array<{
        name: string;
        metadata: any;
        available: boolean;
    }>>;
    private static loadingPromise;
    /**
     * Load optional optimizer plugins (Async)
     * Call this before listRegistered() if you need to ensure all plugins are loaded.
     */
    static loadPlugins(): Promise<void>;
}
//# sourceMappingURL=optimizer-registry.d.ts.map