/**
 * Health calculation utilities for Iris Core
 * @module @iris/core/utils/health
 */
/**
 * Calculate health score (0-100)
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
 * Generate recommended actions based on evaluation results
 */
export function generateRecommendedActions(params) {
    const actions = [];
    // Critical drift alerts
    const criticalAlerts = params.driftAlerts.filter((a) => a.severityLevel === 'critical');
    for (const alert of criticalAlerts) {
        actions.push({
            priority: 'critical',
            action: `Retrain ${alert.expertId}`,
            reason: `${alert.driftType} drift: ${(alert.percentageChange * 100).toFixed(1)}% change`,
            impact: 'Restore expert performance to baseline'
        });
    }
    // High-priority rotations
    const highPriorityRotations = params.rotationRecommendations.filter((r) => r.priority === 'high');
    for (const rotation of highPriorityRotations) {
        actions.push({
            priority: 'high',
            action: `${rotation.recommendedAction} ${rotation.expertId}`,
            reason: rotation.reason,
            impact: 'Improve consensus quality'
        });
    }
    // Prompt upgrades
    for (const rec of params.promptRecommendations) {
        actions.push({
            priority: 'medium',
            action: `Upgrade ${rec.expertId} to ${rec.recommendedVersion}`,
            reason: rec.reason,
            impact: `Expected improvement: +${(rec.expectedImprovement * 100).toFixed(1)}%`
        });
    }
    // Stale reflexions
    if (params.reflexionStats.staleReflexions > 5) {
        actions.push({
            priority: 'medium',
            action: 'Review stale reflexions',
            reason: `${params.reflexionStats.staleReflexions} reflexions marked as stale`,
            impact: 'Update or remove outdated self-improvement strategies'
        });
    }
    // Low validity
    if (params.reflexionStats.avgValidity < 0.7) {
        actions.push({
            priority: 'high',
            action: 'Audit reflexion quality',
            reason: `Average validity: ${(params.reflexionStats.avgValidity * 100).toFixed(1)}%`,
            impact: 'Improve self-improvement effectiveness'
        });
    }
    return actions.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    });
}
/**
 * Increment version string
 */
export function incrementVersion(version) {
    const match = version.match(/v(\d+)\.(\d+)\.(\d+)/);
    if (!match)
        return 'v1.0.0';
    const [, major, minor, patch] = match;
    return `v${major}.${minor}.${parseInt(patch) + 1}`;
}
//# sourceMappingURL=health.js.map