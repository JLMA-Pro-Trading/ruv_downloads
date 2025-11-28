/**
 * IRIS - Intelligent Reflexive Intelligence System
 *
 * Chief AI Operations orchestrator that monitors all expert agents across projects,
 * detects drift, manages prompt evolution, launches A/B tests, and auto-retrains
 * or rotates underperforming agents.
 *
 * IRIS is the executive function that ties together:
 * - GlobalMetrics (telemetry & drift detection)
 * - PromptRegistry (signature versioning & best-in-class discovery)
 * - ReflexionMonitor (validity tracking & staleness detection)
 * - ConsensusLineageTracker (version impact & rotation recommendations)
 * - PatternDiscovery (cross-domain pattern transfer)
 * - SwarmCoordinator (parallel retraining)
 *
 * @module iris-prime
 * @version 1.0.0
 */
import { type RotationRecommendation, type PatternMatch } from '../index.js';
import type { IrisNotifier } from '../notifications/types.js';
/**
 * IRIS evaluation report for a project
 */
export interface IrisReport {
    projectId: string;
    timestamp: Date;
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    healthScore: number;
    driftAlerts: Array<{
        expertId: string;
        severity: string;
        driftType: string;
        percentageChange: number;
        recommendations: string[];
    }>;
    promptRecommendations: Array<{
        expertId: string;
        currentVersion: string;
        recommendedVersion: string;
        expectedImprovement: number;
        reason: string;
    }>;
    reflexionStatus: {
        totalReflexions: number;
        staleReflexions: number;
        avgValidity: number;
        transferableReflexions: number;
    };
    rotationRecommendations: RotationRecommendation[];
    transferablePatterns: Array<{
        patternId: string;
        name: string;
        sourceProject: string;
        transferPotential: number;
    }>;
    recommendedActions: Array<{
        priority: 'critical' | 'high' | 'medium' | 'low';
        action: string;
        reason: string;
        impact: string;
    }>;
}
/**
 * Cross-project evaluation summary
 */
export interface CrossProjectReport {
    timestamp: Date;
    projects: Array<{
        projectId: string;
        health: string;
        score: number;
        criticalAlerts: number;
    }>;
    topPerformers: Array<{
        expertId: string;
        project: string;
        accuracy: number;
    }>;
    transferOpportunities: number;
    totalDriftAlerts: number;
}
/**
 * Project configuration for IRIS
 */
export interface ProjectConfig {
    projectId: string;
    autoRetrain: boolean;
    autoPromote: boolean;
    retrainingThreshold: number;
    promotionThreshold: number;
    minEvaluations: number;
}
/**
 * IRIS Configuration
 */
export interface IrisPrimeConfig {
    dbBasePath?: string;
    defaultAutoRetrain?: boolean;
    defaultAutoPromote?: boolean;
    scheduleIntervalMs?: number;
    logPath?: string;
    notifiers?: IrisNotifier[];
}
/**
 * IRIS - AI Operations Orchestrator
 */
export declare class IrisPrime {
    private globalMetrics;
    private promptRegistry;
    private reflexionMonitor;
    private consensusTracker;
    private patternDiscovery;
    private config;
    private projectConfigs;
    private notifiers;
    private currentRunId;
    constructor(config?: IrisPrimeConfig);
    /**
     * Configure project settings
     */
    configureProject(config: ProjectConfig): void;
    /**
     * Get project config or use defaults
     */
    private getProjectConfig;
    /**
     * Emit event to all notifiers
     */
    private emit;
    /**
     * Evaluate a single project's health
     */
    evaluateProject(projectId: string): Promise<IrisReport>;
    /**
     * Evaluate all projects
     */
    evaluateAllProjects(): Promise<CrossProjectReport>;
    /**
     * Auto-promote better prompts after validation
     */
    autoPromotePrompts(projectId: string): Promise<Array<{
        expertId: string;
        promotedVersion: string;
        previousVersion: string;
        improvement: number;
    }>>;
    /**
     * Auto-retrain experts showing drift
     */
    autoRetrainExperts(projectId: string): Promise<Array<{
        expertId: string;
        oldVersion: string;
        newVersion: string;
        improvement: number;
    }>>;
    /**
     * Find reusable reflexions across projects
     */
    findReusableReflexions(projectId: string): Promise<Array<{
        reflexionId: string;
        sourceProject: string;
        targetProject: string;
        transferPotential: number;
        adaptationRequired: string;
    }>>;
    /**
     * Find transferable patterns from other projects
     */
    findTransferablePatterns(projectId: string, context: Record<string, any>): Promise<PatternMatch[]>;
    /**
     * Generate rotation report for experts
     */
    generateRotationReport(projectId: string): Promise<{
        recommendations: RotationRecommendation[];
        summary: {
            keep: number;
            update: number;
            replace: number;
            addToEnsemble: number;
        };
    }>;
    /**
     * Calculate health score (0-100)
     */
    private calculateHealthScore;
    /**
     * Get health level from score
     */
    private getHealthLevel;
    /**
     * Generate recommended actions
     */
    private generateRecommendedActions;
    /**
     * Load recent training data (stub)
     */
    private loadRecentTrainingData;
    /**
     * Increment version string
     */
    private incrementVersion;
    /**
     * Close all connections
     */
    close(): void;
}
/**
 * Create IRIS instance
 */
export declare function createIrisPrime(config?: IrisPrimeConfig): IrisPrime;
/**
 * Main IRIS API
 */
export declare const irisPrime: {
    /**
     * Evaluate a single project
     */
    evaluateProject(projectId: string): Promise<IrisReport>;
    /**
     * Evaluate all projects
     */
    evaluateAllProjects(): Promise<CrossProjectReport>;
    /**
     * Auto-promote better prompts
     */
    autoPromotePrompts(projectId: string): Promise<{
        expertId: string;
        promotedVersion: string;
        previousVersion: string;
        improvement: number;
    }[]>;
    /**
     * Auto-retrain drifting experts
     */
    autoRetrainExperts(projectId: string): Promise<{
        expertId: string;
        oldVersion: string;
        newVersion: string;
        improvement: number;
    }[]>;
    /**
     * Find reusable reflexions
     */
    findReusableReflexions(projectId: string): Promise<{
        reflexionId: string;
        sourceProject: string;
        targetProject: string;
        transferPotential: number;
        adaptationRequired: string;
    }[]>;
    /**
     * Find transferable patterns
     */
    findTransferablePatterns(projectId: string, context: Record<string, any>): Promise<PatternMatch[]>;
    /**
     * Generate rotation report
     */
    generateRotationReport(projectId: string): Promise<{
        recommendations: RotationRecommendation[];
        summary: {
            keep: number;
            update: number;
            replace: number;
            addToEnsemble: number;
        };
    }>;
};
//# sourceMappingURL=iris-prime.d.ts.map