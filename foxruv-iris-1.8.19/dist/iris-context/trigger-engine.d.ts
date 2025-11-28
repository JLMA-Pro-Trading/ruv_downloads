/**
 * Iris Trigger Detection Engine
 *
 * Monitors metrics and events to determine when to invoke Iris for autonomous intervention.
 * Evaluates multiple trigger types and maintains priority queue with cooldown management.
 *
 * Features:
 * - Threshold-based triggers (static comparisons)
 * - Pattern-based triggers (sequence detection)
 * - Anomaly detection (statistical outliers)
 * - Schedule-based triggers (time-based)
 * - Priority queue with deduplication
 * - Cooldown management per trigger
 * - Rate limiting and backoff
 *
 * Integration:
 * - Polls IrisContextCollector for events
 * - Statistical analysis from consensus lineage
 *
 * @module trigger-engine
 * @version 1.0.0
 */
import { IrisContextCollector } from './iris-context-collector.js';
/**
 * Trigger condition types
 */
export type TriggerType = 'threshold' | 'pattern' | 'anomaly' | 'schedule';
/**
 * Threshold configuration
 */
export interface ThresholdConfig {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    value: number;
    window?: number;
    minSamples?: number;
}
/**
 * Pattern configuration
 */
export interface PatternConfig {
    eventSequence: string[];
    maxTimespan?: number;
    minOccurrences?: number;
    allowPartialMatch?: boolean;
}
/**
 * Anomaly detection configuration
 */
export interface AnomalyConfig {
    metric: string;
    method: 'zscore' | 'iqr' | 'mad';
    sensitivity: number;
    baselineWindow?: number;
    detectionWindow?: number;
    minSamples?: number;
}
/**
 * Schedule configuration
 */
export interface ScheduleConfig {
    cronExpression?: string;
    intervalSeconds?: number;
    startTime?: Date;
    endTime?: Date;
}
/**
 * Trigger condition union type
 */
export interface TriggerCondition {
    type: TriggerType;
    config: ThresholdConfig | PatternConfig | AnomalyConfig | ScheduleConfig;
}
/**
 * Trigger definition
 */
export interface TriggerDefinition {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    priority: number;
    condition: TriggerCondition;
    cooldownSeconds: number;
    maxInvocationsPerHour?: number;
    metadata?: Record<string, any>;
}
/**
 * Fired trigger result
 */
export interface FiredTrigger {
    triggerId: string;
    triggerName: string;
    priority: number;
    reason: string;
    context: Record<string, any>;
    timestamp: Date;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
/**
 * Trigger evaluation result
 */
export interface TriggerEvaluationResult {
    shouldTrigger: boolean;
    triggers: FiredTrigger[];
    nextEvaluationTime?: Date;
}
/**
 * Cooldown status
 */
export interface CooldownStatus {
    triggerId: string;
    isCoolingDown: boolean;
    lastInvoked?: Date;
    availableAt?: Date;
    remainingSeconds?: number;
}
export declare class TriggerDetector {
    private triggers;
    private invocationHistory;
    private contextCollector?;
    constructor(contextCollector?: IrisContextCollector);
    /**
     * Register a trigger
     */
    registerTrigger(trigger: TriggerDefinition): void;
    /**
     * Unregister a trigger
     */
    unregisterTrigger(triggerId: string): void;
    /**
     * Enable/disable trigger
     */
    setTriggerEnabled(triggerId: string, enabled: boolean): void;
    /**
     * Get all registered triggers
     */
    getTriggers(): TriggerDefinition[];
    /**
     * Evaluate all active triggers
     */
    evaluateTriggers(): Promise<TriggerEvaluationResult>;
    /**
     * Check if Iris should be invoked
     */
    shouldInvokeIris(): Promise<{
        shouldInvoke: boolean;
        trigger?: FiredTrigger;
        context: Record<string, any>;
    }>;
    /**
     * Record that Iris was invoked
     */
    recordInvocation(triggerId: string, context: Record<string, any>): void;
    /**
     * Get cooldown status for a trigger
     */
    getCooldownStatus(triggerId: string): CooldownStatus;
    /**
     * Evaluate a trigger condition
     */
    private evaluateCondition;
    /**
     * Evaluate threshold condition
     */
    private evaluateThreshold;
    /**
     * Evaluate pattern condition
     */
    private evaluatePattern;
    /**
     * Evaluate anomaly condition
     */
    private evaluateAnomaly;
    /**
     * Evaluate schedule condition
     */
    private evaluateSchedule;
    /**
     * Check if trigger is cooling down
     */
    private isCoolingDown;
    /**
     * Check if trigger is rate limited
     */
    private isRateLimited;
    /**
     * Calculate severity from priority and context
     */
    private calculateSeverity;
    /**
     * Deduplicate similar triggers
     */
    private deduplicateTriggers;
    /**
     * Calculate next evaluation time
     */
    private calculateNextEvaluation;
    /**
     * Compare values based on operator
     */
    private compareValues;
    /**
     * Get metrics for a time window
     */
    private getMetrics;
    /**
     * Get recent events
     */
    private getRecentEvents;
    /**
     * Find pattern occurrences in events
     */
    private findPatternOccurrences;
    /**
     * Detect anomalies using statistical methods
     */
    private detectAnomalies;
    /**
     * Z-score anomaly detection
     */
    private detectAnomalyZScore;
    /**
     * IQR (Interquartile Range) anomaly detection
     */
    private detectAnomalyIQR;
    /**
     * MAD (Median Absolute Deviation) anomaly detection
     */
    private detectAnomalyMAD;
}
/**
 * Create trigger detector instance
 */
export declare function createTriggerDetector(contextCollector?: IrisContextCollector): TriggerDetector;
//# sourceMappingURL=trigger-engine.d.ts.map