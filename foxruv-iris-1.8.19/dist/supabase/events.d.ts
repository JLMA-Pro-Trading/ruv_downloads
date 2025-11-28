/**
 * Events and anomaly detection helpers
 * Provides event feed and anomaly tracking for dashboards
 */
export interface SystemEvent {
    id: string;
    timestamp: string;
    project: string;
    event_type: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metadata?: Record<string, any>;
}
export interface Anomaly {
    id: string;
    timestamp: string;
    project: string;
    type: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    value: number;
    expected: number;
    deviation: number;
    description: string;
    resolved: boolean;
}
/**
 * Get recent events for dashboard feed
 * Combines data from iris_reports, model_run_log, etc.
 */
export declare function getRecentEvents(projectId?: string, limit?: number): Promise<SystemEvent[]>;
/**
 * Get anomalies detected from drift detection
 * Returns anomalies from recent drift checks
 */
export declare function getAnomalies(projectId?: string, limit?: number): Promise<Anomaly[]>;
/**
 * Mark an anomaly as resolved
 */
export declare function resolveAnomaly(anomalyId: string): Promise<void>;
/**
 * Get anomaly statistics
 */
export declare function getAnomalyStats(projectId?: string): Promise<{
    total: number;
    critical: number;
    warning: number;
    info: number;
    resolved: number;
    unresolved: number;
}>;
//# sourceMappingURL=events.d.ts.map