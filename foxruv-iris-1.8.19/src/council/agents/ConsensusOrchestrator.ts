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

import type {
  AgentVote,
  ConsensusResult,
  VoteDecision,
  AgentAnalysis
} from '../types/index.js'

/**
 * ConsensusOrchestrator configuration
 */
export interface ConsensusOrchestratorConfig {
  consensusThreshold?: number // Minimum weighted confidence for approval
  maxIterations?: number // Max ReConcile refinement iterations
  voteWeight?: number
}

/**
 * ConsensusOrchestrator Agent - Aggregates votes and reaches consensus
 */
export class ConsensusOrchestrator {
  private config: Required<ConsensusOrchestratorConfig>

  constructor(config: ConsensusOrchestratorConfig = {}) {
    this.config = {
      consensusThreshold: config.consensusThreshold ?? 0.80,
      maxIterations: config.maxIterations ?? 3,
      voteWeight: config.voteWeight ?? 1.0
    }
  }

  /**
   * Reach consensus from agent analyses
   */
  async reachConsensus(analyses: AgentAnalysis[]): Promise<ConsensusResult> {
    // Convert analyses to votes
    let votes = this.analysesToVotes(analyses)

    let iterations = 0

    while (iterations < this.config.maxIterations) {
      // Calculate weighted consensus
      const result = this.calculateWeightedConsensus(votes, iterations)

      // Check if threshold reached
      if (result.confidence >= this.config.consensusThreshold) {
        return result
      }

      // Refine votes for next iteration (ReConcile algorithm)
      if (iterations < this.config.maxIterations - 1) {
        votes = this.refineVotes(votes, result)
      }

      iterations++
    }

    // Max iterations reached without consensus
    return this.calculateWeightedConsensus(votes, iterations)
  }

  /**
   * Convert agent analyses to votes
   */
  private analysesToVotes(analyses: AgentAnalysis[]): AgentVote[] {
    return analyses.map(analysis => ({
      agent: analysis.agent,
      decision: analysis.recommendation,
      confidence: analysis.confidence,
      weight: this.getAgentWeight(analysis.agent),
      evidence: analysis.evidence,
      reasoning: this.extractReasoning(analysis),
      timestamp: new Date()
    }))
  }

  /**
   * Get vote weight for an agent
   */
  private getAgentWeight(agent: string): number {
    const weights: Record<string, number> = {
      'PatternMaster': 2.0,
      'PromptScientist': 2.0,
      'PerformanceJudge': 2.0,
      'TransferTester': 1.5,
      'SafetyValidator': 1.5
    }
    return weights[agent] || 1.0
  }

  /**
   * Extract reasoning from agent analysis
   */
  private extractReasoning(analysis: AgentAnalysis): string[] {
    const reasoning: string[] = []

    switch (analysis.agent) {
      case 'PatternMaster':
        if ('transferCandidates' in analysis) {
          reasoning.push(`Found ${analysis.transferCandidates.length} transfer candidates`)
          if (analysis.transferCandidates.length > 0) {
            reasoning.push(...analysis.transferCandidates[0].reasoning)
          }
        }
        break

      case 'PromptScientist':
        if ('deploymentCandidates' in analysis) {
          reasoning.push(`${analysis.deploymentCandidates.length} prompt(s) ready for deployment`)
          if (analysis.deploymentCandidates.length > 0) {
            reasoning.push(...analysis.deploymentCandidates[0].reasoning)
          }
        }
        break

      case 'PerformanceJudge':
        if ('rotationRecommendations' in analysis) {
          reasoning.push(`${analysis.rotationRecommendations.length} rotation recommendation(s)`)
          reasoning.push(`${analysis.driftingExperts.length} expert(s) drifting`)
        }
        break

      case 'TransferTester':
        if ('testsCompleted' in analysis) {
          const passed = analysis.testsCompleted.filter(t => t.passed).length
          reasoning.push(`${passed}/${analysis.testsCompleted.length} tests passed`)
        }
        break

      case 'SafetyValidator':
        if ('safetyChecks' in analysis) {
          const passed = analysis.safetyChecks.filter(c => c.passed).length
          reasoning.push(`Safety score: ${(analysis.safetyScore * 100).toFixed(0)}%`)
          reasoning.push(`${passed}/${analysis.safetyChecks.length} safety checks passed`)
        }
        break
    }

    return reasoning
  }

  /**
   * Calculate weighted consensus using ReConcile algorithm
   */
  private calculateWeightedConsensus(votes: AgentVote[], iterations: number): ConsensusResult {
    // Calculate total weight
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0)

    // Convert votes to numerical scores
    const voteScores = votes.map(vote => {
      let score: number
      switch (vote.decision) {
        case 'APPROVE':
          score = vote.confidence
          break
        case 'CONDITIONAL':
          score = vote.confidence * 0.7 // Conditional votes have reduced weight
          break
        case 'NEUTRAL':
          score = 0
          break
        case 'REJECT':
          score = -vote.confidence
          break
        default:
          score = 0
      }
      return { vote, score }
    })

    // Calculate weighted average score
    const weightedScore = voteScores.reduce(
      (sum, { vote, score }) => sum + (score * vote.weight),
      0
    ) / totalWeight

    // Normalize to 0-1 range
    const normalizedConfidence = (weightedScore + 1) / 2

    // Determine final decision
    let finalDecision: VoteDecision
    if (weightedScore > 0.5) {
      finalDecision = 'APPROVE'
    } else if (weightedScore > 0) {
      finalDecision = 'CONDITIONAL'
    } else if (weightedScore > -0.5) {
      finalDecision = 'NEUTRAL'
    } else {
      finalDecision = 'REJECT'
    }

    // Count vote breakdown
    const breakdown = {
      approveCount: votes.filter(v => v.decision === 'APPROVE').length,
      rejectCount: votes.filter(v => v.decision === 'REJECT').length,
      neutralCount: votes.filter(v => v.decision === 'NEUTRAL').length,
      conditionalCount: votes.filter(v => v.decision === 'CONDITIONAL').length
    }

    return {
      consensusReached: normalizedConfidence >= this.config.consensusThreshold,
      decision: finalDecision,
      confidence: normalizedConfidence,
      votes,
      iterations,
      breakdown
    }
  }

  /**
   * Refine votes for next iteration (ReConcile algorithm)
   */
  private refineVotes(votes: AgentVote[], currentResult: ConsensusResult): AgentVote[] {
    // In ReConcile, agents can adjust their votes based on others' reasoning
    // For simplicity, we slightly boost confidence of majority opinion
    const majorityDecision = currentResult.decision

    return votes.map(vote => {
      if (vote.decision === majorityDecision) {
        // Boost confidence slightly for majority opinion
        return {
          ...vote,
          confidence: Math.min(vote.confidence * 1.05, 1.0)
        }
      } else {
        // Slightly reduce confidence for minority opinion
        return {
          ...vote,
          confidence: vote.confidence * 0.95
        }
      }
    })
  }

  /**
   * Get agent vote weight
   */
  getVoteWeight(): number {
    return this.config.voteWeight
  }
}

/**
 * Create ConsensusOrchestrator agent
 */
export function createConsensusOrchestrator(
  config?: ConsensusOrchestratorConfig
): ConsensusOrchestrator {
  return new ConsensusOrchestrator(config)
}
