/**
 * Daily Digest Builder for IRIS
 *
 * Builds comprehensive daily summaries from IRIS evaluations
 * and formats them for WhatsApp delivery.
 *
 * @module digest-builder
 * @version 1.0.0
 */

import { irisPrime, type IrisPrime, type CrossProjectReport } from '../orchestrators/iris-prime.js'
import type { DailyDigest } from './types.js'
import type { IrisReport } from '../orchestrators/iris-prime.js'

/**
 * Build daily digest from IRIS evaluations
 *
 * @param projects - Optional list of project IDs to include
 * @param iris - Optional IRIS instance to reuse (avoids creating new instance)
 * @param crossReport - Optional pre-computed cross-project report (avoids re-evaluation)
 * @param reportCache - Optional cache of individual project reports (avoids re-evaluation)
 */
export async function buildDailyDigest(
  projects?: string[],
  iris?: IrisPrime,
  crossReport?: CrossProjectReport,
  reportCache?: Map<string, IrisReport>
): Promise<DailyDigest> {
  console.log('📊 Building daily digest...')

  // Get cross-project report (use cached if provided, otherwise evaluate)
  const crossEval = crossReport || await (iris ? iris.evaluateAllProjects() : irisPrime.evaluateAllProjects())

  const projectIds = projects || crossEval.projects.map(p => p.projectId)

  const digest: DailyDigest = {
    date: new Date().toISOString().slice(0, 10),
    projects: projectIds,
    drift: {
      critical: [],
      warnings: []
    },
    promotions: [],
    patterns: [],
    healthSummary: {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      critical: 0
    }
  }

  // Evaluate each project in detail (use cache if available)
  for (const projectId of projectIds) {
    // Check cache first to avoid duplicate evaluation
    const report = reportCache?.get(projectId) || await (iris ? iris.evaluateProject(projectId) : irisPrime.evaluateProject(projectId))

    // Count health levels
    digest.healthSummary[report.overallHealth]++

    // Extract drift alerts
    for (const alert of report.driftAlerts) {
      const entry = {
        project: projectId,
        expertId: alert.expertId,
        drop: alert.percentageChange
      }

      if (alert.severity === 'critical') {
        digest.drift.critical.push(entry)
      } else if (alert.severity === 'warning') {
        digest.drift.warnings.push(entry)
      }
    }

    // Extract promotions
    for (const rec of report.promptRecommendations) {
      digest.promotions.push({
        project: projectId,
        expertId: rec.expertId,
        oldVersion: rec.currentVersion,
        newVersion: rec.recommendedVersion,
        oldAcc: 0, // Would get from prompt registry
        newAcc: rec.expectedImprovement
      })
    }

    // Extract transferable patterns
    for (const pattern of report.transferablePatterns) {
      digest.patterns.push({
        fromProject: pattern.sourceProject,
        toProject: projectId,
        name: pattern.name,
        transferPotential: pattern.transferPotential
      })
    }
  }

  console.log(`✓ Digest built: ${digest.drift.critical.length} critical, ${digest.promotions.length} promos`)

  return digest
}

/**
 * Format daily digest for WhatsApp
 */
export function formatDailyDigest(digest: DailyDigest): string {
  const lines: string[] = []

  // Header
  lines.push(`🧠 *IRIS Daily Digest – ${digest.date}*`)
  lines.push('')
  lines.push(`*Projects:* ${digest.projects.join(', ')}`)
  lines.push('')

  // Health summary
  lines.push('*Overall Health:*')
  const healthIcons = {
    excellent: '🟢',
    good: '🔵',
    fair: '🟡',
    poor: '🟠',
    critical: '🔴'
  }

  for (const [level, count] of Object.entries(digest.healthSummary)) {
    if (count > 0) {
      const icon = healthIcons[level as keyof typeof healthIcons]
      lines.push(`${icon} ${count} ${level}`)
    }
  }
  lines.push('')

  // Drift
  lines.push('*Drift:*')
  if (!digest.drift.critical.length && !digest.drift.warnings.length) {
    lines.push('✅ No notable drift')
  } else {
    if (digest.drift.critical.length) {
      lines.push(`🔴 ${digest.drift.critical.length} critical`)
      for (const c of digest.drift.critical.slice(0, 3)) {
        lines.push(`  • ${c.expertId} (${c.project}): ${(c.drop * 100).toFixed(1)}% drop`)
      }
      if (digest.drift.critical.length > 3) {
        lines.push(`  • ...and ${digest.drift.critical.length - 3} more`)
      }
    }
    if (digest.drift.warnings.length) {
      lines.push(`🟡 ${digest.drift.warnings.length} warnings`)
    }
  }
  lines.push('')

  // Promotions
  lines.push('*Promotions:*')
  if (!digest.promotions.length) {
    lines.push('(none today)')
  } else {
    for (const p of digest.promotions.slice(0, 3)) {
      lines.push(
        `✨ ${p.expertId} (${p.project}): ${p.oldVersion} → ${p.newVersion}`
      )
    }
    if (digest.promotions.length > 3) {
      lines.push(`...and ${digest.promotions.length - 3} more`)
    }
  }
  lines.push('')

  // Patterns
  lines.push('*Cross-Project Patterns:*')
  if (!digest.patterns.length) {
    lines.push('(no new suggestions)')
  } else {
    for (const pat of digest.patterns.slice(0, 3)) {
      lines.push(
        `🔁 ${pat.fromProject} → ${pat.toProject}: "${pat.name}" ` +
          `(${(pat.transferPotential * 100).toFixed(0)}%)`
      )
    }
    if (digest.patterns.length > 3) {
      lines.push(`...and ${digest.patterns.length - 3} more`)
    }
  }
  lines.push('')

  // Footer
  lines.push('Reply `menu` for commands')

  return lines.join('\n')
}

/**
 * Format project status for WhatsApp
 */
export function formatProjectStatus(projectName: string, report: IrisReport): string {
  const lines: string[] = []

  lines.push(`📊 *${projectName} Status*`)
  lines.push('')
  lines.push(`Health: ${report.overallHealth.toUpperCase()} (${report.healthScore}/100)`)
  lines.push('')

  // Drift
  if (report.driftAlerts.length > 0) {
    lines.push('*Drift Alerts:*')
    for (const alert of report.driftAlerts.slice(0, 3)) {
      lines.push(`• ${alert.expertId}: ${alert.driftType}`)
      lines.push(`  ${(alert.percentageChange * 100).toFixed(1)}% change (${alert.severity})`)
    }
    if (report.driftAlerts.length > 3) {
      lines.push(`...and ${report.driftAlerts.length - 3} more`)
    }
  } else {
    lines.push('✅ No drift detected')
  }
  lines.push('')

  // Actions
  if (report.recommendedActions.length > 0) {
    lines.push('*Top Actions:*')
    for (const action of report.recommendedActions.slice(0, 3)) {
      lines.push(`${action.priority === 'critical' ? '🔴' : '🟡'} ${action.action}`)
    }
  }

  return lines.join('\n')
}

/**
 * Format drift summary for WhatsApp
 */
export function formatDriftSummary(reports: IrisReport[]): string {
  const lines: string[] = []

  lines.push('⚠️ *Drift Summary*')
  lines.push('')

  let totalDrift = 0

  for (const report of reports) {
    if (report.driftAlerts.length === 0) continue

    totalDrift += report.driftAlerts.length

    lines.push(`*${report.projectId}:*`)

    const critical = report.driftAlerts.filter(a => a.severity === 'critical')
    const warnings = report.driftAlerts.filter(a => a.severity === 'warning')

    if (critical.length > 0) {
      lines.push(`🔴 ${critical.length} critical`)
      for (const alert of critical.slice(0, 2)) {
        lines.push(`  • ${alert.expertId}: ${(alert.percentageChange * 100).toFixed(1)}%`)
      }
    }

    if (warnings.length > 0) {
      lines.push(`🟡 ${warnings.length} warnings`)
    }

    lines.push('')
  }

  if (totalDrift === 0) {
    return '✅ *No Drift Detected*\n\nAll monitored experts performing within normal range.'
  }

  return lines.join('\n')
}

/**
 * Format pattern suggestions for WhatsApp
 */
export function formatPatternsSummary(patterns: any[]): string {
  const lines: string[] = []

  lines.push('🔍 *Transferable Patterns*')
  lines.push('')

  if (patterns.length === 0) {
    lines.push('(no new cross-project suggestions)')
    return lines.join('\n')
  }

  for (const pattern of patterns.slice(0, 5)) {
    lines.push(`• ${pattern.pattern.name}`)
    lines.push(`  From: ${pattern.pattern.project}`)
    lines.push(`  Transfer: ${(pattern.transferPotential * 100).toFixed(0)}%`)
    lines.push(`  Adaptation: ${pattern.adaptationRequired}`)
    lines.push('')
  }

  if (patterns.length > 5) {
    lines.push(`...and ${patterns.length - 5} more patterns`)
  }

  return lines.join('\n')
}

/**
 * Format multi-project status for WhatsApp
 */
export function formatMultiProjectStatus(reports: IrisReport[]): string {
  const lines: string[] = []

  lines.push('🧠 *IRIS Multi-Project Status*')
  lines.push('')

  for (const report of reports) {
    const icon =
      report.overallHealth === 'excellent'
        ? '🟢'
        : report.overallHealth === 'good'
        ? '🔵'
        : report.overallHealth === 'fair'
        ? '🟡'
        : report.overallHealth === 'poor'
        ? '🟠'
        : '🔴'

    const driftCount = report.driftAlerts.length
    const actionCount = report.recommendedActions.filter(a => a.priority === 'critical').length

    lines.push(`${icon} *${report.projectId}*: ${report.healthScore}/100`)
    lines.push(`  Drift: ${driftCount}, Critical actions: ${actionCount}`)
  }

  return lines.join('\n')
}
