/**
 * Health calculation utilities for Iris Core
 * @module @iris/core/utils/health
 */
import type { HealthFactors, RecommendedAction, RecommendedActionParams } from '../types.js';
/**
 * Calculate health score (0-100)
 */
export declare function calculateHealthScore(factors: HealthFactors): number;
/**
 * Get health level from score
 */
export declare function getHealthLevel(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
/**
 * Generate recommended actions based on evaluation results
 */
export declare function generateRecommendedActions(params: RecommendedActionParams): RecommendedAction[];
/**
 * Increment version string
 */
export declare function incrementVersion(version: string): string;
//# sourceMappingURL=health.d.ts.map