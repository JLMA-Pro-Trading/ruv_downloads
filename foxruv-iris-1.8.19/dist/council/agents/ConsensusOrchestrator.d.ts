/**
 * ConsensusOrchestrator Agent - Tier 3 Orchestration
 *
 * Aggregates votes using ReConcile algorithm and executes decisions
 *
 * Responsibilities:
 * - Collect votes from all 5 council members
 * - Calculate weighted consensus using ReConcile
 * - Determine if consensus threshold is reached
 * - Execute approved decisions
 * - Store results for learning
 *
 * @module council/agents/ConsensusOrchestrator
 * @version 1.0.0
 */
import type { ConsensusResult, AgentAnalysis } from '../types/index.js';
/**
 * ConsensusOrchestrator configuration
 */
export interface ConsensusOrchestratorConfig {
    consensusThreshold?: number;
    maxIterations?: number;
    voteWeight?: number;
}
/**
 * ConsensusOrchestrator Agent - Aggregates votes and reaches consensus
 */
export declare class ConsensusOrchestrator {
    private config;
    constructor(config?: ConsensusOrchestratorConfig);
    /**
     * Reach consensus from agent analyses
     */
    reachConsensus(analyses: AgentAnalysis[]): Promise<ConsensusResult>;
    /**
     * Convert agent analyses to votes
     */
    private analysesToVotes;
    /**
     * Get vote weight for an agent
     */
    private getAgentWeight;
    /**
     * Extract reasoning from agent analysis
     */
    private extractReasoning;
    /**
     * Calculate weighted consensus using ReConcile algorithm
     */
    private calculateWeightedConsensus;
    /**
     * Refine votes for next iteration (ReConcile algorithm)
     */
    private refineVotes;
    /**
     * Get agent vote weight
     */
    getVoteWeight(): number;
}
/**
 * Create ConsensusOrchestrator agent
 */
export declare function createConsensusOrchestrator(config?: ConsensusOrchestratorConfig): ConsensusOrchestrator;
//# sourceMappingURL=ConsensusOrchestrator.d.ts.map