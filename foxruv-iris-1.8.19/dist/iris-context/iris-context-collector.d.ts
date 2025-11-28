/**
 * Iris Context Collector
 *
 * Collects and stores context events from various sources for automatic
 * Iris invocation. Integrates with AgentDB for fast vector search
 * and Supabase for cloud persistence.
 *
 * @module iris-context-collector
 * @version 1.0.0
 */
/**
 * Context event for Iris invocation
 */
export interface IrisContextEvent {
    id: string;
    eventType: 'task_completion' | 'error' | 'deployment' | 'drift_detected' | 'consensus_failure' | 'pattern_match' | 'threshold_breach';
    project: string;
    expertId?: string;
    timestamp: Date;
    severity: 'info' | 'warning' | 'critical';
    eventData: Record<string, any>;
    contextType: 'performance' | 'error' | 'deployment' | 'consensus';
    tags?: string[];
    embedding?: number[];
    aggregationKey?: string;
    windowStart?: Date;
    windowEnd?: Date;
}
/**
 * Performance metrics snapshot
 */
export interface PerformanceMetricsSnapshot {
    project: string;
    expertId: string;
    version: string;
    timestamp: Date;
    windowSize: number;
    successRate: number;
    avgConfidence: number;
    avgLatencyMs: number;
    totalPredictions: number;
    driftScore: number;
    qualityScore: number;
    baselineSuccessRate?: number;
    baselineConfidence?: number;
    percentageChange?: number;
    totalTokensUsed: number;
    avgTokensPerPrediction: number;
    metadata?: Record<string, any>;
}
/**
 * Trigger condition definition
 */
export interface TriggerCondition {
    triggerId: string;
    name: string;
    description?: string;
    enabled: boolean;
    priority: number;
    conditionType: 'threshold' | 'pattern' | 'anomaly' | 'schedule';
    conditionSpec: ThresholdCondition | PatternCondition | AnomalyCondition | ScheduleCondition;
    projectFilter?: string;
    expertFilter?: string;
    actionType: 'evaluate' | 'retrain' | 'notify' | 'full_analysis';
    actionConfig?: Record<string, any>;
    cooldownSeconds: number;
    lastTriggered?: Date;
    triggerCount: number;
}
/**
 * Threshold-based condition
 */
export interface ThresholdCondition {
    metric: 'success_rate' | 'confidence' | 'latency' | 'drift_score';
    operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
    value: number;
    windowSize: number;
    minSamples?: number;
}
/**
 * Pattern-based condition
 */
export interface PatternCondition {
    patternId: string;
    minConfidence: number;
    minOccurrences?: number;
}
/**
 * Anomaly-based condition
 */
export interface AnomalyCondition {
    metric: string;
    stdDevThreshold: number;
    windowSize: number;
    baselineWindow: number;
}
/**
 * Schedule-based condition
 */
export interface ScheduleCondition {
    cronExpression: string;
    timezone?: string;
}
/**
 * Expert behavior pattern
 */
export interface ExpertBehaviorPattern {
    patternId: string;
    project: string;
    expertId?: string;
    patternType: 'success_sequence' | 'failure_chain' | 'drift_precursor' | 'recovery_pattern' | 'degradation_pattern';
    patternSignature: string;
    patternData: {
        events: Array<{
            type: string;
            minOccurrences: number;
            maxTimeGap?: number;
        }>;
        sequence: 'ordered' | 'unordered';
        timeWindow: number;
    };
    embedding?: number[];
    occurrenceCount: number;
    confidence: number;
    predictivePower: number;
    avgDurationSeconds?: number;
    firstObserved: Date;
    lastObserved: Date;
    associatedTriggers?: string[];
    metadata?: Record<string, any>;
}
/**
 * Temporal aggregation
 */
export interface TemporalAggregation {
    aggregationType: 'hourly' | 'daily' | 'weekly';
    project: string;
    expertId?: string;
    windowStart: Date;
    windowEnd: Date;
    totalEvents: number;
    criticalEvents: number;
    warningEvents: number;
    avgSuccessRate?: number;
    avgConfidence?: number;
    avgLatencyMs?: number;
    driftAlerts: number;
    consensusFailures: number;
    retrainingTriggers: number;
    trendDirection: 'improving' | 'stable' | 'declining';
    trendMagnitude: number;
    summaryStats: Record<string, any>;
}
/**
 * Configuration for context collector
 */
export interface IrisContextCollectorConfig {
    dbPath?: string;
    agentDBPath?: string;
    enableVectorSearch?: boolean;
    useSupabase?: boolean;
    cacheTTL?: number;
}
/**
 * Iris Context Collector
 *
 * Collects and stores context events from various sources for automatic
 * Iris invocation.
 */
export declare class IrisContextCollector {
    private db;
    private agentDB?;
    private config;
    private agentDbReady;
    private metricsCache;
    constructor(config?: IrisContextCollectorConfig);
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    private initializeAgentDb;
    /**
     * Ensure AgentDB is ready
     */
    private ensureAgentDbReady;
    /**
     * Get initialized DB instance
     */
    private getDb;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Record a context event
     */
    recordEvent(event: Omit<IrisContextEvent, 'id' | 'embedding'>): Promise<string>;
    /**
     * Record a batch of events
     */
    recordEventsBatch(events: Omit<IrisContextEvent, 'id' | 'embedding'>[]): Promise<string[]>;
    /**
     * Record performance metrics snapshot
     */
    recordPerformanceMetrics(metrics: PerformanceMetricsSnapshot): Promise<void>;
    /**
     * Register a trigger condition
     */
    registerTrigger(trigger: Omit<TriggerCondition, 'triggerCount' | 'lastTriggered'>): Promise<string>;
    /**
     * Update trigger condition
     */
    updateTrigger(triggerId: string, updates: Partial<TriggerCondition>): Promise<void>;
    /**
     * Get all active triggers
     */
    getActiveTriggers(project?: string): Promise<TriggerCondition[]>;
    /**
     * Get recent events by type
     */
    getRecentEvents(eventType: string, project?: string, expertId?: string, limit?: number): Promise<IrisContextEvent[]>;
    /**
     * Get events in time window
     */
    getEventsInWindow(project: string, windowStart: Date, windowEnd: Date, filters?: {
        eventType?: string;
        expertId?: string;
        severity?: string;
    }): Promise<IrisContextEvent[]>;
    /**
     * Get latest metrics for expert
     */
    getLatestMetrics(project: string, expertId: string, version: string): Promise<PerformanceMetricsSnapshot | null>;
    /**
     * Generate aggregation key
     */
    private generateAggregationKey;
    /**
     * Convert DB row to context event
     */
    private rowToContextEvent;
    /**
     * Convert DB row to metrics snapshot
     */
    private rowToMetricsSnapshot;
    /**
     * Close database connections
     */
    close(): void;
}
/**
 * Factory function to create collector instance
 */
export declare function createIrisContextCollector(config?: IrisContextCollectorConfig): IrisContextCollector;
//# sourceMappingURL=iris-context-collector.d.ts.map