/**
 * Validation utilities for Iris Core
 * @module @iris/core/utils/validation
 */
/**
 * Validate project configuration
 */
export function validateProjectConfig(config) {
    if (!config.projectId) {
        throw new Error('Project ID is required');
    }
    if (config.retrainingThreshold !== undefined) {
        if (config.retrainingThreshold < 0 || config.retrainingThreshold > 1) {
            throw new Error('Retraining threshold must be between 0 and 1');
        }
    }
    if (config.promotionThreshold !== undefined) {
        if (config.promotionThreshold < 0 || config.promotionThreshold > 1) {
            throw new Error('Promotion threshold must be between 0 and 1');
        }
    }
    if (config.minEvaluations !== undefined) {
        if (config.minEvaluations < 1) {
            throw new Error('Minimum evaluations must be at least 1');
        }
    }
}
/**
 * Validate orchestrator configuration
 */
export function validateOrchestratorConfig(config) {
    if (config.scheduleIntervalMs !== undefined) {
        if (config.scheduleIntervalMs < 1000) {
            throw new Error('Schedule interval must be at least 1000ms (1 second)');
        }
    }
}
/**
 * Validate version string format
 */
export function validateVersionFormat(version) {
    return /^v\d+\.\d+\.\d+$/.test(version);
}
//# sourceMappingURL=validation.js.map