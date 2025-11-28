/**
 * Telemetry Aggregator
 *
 * Aggregates telemetry from GlobalMetrics into CouncilTelemetryInput format
 *
 * @module council/utils/telemetry-aggregator
 */

import type { CouncilTelemetryInput } from '../types/index.js'
import { GlobalMetricsCollector } from '../../telemetry/global-metrics.js'
import { PatternDiscovery } from '../../patterns/pattern-discovery.js'

/**
 * Aggregate telemetry for council analysis
 */
export async function aggregateTelemetryForCouncil(
  projects: string[],
  timeWindow: { start: Date; end: Date },
  metricsCollector: GlobalMetricsCollector,
  patternDiscovery?: PatternDiscovery
): Promise<CouncilTelemetryInput> {
  const projectData = []

  // Collect metrics for each project
  for (const project of projects) {
    const experts = await metricsCollector.getProjectMetrics(project)

    const expertData = experts.map(expert => ({
      expertId: expert.expertId,
      expertType: inferExpertType(expert.expertId),
      version: expert.version,
      metrics: {
        accuracy: expert.accuracy,
        confidence: expert.avgConfidence,
        latency: expert.avgDuration,
        totalRuns: expert.totalPredictions
      }
      // drift field will be added later if detected
    }))

    projectData.push({
      project,
      eventCount: experts.reduce((sum, e) => sum + e.totalPredictions, 0),
      experts: expertData
    })
  }

  // Get drift alerts
  const alerts = await metricsCollector.getUnacknowledgedAlerts()
  const councilAlerts = alerts.map(alert => ({
    alertId: alert.alertId,
    project: alert.project,
    expertId: alert.expertId,
    severity: alert.severityLevel,
    message: alert.message
  }))

  // Add drift information to expert data
  for (const alert of alerts) {
    for (const project of projectData) {
      const expert = project.experts.find((e: any) => e.expertId === alert.expertId)
      if (expert) {
        (expert as any).drift = {
          detected: true,
          severity: alert.severityLevel,
          metric: alert.driftType,
          change: alert.percentageChange
        }
      }
    }
  }

  // Discover patterns (if pattern discovery available)
  const patterns = patternDiscovery
    ? await discoverPatterns(projectData, patternDiscovery)
    : []

  const duration = Math.floor((timeWindow.end.getTime() - timeWindow.start.getTime()) / 1000)
  const durationStr = duration < 3600
    ? `${Math.floor(duration / 60)}m`
    : duration < 86400
    ? `${Math.floor(duration / 3600)}h`
    : `${Math.floor(duration / 86400)}d`

  return {
    timeWindow: {
      start: timeWindow.start,
      end: timeWindow.end,
      duration: durationStr
    },
    projects: projectData,
    patterns,
    alerts: councilAlerts
  }
}

/**
 * Infer expert type from expert ID
 */
function inferExpertType(expertId: string): string {
  const lowerId = expertId.toLowerCase()

  if (lowerId.includes('analyst')) return 'analyst'
  if (lowerId.includes('predictor')) return 'predictor'
  if (lowerId.includes('optimizer')) return 'optimizer'
  if (lowerId.includes('researcher')) return 'researcher'
  if (lowerId.includes('reviewer')) return 'reviewer'

  return 'general'
}

/**
 * Discover patterns from project data
 */
async function discoverPatterns(
  projectData: any[],
  _patternDiscovery: PatternDiscovery
): Promise<any[]> {
  const patterns = []

  // Find high-performing experts as pattern sources
  for (const project of projectData) {
    for (const expert of project.experts) {
      if (expert.metrics.accuracy >= 0.90 && expert.metrics.totalRuns >= 50) {
        patterns.push({
          id: `pattern-${project.project}-${expert.expertId}-${Date.now()}`,
          name: `${expert.expertType}_pattern_${project.project}`,
          description: `High-performing pattern from ${expert.expertId}`,
          sourceProject: project.project,
          sourceExpert: expert.expertId,
          pattern: {
            type: expert.metrics.confidence > 0.85 ? 'confidence_calibration' : 'general_optimization',
            implementation: expert.expertType,
            config: {
              expertType: expert.expertType,
              version: expert.version,
              accuracy: expert.metrics.accuracy
            }
          },
          successRate: expert.metrics.accuracy,
          sampleSize: expert.metrics.totalRuns,
          domains: [project.project, expert.expertType]
        })
      }
    }
  }

  return patterns
}
