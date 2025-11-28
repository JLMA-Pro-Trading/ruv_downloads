/**
 * Adaptive Optimization System
 *
 * Self-healing and adaptive optimization for MCP wrappers:
 * - Auto-optimize based on usage patterns
 * - Self-healing on errors
 * - Adaptive wrapper generation
 * - Performance and quality suggestions
 *
 * Uses AgentDB's learning algorithms and reasoning systems
 */
import type { AdaptiveStrategy, OptimizationSuggestion, SelfHealingAction, LearningFeedback, ToolMetrics } from './types.js';
import { MCPInvocationTracker } from './tracker.js';
import { PatternLearner } from './patterns.js';
import { MCPMemorySystem } from './memory.js';
export declare class AdaptiveOptimizer {
    private db;
    private reasoningBank;
    private reflexion;
    private skillLibrary;
    private learningSystem;
    private tracker;
    private patternLearner;
    private memory;
    private strategies;
    private healingHistory;
    constructor(dbPath: string | undefined, tracker: MCPInvocationTracker, patternLearner: PatternLearner, memory: MCPMemorySystem);
    /**
     * Initialize database schema
     */
    private initializeSchema;
    /**
     * Load adaptive strategies
     */
    private loadStrategies;
    /**
     * Register default adaptive strategies
     */
    private registerDefaultStrategies;
    /**
     * Add a new adaptive strategy
     */
    addStrategy(strategy: Omit<AdaptiveStrategy, 'id' | 'created' | 'lastTriggered' | 'triggerCount'>): string;
    /**
     * Analyze tool metrics and trigger adaptive strategies
     */
    analyzeAndAdapt(toolId: string): Promise<void>;
    /**
     * Check if strategy should be triggered
     */
    private shouldTriggerStrategy;
    /**
     * Detect specific patterns in metrics
     */
    private detectPattern;
    /**
     * Execute an adaptive strategy
     */
    private executeStrategy;
    /**
     * Regenerate wrapper for a server/tool
     */
    private regenerateWrapper;
    /**
     * Optimize existing wrapper
     */
    private optimizeWrapper;
    /**
     * Learn from failures using AgentDB's learning algorithms
     */
    private learnFromFailures;
    /**
     * Implement fallback strategy
     */
    private implementFallback;
    /**
     * Generate optimization suggestions
     */
    generateOptimizations(toolId: string, metrics: ToolMetrics, focus?: string): Promise<OptimizationSuggestion[]>;
    /**
     * Record learning feedback
     */
    recordFeedback(feedback: LearningFeedback): Promise<void>;
    /**
     * Get all suggestions
     */
    getAllSuggestions(appliedOnly?: boolean): Promise<OptimizationSuggestion[]>;
    /**
     * Get healing history
     */
    getHealingHistory(limit?: number): SelfHealingAction[];
    private storeHealingAction;
    private storeSuggestion;
}
//# sourceMappingURL=adaptive.d.ts.map