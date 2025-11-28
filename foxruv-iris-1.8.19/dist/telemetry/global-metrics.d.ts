/**
 * Global Metrics - Universal Telemetry Collection & Drift Detection
 *
 * Central telemetry system for tracking expert performance across all projects.
 * Provides real-time drift detection, performance analytics, and alert generation.
 *
 * Features:
 * - Cross-project metrics aggregation
 * - Real-time drift detection
 * - Performance degradation alerts
 * - Prompt version tracking
 * - Consensus score analysis
 * - Automatic retraining triggers
 *
 * ARCHITECTURE:
 * - Supabase: Authoritative source of truth (cloud-based persistence)
 * - AgentDB: Optional local cache for fast reads (150x faster queries)
 *
 * @module global-metrics
 * @version 2.0.0
 */
/**
 * Telemetry event schema
 */
export interface TelemetryEvent {
    project: string;
    expertId: string;
    version: string;
    timestamp: Date;
    confidence: number;
    outcome: 'correct' | 'incorrect' | 'partial' | 'unknown';
    durationMs: number;
    reflexionUsed: boolean;
    consensusParticipation: boolean;
    metadata?: Record<string, any>;
}
/**
 * Performance metrics for an expert
 */
export interface ExpertMetrics {
    expertId: string;
    project: string;
    version: string;
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    avgConfidence: number;
    avgDuration: number;
    recentTrend: 'improving' | 'stable' | 'declining';
    lastUpdated: Date;
}
/**
 * Drift detection result
 */
export interface DriftAlert {
    alertId: string;
    project: string;
    expertId: string;
    version: string;
    severityLevel: 'info' | 'warning' | 'critical';
    driftType: 'accuracy' | 'confidence' | 'latency' | 'volume';
    message: string;
    currentValue: number;
    baselineValue: number;
    percentageChange: number;
    timestamp: Date;
    recommendations: string[];
    triggerRetraining: boolean;
}
/**
 * Aggregated cross-project metrics
 */
export interface CrossProjectMetrics {
    expertType: string;
    totalProjects: number;
    totalExperts: number;
    avgAccuracy: number;
    bestPerformingProject: string;
    bestPerformingExpert: string;
    recentAlerts: number;
}
/**
 * Configuration for global metrics
 */
export interface GlobalMetricsConfig {
    dbPath?: string;
    driftThreshold?: number;
    driftWindow?: number;
    alertRetentionDays?: number;
    enableAutoRetraining?: boolean;
    useSupabase?: boolean;
    enableAgentDBCache?: boolean;
}
/**
 * Global Metrics Collector
 */
export declare class GlobalMetricsCollector {
    private db;
    private config;
    private useSupabase;
    private useAgentDBCache;
    private agentDbReady;
    constructor(config?: GlobalMetricsConfig);
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    private initializeAgentDb;
    /**
     * Ensure AgentDB (if enabled) has finished initializing
     */
    private ensureAgentDbReady;
    /**
     * Convenience helper to get initialized DB instance
     */
    private getDb;
    /**
     * Log telemetry event
     * WRITES TO SUPABASE FIRST, then optionally to AgentDB cache
     */
    logEvent(event: TelemetryEvent): Promise<void>;
    /**
     * Batch log multiple events
     */
    logEventsBatch(events: TelemetryEvent[]): Promise<void>;
    /**
     * Update expert metrics based on recent events
     * NOTE: Only updates AgentDB cache, Supabase metrics are computed on-demand via getExpertStats()
     */
    private updateExpertMetrics;
    /**
     * Calculate performance trend
     */
    private calculateTrend;
    /**
     * Check for drift and create alerts if needed
     * USES SUPABASE detectDrift() when available
     */
    private checkForDrift;
    /**
     * Check single metric for drift
     */
    private checkMetricDrift;
    /**
     * Create drift alert (stores in AgentDB only - Supabase doesn't have drift_alerts table)
     */
    private createDriftAlert;
    /**
     * Generate recommendations based on drift
     */
    private generateDriftRecommendations;
    /**
     * Get expert metrics
     * READS FROM SUPABASE FIRST, falls back to AgentDB cache
     */
    getExpertMetrics(project: string, expertId: string, version: string): Promise<ExpertMetrics | null>;
    /**
     * Get all metrics for a project
     * READS FROM SUPABASE FIRST, falls back to AgentDB cache
     */
    getProjectMetrics(project: string): Promise<ExpertMetrics[]>;
    /**
     * Get cross-project metrics for an expert type
     */
    getCrossProjectMetrics(expertType: string): Promise<CrossProjectMetrics>;
    /**
     * Get unacknowledged drift alerts
     * NOTE: Alerts are stored locally in AgentDB since Supabase doesn't have drift_alerts table
     */
    getUnacknowledgedAlerts(project?: string): Promise<DriftAlert[]>;
    /**
     * Acknowledge alert
     */
    acknowledgeAlert(alertId: string): Promise<void>;
    /**
     * Clean up old data (AgentDB cache only)
     */
    cleanup(): Promise<void>;
    /**
     * Close database connection
     */
    close(): void;
}
/**
 * Create global metrics collector
 */
export declare function createGlobalMetrics(config?: GlobalMetricsConfig): GlobalMetricsCollector;
//# sourceMappingURL=global-metrics.d.ts.map