/**
 * Learning System Manager
 *
 * Unified interface for the complete learning system.
 * Coordinates tracking, pattern learning, memory, and adaptive optimization.
 */
import { MCPInvocationTracker } from './tracker.js';
import { PatternLearner } from './patterns.js';
import { MCPMemorySystem } from './memory.js';
import { AdaptiveOptimizer } from './adaptive.js';
import type { MCPInvocation, MCPServerMetadata, LearningSystemConfig, SystemMetrics, HealthStatus, LearningFeedback } from './types.js';
export declare class LearningSystemManager {
    private tracker;
    private patternLearner;
    private memory;
    private adaptive;
    private config;
    constructor(config?: LearningSystemConfig);
    /**
     * Track a new MCP invocation
     */
    trackInvocation(invocation: MCPInvocation): Promise<void>;
    /**
     * Register a new MCP server
     */
    registerServer(server: MCPServerMetadata): Promise<void>;
    /**
     * Search for tools
     */
    searchTools(query: string, limit?: number): Promise<import("./types.js").SearchResult<import("./types.js").MCPToolMetadata>[]>;
    /**
     * Get tool recommendations based on context
     */
    getRecommendations(context: string, currentTools: string[], limit?: number): Promise<import("./types.js").PatternRecommendation[]>;
    /**
     * Record user feedback
     */
    recordFeedback(feedback: LearningFeedback): Promise<void>;
    /**
     * Get system metrics
     */
    getMetrics(): Promise<SystemMetrics>;
    /**
     * Get system health status
     */
    getHealthStatus(): Promise<HealthStatus>;
    /**
     * Get optimization suggestions
     */
    getOptimizationSuggestions(): Promise<import("./types.js").OptimizationSuggestion[]>;
    /**
     * Get anti-patterns to avoid
     */
    getAntiPatterns(): Promise<import("./types.js").AntiPattern[]>;
    /**
     * Export all learning data
     */
    exportAllData(outputDir: string): Promise<void>;
    /**
     * Cleanup old data
     */
    cleanup(olderThanDays?: number): Promise<void>;
    /**
     * Get component instances (for advanced usage)
     */
    getComponents(): {
        tracker: MCPInvocationTracker;
        patternLearner: PatternLearner;
        memory: MCPMemorySystem;
        adaptive: AdaptiveOptimizer;
    };
    private determineHealth;
}
//# sourceMappingURL=manager.d.ts.map