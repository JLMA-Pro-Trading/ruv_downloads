/**
 * Consensus Lineage Tracker
 *
 * Tracks expert version contributions to consensus decisions and their outcomes.
 * Enables understanding of which expert combinations and versions produce best results.
 *
 * Features:
 * - Expert version tracking in consensus
 * - Outcome attribution per expert
 * - Consensus pattern analysis
 * - Version diff and impact analysis
 * - Rotation recommendations
 *
 * @module lineage-tracker
 * @version 1.0.0
 */
/**
 * Expert participation in consensus
 */
export interface ExpertParticipation {
    expertId: string;
    version: string;
    project: string;
    confidence: number;
    prediction: any;
    reasoning: string[];
    weight: number;
}
/**
 * Consensus decision record
 */
export interface ConsensusDecision {
    decisionId: string;
    project: string;
    timestamp: Date;
    participants: ExpertParticipation[];
    finalDecision: any;
    consensusScore: number;
    outcome?: 'correct' | 'incorrect' | 'partial' | 'pending';
    metadata?: Record<string, any>;
}
/**
 * Expert version lineage
 */
export interface VersionLineage {
    expertId: string;
    version: string;
    project: string;
    deployedAt: Date;
    consensusParticipations: number;
    successfulContributions: number;
    contributionRate: number;
    avgWeight: number;
    replacedBy?: string;
    retiredAt?: Date;
}
/**
 * Consensus pattern
 */
export interface ConsensusPattern {
    patternId: string;
    expertCombination: string[];
    versionCombination: string[];
    occurrences: number;
    successRate: number;
    avgConsensusScore: number;
    projects: string[];
}
/**
 * Version impact analysis
 */
export interface VersionImpact {
    expertId: string;
    oldVersion: string;
    newVersion: string;
    changeDate: Date;
    impactMetrics: {
        accuracyChange: number;
        confidenceChange: number;
        consensusScoreChange: number;
        participationChange: number;
    };
    significance: 'minor' | 'moderate' | 'major';
}
/**
 * Rotation recommendation
 */
export interface RotationRecommendation {
    expertId: string;
    currentVersion: string;
    recommendedAction: 'keep' | 'update' | 'replace' | 'add_to_ensemble';
    reason: string;
    alternativeVersions: Array<{
        version: string;
        expectedImprovement: number;
        confidence: number;
    }>;
    priority: 'low' | 'medium' | 'high';
}
/**
 * Configuration for lineage tracker
 */
export interface LineageTrackerConfig {
    dbPath?: string;
    minOccurrencesForPattern?: number;
    versionComparisonWindow?: number;
}
/**
 * Consensus Lineage Tracker
 */
export declare class ConsensusLineageTracker {
    private db;
    private config;
    private agentDbReady;
    constructor(config?: LineageTrackerConfig);
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    private initializeAgentDb;
    /**
     * Ensure AgentDB (if enabled) has finished initializing
     */
    private ensureAgentDbReady;
    /**
     * Convenience helper to get initialized DB instance
     */
    private getDb;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Record a consensus decision
     * DUAL-WRITE: Saves to BOTH Supabase and AgentDB
     */
    recordConsensus(decision: ConsensusDecision): Promise<void>;
    /**
     * Update consensus outcome
     */
    updateOutcome(decisionId: string, outcome: 'correct' | 'incorrect' | 'partial'): Promise<void>;
    /**
     * Update version lineage tracking
     */
    private updateVersionLineage;
    /**
     * Get version lineage for an expert
     * DUAL-READ: Queries BOTH Supabase and AgentDB, merges results
     */
    getVersionLineage(expertId: string, project?: string): Promise<VersionLineage[]>;
    /**
     * Mark version as retired
     */
    retireVersion(expertId: string, version: string, project: string, replacedBy: string): Promise<void>;
    /**
     * Update or create consensus pattern
     */
    private updateConsensusPattern;
    /**
     * Recalculate pattern metrics
     */
    private recalculatePatternMetrics;
    /**
     * Get consensus patterns
     */
    getConsensusPatterns(minOccurrences?: number): Promise<ConsensusPattern[]>;
    /**
     * Analyze version impact when expert is updated
     */
    analyzeVersionImpact(expertId: string, oldVersion: string, newVersion: string, project: string): Promise<VersionImpact>;
    /**
     * Get version metrics
     */
    private getVersionMetrics;
    /**
     * Generate rotation recommendations
     */
    generateRotationRecommendations(project: string): Promise<RotationRecommendation[]>;
    /**
     * Get decision by ID
     */
    private getDecision;
    /**
     * Get decision participants
     */
    private getDecisionParticipants;
    /**
     * Get all decisions for a pattern
     */
    private getPatternDecisions;
    /**
     * Close database connection
     */
    close(): void;
}
/**
 * Create consensus lineage tracker
 */
export declare function createConsensusLineageTracker(config?: LineageTrackerConfig): ConsensusLineageTracker;
//# sourceMappingURL=lineage-tracker.d.ts.map