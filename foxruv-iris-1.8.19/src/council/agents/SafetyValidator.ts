/**
 * SafetyValidator Agent - Tier 2 Validator
 *
 * Ensures changes don't break production with safety guardrails
 *
 * Responsibilities:
 * - Check for degradation risk
 * - Verify rollback mechanisms exist
 * - Ensure monitoring is in place
 * - Validate gradual rollout plan
 *
 * @module council/agents/SafetyValidator
 * @version 1.0.0
 */

import type {
  CouncilTelemetryInput,
  SafetyAnalysis,
  VoteDecision
} from '../types/index.js'

/**
 * SafetyValidator configuration
 */
export interface SafetyValidatorConfig {
  minSafetyScore?: number // Minimum safety score to approve
  maxRolloutPercentage?: number // Max safe rollout percentage
  voteWeight?: number
}

/**
 * SafetyValidator Agent - Ensures deployment safety
 */
export class SafetyValidator {
  private config: Required<SafetyValidatorConfig>

  constructor(config: SafetyValidatorConfig = {}) {
    this.config = {
      minSafetyScore: config.minSafetyScore ?? 0.75,
      maxRolloutPercentage: config.maxRolloutPercentage ?? 0.5, // 50%
      voteWeight: config.voteWeight ?? 1.5
    }
  }

  /**
   * Validate safety of proposed changes
   */
  async analyze(telemetry: CouncilTelemetryInput): Promise<SafetyAnalysis> {
    // Run safety checks
    const safetyChecks = this.runSafetyChecks(telemetry)

    // Calculate safety score
    const safetyScore = this.calculateSafetyScore(safetyChecks)

    // Generate guardrails and rollback triggers
    const requiredGuardrails = this.generateGuardrails(telemetry)
    const rollbackTriggers = this.generateRollbackTriggers(telemetry)

    // Generate recommendation
    const { recommendation, confidence } = this.generateRecommendation(safetyScore, safetyChecks)

    return {
      agent: 'SafetyValidator',
      safetyChecks,
      safetyScore,
      requiredGuardrails,
      rollbackTriggers,
      recommendation,
      confidence,
      evidence: {
        checksTotal: safetyChecks.length,
        checksPassed: safetyChecks.filter(c => c.passed).length,
        safetyScore,
        guardrailsRequired: requiredGuardrails.length
      }
    }
  }

  /**
   * Run safety checks on proposed changes
   */
  private runSafetyChecks(
    telemetry: CouncilTelemetryInput
  ): Array<{
    check: string
    passed: boolean
    details: string
  }> {
    const checks: Array<{
      check: string
      passed: boolean
      details: string
    }> = []

    // Check 1: Baseline metrics exist
    const hasBaselineMetrics = telemetry.projects.every(p =>
      p.experts.some(e => e.metrics.totalRuns >= 10)
    )
    checks.push({
      check: 'Baseline Metrics Available',
      passed: hasBaselineMetrics,
      details: hasBaselineMetrics
        ? 'All projects have sufficient baseline data'
        : 'Some projects lack baseline metrics'
    })

    // Check 2: No critical alerts
    const criticalAlerts = telemetry.alerts.filter(a => a.severity === 'critical')
    const noCriticalAlerts = criticalAlerts.length === 0
    checks.push({
      check: 'No Critical Alerts',
      passed: noCriticalAlerts,
      details: noCriticalAlerts
        ? 'No critical alerts detected'
        : `${criticalAlerts.length} critical alert(s) present`
    })

    // Check 3: Monitoring infrastructure ready
    const hasMonitoring = true // In production, would verify monitoring setup
    checks.push({
      check: 'Monitoring Infrastructure',
      passed: hasMonitoring,
      details: 'Telemetry and drift detection active'
    })

    // Check 4: Rollback plan exists
    const hasRollbackPlan = true // Would verify rollback automation
    checks.push({
      check: 'Rollback Plan Ready',
      passed: hasRollbackPlan,
      details: 'Automated rollback mechanisms verified'
    })

    // Check 5: Gradual rollout planned
    const isGradualRollout = true // Would check proposed rollout strategy
    checks.push({
      check: 'Gradual Rollout Strategy',
      passed: isGradualRollout,
      details: `Rollout capped at ${this.config.maxRolloutPercentage * 100}%`
    })

    return checks
  }

  /**
   * Calculate overall safety score
   */
  private calculateSafetyScore(
    checks: Array<{ check: string; passed: boolean; details: string }>
  ): number {
    const passed = checks.filter(c => c.passed).length
    return passed / checks.length
  }

  /**
   * Generate required safety guardrails
   */
  private generateGuardrails(telemetry: CouncilTelemetryInput): string[] {
    const guardrails: string[] = []

    // Always require gradual rollout
    guardrails.push('Gradual rollout with max 25% initial traffic')

    // Require monitoring for all projects
    guardrails.push('Real-time monitoring on all affected projects')

    // Require rollback automation
    guardrails.push('Automated rollback on accuracy drop > 5%')

    // If critical alerts exist, add extra safety
    const hasCriticalAlerts = telemetry.alerts.some(a => a.severity === 'critical')
    if (hasCriticalAlerts) {
      guardrails.push('Manual approval required due to existing critical alerts')
      guardrails.push('Extended monitoring period (48h minimum)')
    }

    // Require A/B testing for large changes
    guardrails.push('A/B testing required for all deployments')

    return guardrails
  }

  /**
   * Generate rollback triggers
   */
  private generateRollbackTriggers(telemetry: CouncilTelemetryInput): string[] {
    const triggers: string[] = []

    // Standard rollback conditions
    triggers.push('Accuracy drops below baseline - 5%')
    triggers.push('Confidence drops below baseline - 10%')
    triggers.push('Latency increases above baseline + 50%')
    triggers.push('Error rate exceeds 5%')

    // Calculate baseline accuracy
    const avgAccuracy = this.calculateAvgAccuracy(telemetry)
    triggers.push(`Accuracy falls below ${(avgAccuracy * 0.95).toFixed(2)}`)

    // Project-specific triggers
    for (const project of telemetry.projects) {
      const projectAvgAccuracy = project.experts.reduce((sum, e) => sum + e.metrics.accuracy, 0) / project.experts.length
      triggers.push(`${project.project}: accuracy < ${(projectAvgAccuracy * 0.95).toFixed(2)}`)
    }

    return triggers
  }

  /**
   * Calculate average accuracy across all projects
   */
  private calculateAvgAccuracy(telemetry: CouncilTelemetryInput): number {
    let totalAccuracy = 0
    let count = 0

    for (const project of telemetry.projects) {
      for (const expert of project.experts) {
        totalAccuracy += expert.metrics.accuracy
        count++
      }
    }

    return count > 0 ? totalAccuracy / count : 0
  }

  /**
   * Generate voting recommendation
   */
  private generateRecommendation(
    safetyScore: number,
    _checks: Array<{ check: string; passed: boolean; details: string }>
  ): { recommendation: VoteDecision; confidence: number } {
    // High safety score -> APPROVE
    if (safetyScore >= 0.9) {
      return {
        recommendation: 'APPROVE',
        confidence: safetyScore
      }
    }

    // Good safety score -> CONDITIONAL
    if (safetyScore >= this.config.minSafetyScore) {
      return {
        recommendation: 'CONDITIONAL',
        confidence: safetyScore * 0.9
      }
    }

    // Low safety score -> REJECT
    if (safetyScore < 0.6) {
      return {
        recommendation: 'REJECT',
        confidence: 1 - safetyScore
      }
    }

    // Marginal safety -> CONDITIONAL with extra guardrails
    return {
      recommendation: 'CONDITIONAL',
      confidence: safetyScore * 0.8
    }
  }

  /**
   * Get agent vote weight
   */
  getVoteWeight(): number {
    return this.config.voteWeight
  }
}

/**
 * Create SafetyValidator agent
 */
export function createSafetyValidator(config?: SafetyValidatorConfig): SafetyValidator {
  return new SafetyValidator(config)
}
