/**
 * Trigger System Types
 *
 * Generic event-based trigger system for automated operations.
 * Supports threshold-based triggers, cooldowns, and critical events.
 */
/**
 * Default trigger configurations for common scenarios
 */
export const DEFAULT_CONFIGS = {
    development: {
        eventThresholds: {
            file_edit: 10,
            file_create: 5,
            file_delete: 3,
            test_run: 5,
            test_failure: 2,
            build_failure: 1,
            lint_error: 10,
            type_error: 5
        },
        timeWindow: 60 * 60 * 1000, // 1 hour
        cooldownPeriod: 30 * 60 * 1000, // 30 minutes
        criticalEvents: ['build_failure', 'critical_error', 'security_alert']
    },
    production: {
        eventThresholds: {
            error: 5,
            performance_degradation: 3,
            drift_detected: 1,
            deployment: 1,
            rollback: 1,
            health_check_failure: 3
        },
        timeWindow: 30 * 60 * 1000, // 30 minutes
        cooldownPeriod: 15 * 60 * 1000, // 15 minutes
        criticalEvents: ['critical_error', 'security_breach', 'data_loss', 'deployment', 'rollback']
    },
    ml_training: {
        eventThresholds: {
            model_train: 1,
            drift_detected: 1,
            accuracy_drop: 2,
            data_quality_issue: 3,
            training_failure: 1
        },
        timeWindow: 2 * 60 * 60 * 1000, // 2 hours
        cooldownPeriod: 60 * 60 * 1000, // 1 hour
        criticalEvents: ['drift_detected', 'critical_accuracy_drop', 'training_failure']
    },
    ci_cd: {
        eventThresholds: {
            pipeline_start: 1,
            test_failure: 1,
            build_failure: 1,
            deployment_success: 1,
            deployment_failure: 1
        },
        timeWindow: 15 * 60 * 1000, // 15 minutes
        cooldownPeriod: 5 * 60 * 1000, // 5 minutes
        criticalEvents: ['deployment_failure', 'security_scan_failure', 'critical_test_failure']
    }
};
/**
 * Event categories for better organization
 */
export var EventCategory;
(function (EventCategory) {
    EventCategory["FILE_SYSTEM"] = "file_system";
    EventCategory["TESTING"] = "testing";
    EventCategory["BUILD"] = "build";
    EventCategory["DEPLOYMENT"] = "deployment";
    EventCategory["ERROR"] = "error";
    EventCategory["PERFORMANCE"] = "performance";
    EventCategory["ML"] = "ml";
    EventCategory["SECURITY"] = "security";
    EventCategory["CUSTOM"] = "custom";
})(EventCategory || (EventCategory = {}));
/**
 * Event severity levels
 */
export var EventSeverity;
(function (EventSeverity) {
    EventSeverity["INFO"] = "info";
    EventSeverity["WARNING"] = "warning";
    EventSeverity["ERROR"] = "error";
    EventSeverity["CRITICAL"] = "critical";
})(EventSeverity || (EventSeverity = {}));
//# sourceMappingURL=types.js.map