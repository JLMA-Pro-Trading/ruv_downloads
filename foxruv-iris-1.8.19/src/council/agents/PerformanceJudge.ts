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

import type {
  CouncilTelemetryInput,
  PerformanceAnalysis,
  ExpertLeagueEntry,
  VoteDecision
} from '../types/index.js'

/**
 * PerformanceJudge configuration
 */
export interface PerformanceJudgeConfig {
  driftThreshold?: number // Accuracy drop to trigger drift
  criticalThreshold?: number // Critical drift threshold
  minRunsForRanking?: number
  voteWeight?: number
}

/**
 * PerformanceJudge Agent - Manages expert performance and rotations
 */
export class PerformanceJudge {
  private config: Required<PerformanceJudgeConfig>

  constructor(config: PerformanceJudgeConfig = {}) {
    this.config = {
      driftThreshold: config.driftThreshold ?? 0.1, // 10% drop
      criticalThreshold: config.criticalThreshold ?? 0.2, // 20% drop
      minRunsForRanking: config.minRunsForRanking ?? 10,
      voteWeight: config.voteWeight ?? 2.0
    }
  }

  /**
   * Analyze expert performance and generate recommendations
   */
  async analyze(telemetry: CouncilTelemetryInput): Promise<PerformanceAnalysis> {
    // Calculate league tables by expert type
    const leagues = this.calculateLeagues(telemetry)

    // Identify drifting experts
    const driftingExperts = this.identifyDrift(leagues, telemetry)

    // Find top performers
    const topPerformers = this.findTopPerformers(leagues)

    // Generate rotation recommendations
    const rotationRecommendations = this.generateRotationRecommendations(
      driftingExperts,
      topPerformers
    )

    // Generate vote
    const { recommendation, confidence } = this.generateRecommendation(
      driftingExperts,
      rotationRecommendations
    )

    return {
      agent: 'PerformanceJudge',
      leagues,
      driftingExperts,
      topPerformers,
      rotationRecommendations,
      recommendation,
      confidence,
      evidence: {
        totalExperts: Array.from(leagues.values()).flat().length,
        driftingCount: driftingExperts.length,
        topPerformerCount: topPerformers.length,
        avgAccuracy: this.calculateAvgAccuracy(leagues)
      }
    }
  }

  /**
   * Calculate league tables by expert type
   */
  private calculateLeagues(
    telemetry: CouncilTelemetryInput
  ): Map<string, ExpertLeagueEntry[]> {
    const leagues = new Map<string, ExpertLeagueEntry[]>()

    // Collect all experts by type
    for (const projectData of telemetry.projects) {
      for (const expert of projectData.experts) {
        if (expert.metrics.totalRuns < this.config.minRunsForRanking) continue

        if (!leagues.has(expert.expertType)) {
          leagues.set(expert.expertType, [])
        }

        const entry: ExpertLeagueEntry = {
          expertId: expert.expertId,
          project: projectData.project,
          expertType: expert.expertType,
          accuracy: expert.metrics.accuracy,
          confidence: expert.metrics.confidence,
          latency: expert.metrics.latency,
          rank: 0, // Will be assigned after sorting
          trend: this.inferTrend(expert, telemetry),
          driftSeverity: expert.drift?.severity
        }

        leagues.get(expert.expertType)!.push(entry)
      }
    }

    // Sort each league by accuracy and assign ranks
    for (const entries of leagues.values()) {
      entries.sort((a, b) => b.accuracy - a.accuracy)
      entries.forEach((entry, index) => {
        entry.rank = index + 1
      })
    }

    return leagues
  }

  /**
   * Infer performance trend
   */
  private inferTrend(
    expert: any,
    _telemetry: CouncilTelemetryInput
  ): 'improving' | 'stable' | 'declining' {
    // If drift detected, it's declining
    if (expert.drift?.detected) {
      return 'declining'
    }

    // High accuracy suggests stability or improvement
    if (expert.metrics.accuracy >= 0.9) {
      return expert.metrics.accuracy >= 0.95 ? 'improving' : 'stable'
    }

    // Moderate accuracy
    if (expert.metrics.accuracy >= 0.75) {
      return 'stable'
    }

    // Low accuracy
    return 'declining'
  }

  /**
   * Identify drifting experts
   */
  private identifyDrift(
    leagues: Map<string, ExpertLeagueEntry[]>,
    telemetry: CouncilTelemetryInput
  ): ExpertLeagueEntry[] {
    const drifting: ExpertLeagueEntry[] = []

    for (const entries of leagues.values()) {
      for (const entry of entries) {
        // Check if expert has drift alert
        const hasDriftAlert = telemetry.alerts.some(
          alert =>
            alert.expertId === entry.expertId &&
            (alert.severity === 'warning' || alert.severity === 'critical')
        )

        // Or if accuracy is critically low
        const isCriticallyLow = entry.accuracy < 0.75

        if (hasDriftAlert || isCriticallyLow) {
          drifting.push(entry)
        }
      }
    }

    // Sort by severity (worst first)
    return drifting.sort((a, b) => a.accuracy - b.accuracy)
  }

  /**
   * Find top performers across all leagues
   */
  private findTopPerformers(
    leagues: Map<string, ExpertLeagueEntry[]>
  ): ExpertLeagueEntry[] {
    const topPerformers: ExpertLeagueEntry[] = []

    for (const entries of leagues.values()) {
      // Get #1 ranked expert from each league
      if (entries.length > 0 && entries[0].accuracy >= 0.85) {
        topPerformers.push(entries[0])
      }
    }

    return topPerformers.sort((a, b) => b.accuracy - a.accuracy)
  }

  /**
   * Generate rotation recommendations
   */
  private generateRotationRecommendations(
    driftingExperts: ExpertLeagueEntry[],
    topPerformers: ExpertLeagueEntry[]
  ): Array<{
    action: 'promote' | 'demote' | 'retrain'
    expert: ExpertLeagueEntry
    reasoning: string[]
  }> {
    const recommendations: Array<{
      action: 'promote' | 'demote' | 'retrain'
      expert: ExpertLeagueEntry
      reasoning: string[]
    }> = []

    // Recommend retraining for drifting experts
    for (const expert of driftingExperts) {
      const reasoning: string[] = [
        `Accuracy: ${(expert.accuracy * 100).toFixed(1)}% (rank ${expert.rank})`,
        `Trend: ${expert.trend}`
      ]

      if (expert.driftSeverity) {
        reasoning.push(`Drift severity: ${expert.driftSeverity}`)
      }

      // Critical drift -> immediate retraining
      if (expert.accuracy < 0.75) {
        reasoning.push('CRITICAL: Accuracy below 75% threshold')
        recommendations.push({
          action: 'retrain',
          expert,
          reasoning
        })
      } else {
        // Moderate drift -> demote and monitor
        reasoning.push('WARNING: Performance degradation detected')
        recommendations.push({
          action: 'demote',
          expert,
          reasoning
        })
      }
    }

    // Recommend promotion for top performers
    for (const expert of topPerformers.slice(0, 3)) {
      if (expert.accuracy >= 0.95) {
        recommendations.push({
          action: 'promote',
          expert,
          reasoning: [
            `Top performer with ${(expert.accuracy * 100).toFixed(1)}% accuracy`,
            `Rank #${expert.rank} in ${expert.expertType} league`,
            `Recommend as reference for cross-project learning`
          ]
        })
      }
    }

    return recommendations
  }

  /**
   * Generate voting recommendation
   */
  private generateRecommendation(
    driftingExperts: ExpertLeagueEntry[],
    _rotationRecommendations: any[]
  ): { recommendation: VoteDecision; confidence: number } {
    // If critical drift detected, strongly approve rotation
    const criticalDrift = driftingExperts.some(e => e.accuracy < 0.75)

    if (criticalDrift) {
      return {
        recommendation: 'APPROVE',
        confidence: 0.98
      }
    }

    // If moderate drift, conditional approval
    if (driftingExperts.length > 0) {
      return {
        recommendation: 'CONDITIONAL',
        confidence: 0.85
      }
    }

    // No significant issues, maintain status quo
    return {
      recommendation: 'APPROVE',
      confidence: 0.90
    }
  }

  /**
   * Calculate average accuracy across all leagues
   */
  private calculateAvgAccuracy(leagues: Map<string, ExpertLeagueEntry[]>): number {
    let totalAccuracy = 0
    let count = 0

    for (const entries of leagues.values()) {
      for (const entry of entries) {
        totalAccuracy += entry.accuracy
        count++
      }
    }

    return count > 0 ? totalAccuracy / count : 0
  }

  /**
   * Get agent vote weight
   */
  getVoteWeight(): number {
    return this.config.voteWeight
  }
}

/**
 * Create PerformanceJudge agent
 */
export function createPerformanceJudge(config?: PerformanceJudgeConfig): PerformanceJudge {
  return new PerformanceJudge(config)
}
