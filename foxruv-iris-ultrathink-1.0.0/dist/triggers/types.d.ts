/**
 * Trigger System Types
 *
 * Generic event-based trigger system for automated operations.
 * Supports threshold-based triggers, cooldowns, and critical events.
 */
/**
 * Event record stored in history
 */
export interface EventRecord {
    timestamp: number;
    event: string;
    context: string;
    metadata?: Record<string, any>;
}
/**
 * Trigger configuration
 */
export interface TriggerConfig {
    eventThresholds: Record<string, number>;
    timeWindow: number;
    cooldownPeriod: number;
    criticalEvents: string[];
    customThresholdFn?: (event: string, context: string, eventHistory: EventRecord[]) => number | null;
}
/**
 * Trigger check result
 */
export interface TriggerResult {
    shouldInvoke: boolean;
    reason: string;
    eventCount?: number;
    threshold?: number;
    cooldownRemaining?: number;
}
/**
 * Trigger action configuration
 */
export interface TriggerAction {
    name: string;
    handler: (context: string, event: EventRecord, metadata?: Record<string, any>) => Promise<void>;
    onError?: (error: Error, context: string, event: EventRecord) => Promise<void>;
}
/**
 * Trigger engine options
 */
export interface TriggerEngineOptions {
    config: TriggerConfig;
    dbBasePath: string;
    actions: TriggerAction[];
    logPath?: string;
    verbose?: boolean;
    dryRun?: boolean;
    telemetryFn?: (data: TelemetryData) => Promise<void>;
}
/**
 * Telemetry data for tracking
 */
export interface TelemetryData {
    operation: string;
    context: string;
    event: string;
    outcome: 'success' | 'failure' | 'skipped';
    reason: string;
    durationMs: number;
    metadata?: Record<string, any>;
}
/**
 * Event processing options
 */
export interface ProcessEventOptions {
    event: string;
    context: string;
    metadata?: Record<string, any>;
    force?: boolean;
    dryRun?: boolean;
}
/**
 * Cooldown status
 */
export interface CooldownStatus {
    isActive: boolean;
    lastInvocation: number | null;
    remainingMs: number;
    remainingMin: number;
}
/**
 * Event statistics
 */
export interface EventStats {
    totalEvents: number;
    eventsByType: Record<string, number>;
    lastEvent: EventRecord | null;
    oldestEvent: EventRecord | null;
    timeWindowMs: number;
}
/**
 * Invocation history entry
 */
export interface InvocationRecord {
    timestamp: number;
    context: string;
    event: string;
    reason: string;
    actionName: string;
    outcome: 'success' | 'failure';
    durationMs: number;
    error?: string;
}
/**
 * Default trigger configurations for common scenarios
 */
export declare const DEFAULT_CONFIGS: {
    readonly development: {
        readonly eventThresholds: {
            readonly file_edit: 10;
            readonly file_create: 5;
            readonly file_delete: 3;
            readonly test_run: 5;
            readonly test_failure: 2;
            readonly build_failure: 1;
            readonly lint_error: 10;
            readonly type_error: 5;
        };
        readonly timeWindow: number;
        readonly cooldownPeriod: number;
        readonly criticalEvents: readonly ["build_failure", "critical_error", "security_alert"];
    };
    readonly production: {
        readonly eventThresholds: {
            readonly error: 5;
            readonly performance_degradation: 3;
            readonly drift_detected: 1;
            readonly deployment: 1;
            readonly rollback: 1;
            readonly health_check_failure: 3;
        };
        readonly timeWindow: number;
        readonly cooldownPeriod: number;
        readonly criticalEvents: readonly ["critical_error", "security_breach", "data_loss", "deployment", "rollback"];
    };
    readonly ml_training: {
        readonly eventThresholds: {
            readonly model_train: 1;
            readonly drift_detected: 1;
            readonly accuracy_drop: 2;
            readonly data_quality_issue: 3;
            readonly training_failure: 1;
        };
        readonly timeWindow: number;
        readonly cooldownPeriod: number;
        readonly criticalEvents: readonly ["drift_detected", "critical_accuracy_drop", "training_failure"];
    };
    readonly ci_cd: {
        readonly eventThresholds: {
            readonly pipeline_start: 1;
            readonly test_failure: 1;
            readonly build_failure: 1;
            readonly deployment_success: 1;
            readonly deployment_failure: 1;
        };
        readonly timeWindow: number;
        readonly cooldownPeriod: number;
        readonly criticalEvents: readonly ["deployment_failure", "security_scan_failure", "critical_test_failure"];
    };
};
/**
 * Event categories for better organization
 */
export declare enum EventCategory {
    FILE_SYSTEM = "file_system",
    TESTING = "testing",
    BUILD = "build",
    DEPLOYMENT = "deployment",
    ERROR = "error",
    PERFORMANCE = "performance",
    ML = "ml",
    SECURITY = "security",
    CUSTOM = "custom"
}
/**
 * Event severity levels
 */
export declare enum EventSeverity {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical"
}
/**
 * Extended event record with categorization
 */
export interface CategorizedEventRecord extends EventRecord {
    category?: EventCategory;
    severity?: EventSeverity;
}
//# sourceMappingURL=types.d.ts.map