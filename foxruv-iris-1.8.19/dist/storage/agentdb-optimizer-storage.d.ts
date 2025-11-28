/**
 * AgentDB Optimizer Storage
 *
 * Persistent storage layer for DSPy optimizations using AgentDB's ReasoningBank.
 * Stores optimized signatures, few-shot examples, and performance metrics for
 * continuous learning and self-improvement.
 *
 * Architecture:
 * - Training: Python MIPROv2 → Store in AgentDB
 * - Production: Load optimized prompts from AgentDB (zero Python)
 * - Learning: Track quality improvements over time
 *
 * @module agentdb-optimizer-storage
 * @version 1.0.0
 */
import type { OptimizationResult } from '../clients/python-optimizer-client.js';
export interface StoredOptimization {
    expert_role: string;
    version: string;
    signature: {
        inputs: Array<{
            name: string;
            type: string;
            description?: string;
        }>;
        outputs: Array<{
            name: string;
            type: string;
            description?: string;
        }>;
        description?: string;
    };
    few_shot_examples: Array<{
        inputs: Record<string, any>;
        outputs: Record<string, any>;
    }>;
    performance_metrics: {
        quality_score: number;
        baseline_quality: number;
        improvement: number;
        num_examples: number;
        num_demos: number;
    };
    metadata: {
        training_timestamp: string;
        trials_completed: number;
        lm_provider: string;
        lm_model: string;
        storage_timestamp: string;
    };
}
export interface OptimizationHistory {
    expert_role: string;
    versions: Array<{
        version: string;
        quality_score: number;
        improvement: number;
        timestamp: string;
    }>;
    best_version: string;
    latest_version: string;
    total_improvements: number;
}
export declare class AgentDBOptimizerStorage {
    private reasoningBank;
    private storagePath;
    private initialized;
    constructor(options?: {
        agentdbPath?: string;
        autoInit?: boolean;
    });
    /**
     * Initialize AgentDB and ReasoningBank
     */
    initialize(): Promise<void>;
    /**
     * Store optimization result in AgentDB
     */
    storeOptimization(optimization: OptimizationResult, metadata?: {
        lm_provider?: string;
        lm_model?: string;
    }): Promise<{
        stored: boolean;
        version: string;
        storage_path: string;
    }>;
    /**
     * Load optimization from AgentDB
     */
    loadOptimization(expertRole: string, version?: string): Promise<StoredOptimization | null>;
    /**
     * Get optimization history for an expert
     */
    getOptimizationHistory(expertRole: string): Promise<OptimizationHistory | null>;
    /**
     * Update learning trajectory in AgentDB (if ReasoningBank is available)
     */
    private updateLearningTrajectory;
    /**
     * File-based storage fallback
     */
    private storeToFile;
    /**
     * File-based loading fallback
     */
    private loadFromFile;
    /**
     * List versions for an expert (file-based)
     */
    private listVersions;
    /**
     * Close ReasoningBank database connections
     */
    close(): void;
    /**
     * Get statistics across all experts
     */
    getGlobalStats(): Promise<{
        total_experts_trained: number;
        total_optimizations: number;
        avg_improvement: number;
        best_expert: string;
        latest_training: string;
    }>;
}
/**
 * Create AgentDB optimizer storage instance
 */
export declare function createOptimizerStorage(agentdbPath?: string): AgentDBOptimizerStorage;
/**
 * Store optimization with automatic initialization
 */
export declare function storeOptimization(optimization: OptimizationResult, agentdbPath?: string): Promise<boolean>;
/**
 * Load latest optimization for expert
 */
export declare function loadOptimization(expertRole: string, agentdbPath?: string): Promise<StoredOptimization | null>;
//# sourceMappingURL=agentdb-optimizer-storage.d.ts.map