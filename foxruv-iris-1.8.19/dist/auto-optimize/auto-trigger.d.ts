/**
 * Iris Auto-Optimization Trigger System
 *
 * Automatically triggers optimization when:
 * 1. Enough telemetry data exists (>10 calls)
 * 2. Success rate drops below threshold (< 70%)
 * 3. Drift detected (performance degradation)
 *
 * This is THE main feature - self-improving AI without manual intervention.
 *
 * @module auto-optimize/auto-trigger
 */
export interface TelemetryRecord {
    id: string;
    target: string;
    timestamp: Date;
    success: boolean;
    latencyMs: number;
    tokenCount?: number;
    errorMessage?: string;
    input?: string;
    output?: string;
    confidence?: number;
}
export interface OptimizationTrigger {
    target: string;
    reason: 'low_success_rate' | 'high_latency' | 'drift_detected' | 'manual';
    metrics: {
        callCount: number;
        successRate: number;
        avgLatency: number;
        recentTrend: 'improving' | 'stable' | 'degrading';
    };
    recommendation: string;
}
export interface AutoTriggerConfig {
    enabled: boolean;
    minCallsBeforeTrigger: number;
    successRateThreshold: number;
    latencyThresholdMs: number;
    cooldownMinutes: number;
    autoApply: boolean;
}
export declare function ensureTelemetryDir(projectPath?: string): void;
/**
 * Record a telemetry event for an AI function call
 */
export declare function recordTelemetry(projectPath: string, record: Omit<TelemetryRecord, 'id' | 'timestamp'>): void;
/**
 * Get telemetry records for a specific target
 */
export declare function getTelemetryForTarget(projectPath: string, target: string): TelemetryRecord[];
/**
 * Get all unique targets with telemetry
 */
export declare function getAllTargets(projectPath: string): string[];
/**
 * Calculate metrics for a target
 */
export declare function calculateMetrics(records: TelemetryRecord[]): OptimizationTrigger['metrics'];
/**
 * Check if optimization should be triggered for a target
 */
export declare function shouldTriggerOptimization(projectPath: string, target: string, config?: AutoTriggerConfig): OptimizationTrigger | null;
/**
 * Log that an optimization was triggered
 */
export declare function logOptimizationTrigger(projectPath: string, trigger: OptimizationTrigger): void;
/**
 * Check all targets and return any that need optimization
 */
export declare function checkAllTargets(projectPath: string, config?: AutoTriggerConfig): OptimizationTrigger[];
/**
 * Run auto-trigger check and optionally execute optimizations
 */
export declare function runAutoTriggerCheck(projectPath?: string, options?: {
    autoExecute?: boolean;
    verbose?: boolean;
}): Promise<void>;
/**
 * Record outcome from a tool use and check for triggers
 * This is called from the PostToolUse hook
 */
export declare function recordAndCheck(projectPath: string, target: string, success: boolean, latencyMs: number, metadata?: {
    input?: string;
    output?: string;
    error?: string;
}): Promise<OptimizationTrigger | null>;
//# sourceMappingURL=auto-trigger.d.ts.map