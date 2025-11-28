/**
 * Utility functions for @iris/core
 */
/**
 * Calculate health score (0-100) based on various factors
 */
export function calculateHealthScore(factors) {
    let score = 100;
    // Deduct for drift alerts
    score -= factors.driftAlerts * 10;
    // Deduct for stale reflexions
    score -= factors.staleReflexions * 5;
    // Deduct for low reflexion validity
    score -= (1 - factors.avgValidity) * 20;
    // Deduct for high-priority rotations
    score -= factors.highPriorityRotations * 8;
    return Math.max(0, Math.min(100, score));
}
/**
 * Get health level from score
 */
export function getHealthLevel(score) {
    if (score >= 90)
        return 'excellent';
    if (score >= 75)
        return 'good';
    if (score >= 60)
        return 'fair';
    if (score >= 40)
        return 'poor';
    return 'critical';
}
/**
 * Increment version string (e.g., v1.0.0 -> v1.0.1)
 */
export function incrementVersion(version) {
    const match = version.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (!match)
        return 'v1.0.0';
    const [, major, minor, patch] = match;
    return `v${major}.${minor}.${parseInt(patch) + 1}`;
}
/**
 * Validate project ID format
 */
export function isValidProjectId(projectId) {
    return projectId.length > 0 && /^[a-zA-Z0-9-_]+$/.test(projectId);
}
/**
 * Validate version string format
 */
export function isValidVersion(version) {
    return /^v\d+\.\d+\.\d+$/.test(version);
}
//# sourceMappingURL=utils.js.map