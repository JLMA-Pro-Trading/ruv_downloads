/**
 * Event Types for IRIS Notifications
 *
 * Defines event structures, severity levels, and notifier interfaces
 * for IRIS alerts, health checks, and operational events.
 *
 * @module @iris/core/types/events
 * @version 1.0.0
 */
/**
 * Event Severity Level
 *
 * - info: Informational events (pattern discovery, successful operations)
 * - warning: Warning events (drift detected, low validity)
 * - critical: Critical events requiring immediate attention (severe drift, failures)
 */
export type IrisEventSeverity = 'info' | 'warning' | 'critical';
/**
 * Event Type Categories
 *
 * Categorizes IRIS operational events for filtering and routing.
 */
export type IrisEventType = 'DRIFT_ALERT' | 'PROMOTION' | 'ROTATION' | 'PATTERN_DISCOVERY' | 'RETRAINING_STARTED' | 'RETRAINING_COMPLETED' | 'IRIS_RUN_COMPLETED' | 'HEALTH_CHECK';
/**
 * IRIS Event Structure
 *
 * Standard event format for all IRIS notifications.
 * Includes context, severity, type, and flexible payload.
 */
export interface IrisEvent {
    /** Unique identifier for this IRIS run */
    runId: string;
    /** Project identifier */
    project: string;
    /** Event type category */
    eventType: IrisEventType;
    /** Severity level */
    severity: IrisEventSeverity;
    /** Event-specific data payload */
    payload: Record<string, any>;
    /** Timestamp when event was created */
    createdAt: Date;
}
/**
 * Notifier Interface
 *
 * Contract for implementing custom notification handlers.
 * Supports Slack, email, WhatsApp, webhooks, etc.
 */
export interface IrisNotifier {
    /**
     * Send notification for an IRIS event
     *
     * @param event - The event to notify about
     */
    send(event: IrisEvent): Promise<void>;
}
//# sourceMappingURL=events.d.ts.map