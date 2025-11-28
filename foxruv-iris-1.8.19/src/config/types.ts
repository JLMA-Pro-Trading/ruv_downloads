/**
 * Iris Configuration Types
 * 
 * Definitions for the iris-config.yaml file structure.
 * 
 * @module config/types
 */

import type { SearchSpace } from '../optimizers/base-optimizer.js'

export interface IrisConfig {
    project?: ProjectConfig
    optimization?: OptimizationConfig
    storage?: StorageConfig
}

export interface ProjectConfig {
    name?: string
    domain?: string
    description?: string
}

export interface OptimizationConfig {
    /**
     * Ordered list of preferred optimizers (e.g., ['ax', 'dspy', 'grid'])
     */
    strategy?: string[]
    
    /**
     * Default search space for the project
     */
    searchSpace?: SearchSpace
    
    /**
     * Ax-specific configuration
     */
    ax?: {
        maxTrials?: number
        parallelism?: number
        checkpointInterval?: number
        searchStrategy?: 'bayesian' | 'evolutionary'
        baseUrl?: string
    }
    
    /**
     * DSPy-specific configuration
     */
    dspy?: {
        maxTrials?: number
        numCandidates?: number
        baseUrl?: string
    }

    /**
     * General optimizer options
     */
    options?: {
        maxTrials?: number
        timeout?: number
        checkpointInterval?: number
    }
}

export interface StorageConfig {
    /**
     * Storage backends to use (e.g., ['agentdb', 'sqlite'])
     */
    backend?: string[]
    
    /**
     * Path to storage file/directory
     */
    path?: string
    
    /**
     * Supabase configuration (optional override)
     */
    supabase?: {
        url?: string
        key?: string
    }
}
