/**
 * PerformanceJudge Agent - Tier 1 Core Decision Maker
 *
 * Manages expert leagues, performance tracking, and rotation decisions
 *
 * Responsibilities:
 * - Calculate league tables by expert type
 * - Identify drifting experts (accuracy drops)
 * - Recommend expert rotations
 * - Trigger retraining for critical drift
 *
 * @module council/agents/PerformanceJudge
 * @version 1.0.0
 */
import type { CouncilTelemetryInput, PerformanceAnalysis } from '../types/index.js';
/**
 * PerformanceJudge configuration
 */
export interface PerformanceJudgeConfig {
    driftThreshold?: number;
    criticalThreshold?: number;
    minRunsForRanking?: number;
    voteWeight?: number;
}
/**
 * PerformanceJudge Agent - Manages expert performance and rotations
 */
export declare class PerformanceJudge {
    private config;
    constructor(config?: PerformanceJudgeConfig);
    /**
     * Analyze expert performance and generate recommendations
     */
    analyze(telemetry: CouncilTelemetryInput): Promise<PerformanceAnalysis>;
    /**
     * Calculate league tables by expert type
     */
    private calculateLeagues;
    /**
     * Infer performance trend
     */
    private inferTrend;
    /**
     * Identify drifting experts
     */
    private identifyDrift;
    /**
     * Find top performers across all leagues
     */
    private findTopPerformers;
    /**
     * Generate rotation recommendations
     */
    private generateRotationRecommendations;
    /**
     * Generate voting recommendation
     */
    private generateRecommendation;
    /**
     * Calculate average accuracy across all leagues
     */
    private calculateAvgAccuracy;
    /**
     * Get agent vote weight
     */
    getVoteWeight(): number;
}
/**
 * Create PerformanceJudge agent
 */
export declare function createPerformanceJudge(config?: PerformanceJudgeConfig): PerformanceJudge;
//# sourceMappingURL=PerformanceJudge.d.ts.map