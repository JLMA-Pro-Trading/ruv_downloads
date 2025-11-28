/**
 * MCP Tool Invocation Tracker
 *
 * Tracks all MCP tool invocations with comprehensive metrics:
 * - Success/failure rates
 * - Latency and performance metrics
 * - Usage patterns
 * - Error patterns and diagnostics
 *
 * Uses AgentDB for persistent storage and analysis
 */
import type { MCPInvocation, ToolMetrics, UsagePattern } from './types.js';
export declare class MCPInvocationTracker {
    private db;
    private invocations;
    private metricsCache;
    private cacheExpiry;
    private lastCacheUpdate;
    constructor(dbPath?: string);
    /**
     * Initialize database schema for tracking
     */
    private initializeSchema;
    /**
     * Track a new MCP tool invocation
     */
    trackInvocation(invocation: MCPInvocation): Promise<void>;
    /**
     * Track error patterns for diagnostics
     */
    private trackErrorPattern;
    /**
     * Extract error type from error message
     */
    private extractErrorType;
    /**
     * Get comprehensive metrics for a tool
     */
    getToolMetrics(toolId: string, forceRefresh?: boolean): Promise<ToolMetrics | null>;
    /**
     * Get all tool metrics
     */
    getAllToolMetrics(): Promise<ToolMetrics[]>;
    /**
     * Analyze usage patterns across invocations
     */
    analyzeUsagePatterns(timeWindowMs?: number): Promise<UsagePattern[]>;
    /**
     * Get invocations for a specific session
     */
    getSessionInvocations(sessionId: string): Promise<MCPInvocation[]>;
    /**
     * Get recent invocations
     */
    getRecentInvocations(limit?: number): Promise<MCPInvocation[]>;
    /**
     * Get performance trends over time
     */
    getPerformanceTrends(toolId: string, intervalMs?: number): Promise<any[]>;
    /**
     * Calculate metrics for a time bucket
     */
    private calculateBucketMetrics;
    /**
     * Convert database row to MCPInvocation
     */
    private rowToInvocation;
    /**
     * Clear old data
     */
    clearOldData(olderThanMs: number): Promise<number>;
    /**
     * Export tracking data for analysis
     */
    exportData(outputPath: string): Promise<void>;
}
//# sourceMappingURL=tracker.d.ts.map