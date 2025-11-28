/**
 * Expert League and Rotation Management System
 *
 * Performance-based expert leagues across projects with automated rotation,
 * promotion/demotion, and strategy transfer from top performers to struggling experts.
 *
 * Features:
 * - Cross-project league tables by expert type
 * - Performance ranking (accuracy, confidence, contribution)
 * - Drift detection and alerts
 * - Automated rotation recommendations
 * - Strategy extraction and transfer
 * - Promotion/demotion history tracking
 */
/**
 * Expert performance metrics for league ranking
 */
export interface ExpertPerformance {
    expertId: string;
    expertType: string;
    projectId: string;
    accuracy: number;
    confidence: number;
    contributionCount: number;
    recentAccuracy: number;
    trend: 'improving' | 'stable' | 'declining' | 'drifting';
    lastUpdated: Date;
    metadata: {
        averageResponseTime?: number;
        specialization?: string[];
        strengths?: string[];
        weaknesses?: string[];
    };
}
/**
 * League table entry
 */
export interface LeagueEntry {
    rank: number;
    expertId: string;
    projectId: string;
    score: number;
    accuracy: number;
    confidence: number;
    contributionCount: number;
    trend: string;
    status: 'champion' | 'performer' | 'average' | 'struggling' | 'critical';
}
/**
 * Rotation recommendation
 */
export interface RotationRecommendation {
    id: string;
    targetExpertId: string;
    targetProjectId: string;
    mentorExpertId: string;
    mentorProjectId: string;
    reason: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    strategy: RotationStrategy;
    estimatedImpact: number;
    createdAt: Date;
    status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
    monitoringPeriod: number;
}
/**
 * Rotation strategy details
 */
export interface RotationStrategy {
    type: 'prompt_transfer' | 'few_shot_transfer' | 'full_retrain' | 'hybrid';
    extractedPrompt?: string;
    fewShotExamples?: Array<{
        input: string;
        output: string;
        context?: Record<string, unknown>;
    }>;
    configurationChanges?: Record<string, unknown>;
    retrainingSamples?: number;
    monitoringMetrics: string[];
}
/**
 * League configuration
 */
export interface LeagueConfig {
    expertType: string;
    minimumContributions: number;
    driftThreshold: number;
    promotionThreshold: number;
    demotionThreshold: number;
    rotationInterval: number;
}
/**
 * Promotion/Demotion history entry
 */
export interface RankingHistory {
    expertId: string;
    projectId: string;
    timestamp: Date;
    previousRank: number;
    newRank: number;
    previousStatus: string;
    newStatus: string;
    trigger: 'performance' | 'drift' | 'rotation' | 'manual';
    notes?: string;
}
/**
 * Expert League Manager
 * Manages performance-based leagues and rotation strategies
 */
import { AgentDBManager } from '../storage/agentdb-integration.js';
import { GlobalMetricsCollector } from '../telemetry/global-metrics.js';
export declare class ExpertLeagueManager {
    private agentDB;
    private metricsCollector;
    private leagueConfigs;
    constructor(agentDB: AgentDBManager, metricsCollector: GlobalMetricsCollector);
    private getValue;
    private setValue;
    /**
     * Initialize default league configurations
     */
    private initializeDefaultLeagues;
    /**
     * Calculate league tables for all expert types
     */
    calculateLeagueTables(): Promise<Map<string, LeagueEntry[]>>;
    /**
     * Get all experts grouped by type
     */
    private getExpertsByType;
    /**
     * Calculate league table for specific expert type
     */
    private calculateLeagueForType;
    /**
     * Calculate composite performance score
     * Weighted combination of accuracy, confidence, and contribution
     */
    private calculateCompositeScore;
    /**
     * Determine expert status based on rank percentile and trend
     */
    private determineStatus;
    /**
     * Identify drifting experts across all leagues
     */
    identifyDriftingExperts(): Promise<Array<{
        expert: ExpertPerformance;
        leagueEntry: LeagueEntry;
        driftMagnitude: number;
    }>>;
    /**
     * Generate rotation recommendations
     */
    generateRotationRecommendations(): Promise<RotationRecommendation[]>;
    /**
     * Create rotation recommendation
     */
    private createRotationRecommendation;
    /**
     * Determine rotation strategy based on drift severity
     */
    private determineRotationStrategy;
    /**
     * Extract mentor's successful strategy
     */
    private extractMentorStrategy;
    /**
     * Estimate rotation impact (expected accuracy improvement)
     */
    private estimateRotationImpact;
    /**
     * Determine rotation priority
     */
    private determineRotationPriority;
    /**
     * Generate human-readable rotation reason
     */
    private generateRotationReason;
    /**
     * Execute approved rotation
     */
    executeRotation(rotationId: string): Promise<{
        success: boolean;
        rotation: RotationRecommendation;
        appliedChanges: string[];
        monitoringStarted: boolean;
    }>;
    /**
     * Apply prompt transfer
     */
    private applyPromptTransfer;
    /**
     * Apply few-shot transfer
     */
    private applyFewShotTransfer;
    /**
     * Trigger full retrain
     */
    private triggerFullRetrain;
    /**
     * Trigger partial retrain
     */
    private triggerPartialRetrain;
    /**
     * Start rotation monitoring
     */
    private startRotationMonitoring;
    /**
     * Get rotation monitoring results
     */
    getRotationMonitoringResults(rotationId: string): Promise<{
        rotation: RotationRecommendation;
        monitoring: {
            startTime: Date;
            endTime: Date;
            currentAccuracy: number;
            baselineAccuracy: number;
            improvement: number;
            expectedImprovement: number;
            success: boolean;
            metrics: Record<string, number>;
        };
    }>;
    /**
     * Get current monitoring metrics
     */
    private getMonitoringMetrics;
    /**
     * Track promotion/demotion history
     */
    recordRankingChange(expertId: string, projectId: string, previousRank: number, newRank: number, previousStatus: string, newStatus: string, trigger: 'performance' | 'drift' | 'rotation' | 'manual', notes?: string): Promise<void>;
    /**
     * Get promotion/demotion history for expert
     */
    getRankingHistory(expertId: string, projectId: string): Promise<RankingHistory[]>;
    /**
     * Generate league report
     */
    generateLeagueReport(expertType?: string): Promise<string>;
    private getDefaultConfig;
    private getExpertPerformance;
    private getCurrentAccuracy;
    private hasActiveRotation;
    private getRotationRecommendation;
    private storeLeagueTables;
    private storeRotationRecommendations;
    private updateRotationStatus;
    private recordRotationExecution;
}
/**
 * Example usage and rotation scenarios
 */
export declare const ROTATION_EXAMPLES: {
    /**
     * Example 1: Critical drift detected
     */
    criticalDrift: {
        scenario: string;
        league: {
            type: string;
            entries: {
                rank: number;
                expert: string;
                accuracy: number;
                runs: number;
                status: string;
            }[];
        };
        rotation: {
            target: string;
            mentor: string;
            strategy: string;
            reason: string;
            expectedImpact: number;
            priority: string;
        };
    };
    /**
     * Example 2: Moderate performance decline
     */
    moderateDecline: {
        scenario: string;
        rotation: {
            target: string;
            mentor: string;
            strategy: string;
            actions: string[];
            monitoring: {
                period: string;
                metrics: string[];
                successCriteria: string;
            };
        };
    };
    /**
     * Example 3: New expert underperforming
     */
    newExpertStruggling: {
        scenario: string;
        rotation: {
            target: string;
            mentor: string;
            strategy: string;
            actions: string[];
            expectedImpact: number;
            monitoring: {
                period: string;
                checkpoints: string[];
            };
        };
    };
    /**
     * Example 4: Cross-project knowledge transfer
     */
    crossProjectTransfer: {
        scenario: string;
        rotation: {
            target: string;
            mentor: string;
            strategy: string;
            reason: string;
            actions: string[];
            expectedImpact: number;
        };
    };
};
export default ExpertLeagueManager;
//# sourceMappingURL=expert-leagues.d.ts.map