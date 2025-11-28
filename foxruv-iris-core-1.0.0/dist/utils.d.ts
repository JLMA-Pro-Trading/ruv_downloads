/**
 * Utility functions for @iris/core
 */
/**
 * Calculate health score (0-100) based on various factors
 */
export declare function calculateHealthScore(factors: {
    driftAlerts: number;
    staleReflexions: number;
    avgValidity: number;
    highPriorityRotations: number;
}): number;
/**
 * Get health level from score
 */
export declare function getHealthLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
/**
 * Increment version string (e.g., v1.0.0 -> v1.0.1)
 */
export declare function incrementVersion(version: string): string;
/**
 * Validate project ID format
 */
export declare function isValidProjectId(projectId: string): boolean;
/**
 * Validate version string format
 */
export declare function isValidVersion(version: string): boolean;
//# sourceMappingURL=utils.d.ts.map