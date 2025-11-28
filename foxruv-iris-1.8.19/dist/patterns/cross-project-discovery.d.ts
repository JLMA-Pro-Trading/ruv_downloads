/**
 * Cross-Project Pattern Discovery Engine - FoxRuv Prime
 *
 * Discovers and transfers successful patterns across multiple projects:
 * - NFL Predictor
 * - Microbiome Discovery Platform
 * - BeClever AI
 * - And other FoxRuv projects
 *
 * This engine uses AgentDB for vector search, Supabase for telemetry,
 * and AI Council for decision-making to find patterns that work across domains.
 *
 * Features:
 * - Extract patterns from telemetry data (confidence > 0.9, success > 0.85)
 * - Vector similarity search to find cross-project patterns
 * - Transfer testing framework with success/failure tracking
 * - Pattern storage with cross-project metadata
 * - AI Council integration for transfer decisions
 *
 * @module cross-project-discovery
 * @version 1.0.0
 */
/**
 * Discovered pattern from telemetry analysis
 */
export interface DiscoveredPattern {
    patternId: string;
    sourceProject: string;
    expertId: string;
    version: string;
    patternType: 'strategy' | 'architecture' | 'workflow' | 'optimization';
    name: string;
    description: string;
    context: {
        domain: string;
        problemType: string;
        dataCharacteristics: string[];
        constraints: string[];
    };
    implementation: {
        approach: string;
        keyTechniques: string[];
        dependencies: string[];
        code?: string;
    };
    performance: {
        confidence: number;
        successRate: number;
        avgLatency: number;
        totalRuns: number;
        reflexionUsed: boolean;
    };
    transferability: {
        score: number;
        applicableDomains: string[];
        adaptationRequired: 'none' | 'low' | 'medium' | 'high';
        risks: string[];
    };
    embedding: number[];
    discoveredAt: Date;
    metadata?: Record<string, any>;
}
/**
 * Transfer test result
 */
export interface TransferTestResult {
    testId: string;
    patternId: string;
    sourceProject: string;
    targetProject: string;
    startedAt: Date;
    completedAt?: Date;
    status: 'running' | 'success' | 'failure' | 'partial';
    metrics: {
        baselineAccuracy: number;
        patternAccuracy: number;
        improvement: number;
        latencyImpact: number;
        confidence: number;
    };
    observations: string[];
    recommendations: string[];
    shouldDeploy: boolean;
    metadata?: Record<string, any>;
}
/**
 * Cross-project pattern match
 */
export interface CrossProjectMatch {
    pattern: DiscoveredPattern;
    similarity: number;
    targetProject: string;
    transferPotential: number;
    estimatedImprovement: number;
    requiredAdaptations: string[];
    risks: string[];
    aiCouncilDecision?: {
        approved: boolean;
        confidence: number;
        reasoning: string[];
        conditions: string[];
    };
}
/**
 * AI Council decision for pattern transfer
 */
export interface AICouncilDecision {
    approved: boolean;
    confidence: number;
    reasoning: string[];
    conditions: string[];
    requiredTests: string[];
    rollbackPlan: string[];
}
/**
 * Configuration for cross-project discovery
 */
export interface CrossProjectDiscoveryConfig {
    dbPath?: string;
    agentDBPath?: string;
    minConfidence?: number;
    minSuccessRate?: number;
    minTransferScore?: number;
    enableAutoTransfer?: boolean;
    enableAICouncil?: boolean;
    projects?: string[];
}
/**
 * Cross-Project Pattern Discovery Engine
 */
export declare class CrossProjectDiscovery {
    private db;
    private agentDB;
    private patternDiscovery;
    private metricsCollector;
    private config;
    private agentDbReady;
    constructor(config?: CrossProjectDiscoveryConfig);
    /**
     * Initialize AgentDB
     */
    private initializeAgentDb;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Ensure AgentDB is ready
     */
    private ensureAgentDbReady;
    /**
     * Get initialized DB instance
     */
    private getDb;
    /**
     * Extract successful patterns from project telemetry
     */
    extractPatternsFromTelemetry(project: string, options?: {
        minConfidence?: number;
        minSuccessRate?: number;
        timeWindow?: number;
    }): Promise<DiscoveredPattern[]>;
    /**
     * Extract pattern from individual expert
     */
    private extractPatternFromExpert;
    /**
     * Classify pattern type based on metrics
     */
    private classifyPatternType;
    /**
     * Generate pattern description
     */
    private generatePatternDescription;
    /**
     * Assess transferability of pattern
     */
    private assessTransferability;
    /**
     * Generate embedding for pattern (mock - replace with real embeddings)
     */
    private generatePatternEmbedding;
    private inferDomain;
    private inferProblemType;
    private inferDataCharacteristics;
    private inferConstraints;
    private describeApproach;
    private identifyTechniques;
    /**
     * Find similar patterns across all projects
     */
    findSimilarPatternsAcrossProjects(queryPattern: {
        description: string;
        patternType: string;
        context: any;
    }, options?: {
        targetProjects?: string[];
        minSimilarity?: number;
        limit?: number;
    }): Promise<CrossProjectMatch[]>;
    /**
     * Calculate transfer potential
     */
    private calculateTransferPotential;
    /**
     * Estimate improvement from pattern transfer
     */
    private estimateImprovement;
    /**
     * Identify required adaptations
     */
    private identifyAdaptations;
    /**
     * Get AI Council decision for pattern transfer
     */
    private getAICouncilDecision;
    /**
     * Test pattern transfer on target project
     */
    testPatternTransfer(patternId: string, targetProject: string, options?: {
        testSize?: number;
        baselineMetrics?: any;
        durationDays?: number;
    }): Promise<TransferTestResult>;
    /**
     * Store discovered pattern
     */
    private storeDiscoveredPattern;
    /**
     * Get discovered pattern
     */
    private getDiscoveredPattern;
    /**
     * Store transfer test
     */
    private storeTransferTest;
    /**
     * Update transfer test
     */
    private updateTransferTest;
    /**
     * Get all patterns for a project
     */
    getProjectPatterns(project: string): Promise<DiscoveredPattern[]>;
    /**
     * Close connections
     */
    close(): void;
}
/**
 * Create cross-project discovery engine
 */
export declare function createCrossProjectDiscovery(config?: CrossProjectDiscoveryConfig): CrossProjectDiscovery;
//# sourceMappingURL=cross-project-discovery.d.ts.map