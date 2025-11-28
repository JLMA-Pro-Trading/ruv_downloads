/**
 * Consensus lineage utilities for tracking multi-expert decisions
 */
import { ConsensusLineage } from './types.js';
export interface ExpertContribution {
    expertId: string;
    version: string;
    vote: any;
    confidence: number;
    reasoning?: string;
}
/**
 * Record a consensus decision from multiple experts
 */
export declare function recordConsensusLineage(sectionTag: string, contributingExperts: ExpertContribution[], finalDecision: Record<string, any>, confidence: number, options?: {
    taskId?: string;
    runId?: string;
    winningVersion?: string;
    disagreementScore?: number;
    reasoningChains?: Record<string, any>;
    metadata?: Record<string, any>;
}): Promise<ConsensusLineage>;
/**
 * Get consensus history for a section/tag
 */
export declare function getConsensusHistory(sectionTag: string, limit?: number): Promise<ConsensusLineage[]>;
/**
 * Get consensus decision by task or run ID
 */
export declare function getConsensusForTask(taskId: string): Promise<ConsensusLineage | null>;
/**
 * Calculate consensus from expert votes
 * Uses weighted voting based on confidence
 */
export declare function calculateConsensus(experts: ExpertContribution[], votingStrategy?: 'majority' | 'weighted' | 'highest-confidence'): {
    winningVote: any;
    winningExpert: string;
    confidence: number;
    disagreementScore: number;
};
/**
 * Get expert participation stats
 */
export declare function getExpertParticipationStats(expertId: string, options?: {
    startDate?: Date;
    endDate?: Date;
}): Promise<{
    totalConsensus: number;
    timesWon: number;
    avgConfidence: number;
    avgDisagreement: number;
    winRate: number;
}>;
//# sourceMappingURL=consensus.d.ts.map