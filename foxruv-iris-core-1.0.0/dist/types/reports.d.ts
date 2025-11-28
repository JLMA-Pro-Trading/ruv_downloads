/**
 * Report Types
 *
 * Defines report structures for IRIS evaluations, health checks,
 * and expert rotation recommendations.
 *
 * @module @iris/core/types/reports
 * @version 1.0.0
 */
/**
 * Expert Rotation Recommendation
 *
 * Recommendation for expert version management based on
 * consensus analysis and performance tracking.
 */
export interface RotationRecommendation {
    /** Expert identifier */
    expertId: string;
    /** Current version in use */
    currentVersion: string;
    /** Recommended action to take */
    recommendedAction: 'keep' | 'update' | 'replace' | 'add_to_ensemble';
    /** Explanation for the recommendation */
    reason: string;
    /** Alternative versions to consider */
    alternativeVersions: Array<{
        version: string;
        expectedImprovement: number;
        confidence: number;
    }>;
    /** Priority level for this recommendation */
    priority: 'low' | 'medium' | 'high';
}
/**
 * Health Status Level
 */
export type HealthStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
/**
 * IRIS Project Evaluation Report
 *
 * Comprehensive evaluation of a single project's health,
 * including drift analysis, prompt recommendations, reflexion status,
 * rotation recommendations, and actionable insights.
 */
export interface IrisReport {
    /** Project identifier */
    projectId: string;
    /** Report generation timestamp */
    timestamp: Date;
    /** Overall health classification */
    overallHealth: HealthStatus;
    /** Numeric health score (0-100) */
    healthScore: number;
    /** Drift alerts detected */
    driftAlerts: Array<{
        expertId: string;
        severity: string;
        driftType: string;
        percentageChange: number;
        recommendations: string[];
    }>;
    /** Prompt upgrade recommendations */
    promptRecommendations: Array<{
        expertId: string;
        currentVersion: string;
        recommendedVersion: string;
        expectedImprovement: number;
        reason: string;
    }>;
    /** Reflexion monitoring status */
    reflexionStatus: {
        totalReflexions: number;
        staleReflexions: number;
        avgValidity: number;
        transferableReflexions: number;
    };
    /** Expert rotation recommendations */
    rotationRecommendations: RotationRecommendation[];
    /** Cross-project transferable patterns */
    transferablePatterns: Array<{
        patternId: string;
        name: string;
        sourceProject: string;
        transferPotential: number;
    }>;
    /** Prioritized recommended actions */
    recommendedActions: Array<{
        priority: 'critical' | 'high' | 'medium' | 'low';
        action: string;
        reason: string;
        impact: string;
    }>;
}
/**
 * Cross-Project Evaluation Summary
 *
 * High-level summary of health and performance across all projects.
 * Identifies top performers and transfer opportunities.
 */
export interface CrossProjectReport {
    /** Report generation timestamp */
    timestamp: Date;
    /** Per-project health summaries */
    projects: Array<{
        projectId: string;
        health: string;
        score: number;
        criticalAlerts: number;
    }>;
    /** Top performing experts across all projects */
    topPerformers: Array<{
        expertId: string;
        project: string;
        accuracy: number;
    }>;
    /** Number of cross-project transfer opportunities identified */
    transferOpportunities: number;
    /** Total drift alerts across all projects */
    totalDriftAlerts: number;
}
//# sourceMappingURL=reports.d.ts.map