/**
 * PatternMaster Agent - Tier 1 Core Decision Maker
 *
 * Discovers cross-project patterns using AgentDB vector search
 *
 * Responsibilities:
 * - Analyze telemetry for transferable patterns
 * - Use vector similarity to find cross-project patterns
 * - Evaluate pattern success rates and domain overlap
 * - Vote on pattern transfer decisions
 *
 * @module council/agents/PatternMaster
 * @version 1.0.0
 */
import type { CouncilTelemetryInput, PatternAnalysis } from '../types/index.js';
/**
 * PatternMaster configuration
 */
export interface PatternMasterConfig {
    agentDbPath?: string;
    minSuccessRate?: number;
    minSampleSize?: number;
    similarityThreshold?: number;
    voteWeight?: number;
}
/**
 * PatternMaster Agent - Discovers cross-project patterns
 */
export declare class PatternMaster {
    private agentDb;
    private config;
    constructor(config?: PatternMasterConfig);
    /**
     * Analyze telemetry and discover transferable patterns
     */
    analyze(telemetry: CouncilTelemetryInput): Promise<PatternAnalysis>;
    /**
     * Extract patterns from telemetry data
     */
    private extractPatterns;
    /**
     * Infer pattern type from expert characteristics
     */
    private inferPatternType;
    /**
     * Find transfer candidates using vector similarity
     */
    private findTransferCandidates;
    /**
     * Find projects compatible with a pattern
     */
    private findCompatibleProjects;
    /**
     * Generate voting recommendation
     */
    private generateRecommendation;
    /**
     * Get agent vote weight
     */
    getVoteWeight(): number;
    /**
     * Close resources
     */
    close(): void;
}
/**
 * Create PatternMaster agent
 */
export declare function createPatternMaster(config?: PatternMasterConfig): PatternMaster;
//# sourceMappingURL=PatternMaster.d.ts.map