/**
 * Events and anomaly detection helpers
 * Provides event feed and anomaly tracking for dashboards
 */

import { getSupabase } from './client.js';
import { detectDrift } from './telemetry.js';

export interface SystemEvent {
  id: string;
  timestamp: string;
  project: string;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata?: Record<string, any>;
}

export interface Anomaly {
  id: string;
  timestamp: string;
  project: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  expected: number;
  deviation: number;
  description: string;
  resolved: boolean;
}

/**
 * Get recent events for dashboard feed
 * Combines data from iris_reports, model_run_log, etc.
 */
export async function getRecentEvents(
  projectId?: string,
  limit: number = 20
): Promise<SystemEvent[]> {
  const supabase = getSupabase();
  const events: SystemEvent[] = [];

  // Get recent IRIS reports as events
  let reportsQuery = supabase
    .from('iris_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (projectId) {
    reportsQuery = reportsQuery.eq('project', projectId);
  }

  const { data: reports } = await reportsQuery;

  if (reports) {
    reports.forEach(report => {
      events.push({
        id: `report-${report.id}`,
        timestamp: report.created_at!,
        project: report.project,
        event_type: 'health_evaluation',
        severity: report.overall_health === 'critical' ? 'critical' :
                  report.overall_health === 'degraded' ? 'warning' : 'info',
        message: `Health evaluation completed: ${report.overall_health} (score: ${report.health_score})`,
        metadata: {
          health_score: report.health_score,
          drift_alerts: report.drift_alerts_count,
          recommended_actions: report.recommended_actions_count,
        },
      });
    });
  }

  // Get recent errors from model_run_log
  let errorsQuery = supabase
    .from('model_run_log')
    .select('*')
    .not('error_message', 'is', null)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (projectId) {
    errorsQuery = errorsQuery.eq('project', projectId);
  }

  const { data: errors } = await errorsQuery;

  if (errors) {
    errors.forEach(error => {
      events.push({
        id: `error-${error.id}`,
        timestamp: error.timestamp!,
        project: error.project,
        event_type: 'expert_error',
        severity: 'warning',
        message: `Expert ${error.expert_id} failed: ${error.error_message}`,
        metadata: {
          expert_id: error.expert_id,
          version: error.version,
          error_message: error.error_message,
        },
      });
    });
  }

  // Get recent consensus events
  let consensusQuery = supabase
    .from('consensus_lineage')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (projectId) {
    consensusQuery = consensusQuery.eq('project', projectId);
  }

  const { data: consensus } = await consensusQuery;

  if (consensus) {
    consensus.forEach(cons => {
      const disagreement = cons.disagreement_score || 0;
      events.push({
        id: `consensus-${cons.id}`,
        timestamp: cons.created_at!,
        project: cons.project,
        event_type: 'consensus_reached',
        severity: disagreement > 0.5 ? 'warning' : 'info',
        message: `Consensus reached with ${disagreement.toFixed(2)} disagreement score`,
        metadata: {
          experts: cons.contributing_experts.length,
          disagreement_score: disagreement,
          confidence: cons.confidence,
        },
      });
    });
  }

  // Sort all events by timestamp
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}

/**
 * Get anomalies detected from drift detection
 * Returns anomalies from recent drift checks
 */
export async function getAnomalies(
  projectId?: string,
  limit: number = 20
): Promise<Anomaly[]> {
  const supabase = getSupabase();
  const anomalies: Anomaly[] = [];

  // Get all experts and check for drift
  let expertQuery = supabase
    .from('model_run_log')
    .select('expert_id, version, project')
    .order('timestamp', { ascending: false });

  if (projectId) {
    expertQuery = expertQuery.eq('project', projectId);
  }

  const { data: expertLogs } = await expertQuery;

  if (expertLogs && expertLogs.length > 0) {
    // Get unique expert-version combinations
    const expertVersions = new Map<string, { project: string; expert_id: string; version: string }>();
    expertLogs.forEach(log => {
      const key = `${log.project}-${log.expert_id}-${log.version}`;
      if (!expertVersions.has(key)) {
        expertVersions.set(key, {
          project: log.project,
          expert_id: log.expert_id,
          version: log.version || 'unknown',
        });
      }
    });

    // Check drift for each expert
    for (const [key, expert] of Array.from(expertVersions.entries()).slice(0, 10)) {
      try {
        const drift = await detectDrift(expert.expert_id, expert.version, {
          recentWindow: 24,
          thresholdPct: 10,
        });

        if (drift.driftDetected) {
          anomalies.push({
            id: `drift-${key}`,
            timestamp: new Date().toISOString(),
            project: expert.project,
            type: 'performance_drift',
            severity: drift.confidenceDrop > 20 ? 'critical' : 'warning',
            metric: 'confidence',
            value: drift.recentConfidence,
            expected: drift.baselineConfidence,
            deviation: drift.confidenceDrop,
            description: `Expert ${expert.expert_id} showing ${drift.confidenceDrop.toFixed(1)}% confidence drop`,
            resolved: false,
          });
        }
      } catch (err) {
        // Skip experts with insufficient data
      }
    }
  }

  // Get recent health degradations
  let healthQuery = supabase
    .from('iris_reports')
    .select('*')
    .in('overall_health', ['degraded', 'critical'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (projectId) {
    healthQuery = healthQuery.eq('project', projectId);
  }

  const { data: healthReports } = await healthQuery;

  if (healthReports) {
    healthReports.forEach(report => {
      anomalies.push({
        id: `health-${report.id}`,
        timestamp: report.created_at!,
        project: report.project,
        type: 'health_degradation',
        severity: report.overall_health === 'critical' ? 'critical' : 'warning',
        metric: 'health_score',
        value: report.health_score,
        expected: 80, // Assuming 80 is healthy baseline
        deviation: ((80 - report.health_score) / 80) * 100,
        description: `Project health ${report.overall_health}: ${report.drift_alerts_count} drift alerts, ${report.recommended_actions_count} recommended actions`,
        resolved: false,
      });
    });
  }

  // Get latency spikes
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  let latencyQuery = supabase
    .from('model_run_log')
    .select('*')
    .gte('timestamp', oneDayAgo.toISOString())
    .not('latency_ms', 'is', null)
    .order('latency_ms', { ascending: false })
    .limit(100);

  if (projectId) {
    latencyQuery = latencyQuery.eq('project', projectId);
  }

  const { data: latencyLogs } = await latencyQuery;

  if (latencyLogs && latencyLogs.length > 0) {
    // Calculate average latency
    const avgLatency = latencyLogs.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / latencyLogs.length;
    const threshold = avgLatency * 2; // 2x average is considered a spike

    // Find spikes
    const spikes = latencyLogs.filter(log => log.latency_ms! > threshold);

    spikes.slice(0, 5).forEach(spike => {
      anomalies.push({
        id: `latency-${spike.id}`,
        timestamp: spike.timestamp!,
        project: spike.project,
        type: 'latency_spike',
        severity: spike.latency_ms! > threshold * 2 ? 'critical' : 'warning',
        metric: 'latency_ms',
        value: spike.latency_ms!,
        expected: avgLatency,
        deviation: ((spike.latency_ms! - avgLatency) / avgLatency) * 100,
        description: `Expert ${spike.expert_id} latency spike: ${spike.latency_ms}ms (avg: ${avgLatency.toFixed(0)}ms)`,
        resolved: false,
      });
    });
  }

  // Sort by severity and timestamp
  anomalies.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return anomalies.slice(0, limit);
}

/**
 * Mark an anomaly as resolved
 */
export async function resolveAnomaly(anomalyId: string): Promise<void> {
  // This would update an anomalies table if we had one
  // For now, this is a placeholder
  console.log(`Anomaly ${anomalyId} marked as resolved`);
}

/**
 * Get anomaly statistics
 */
export async function getAnomalyStats(
  projectId?: string
): Promise<{
  total: number;
  critical: number;
  warning: number;
  info: number;
  resolved: number;
  unresolved: number;
}> {
  const anomalies = await getAnomalies(projectId, 100);

  return {
    total: anomalies.length,
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning: anomalies.filter(a => a.severity === 'warning').length,
    info: anomalies.filter(a => a.severity === 'info').length,
    resolved: anomalies.filter(a => a.resolved).length,
    unresolved: anomalies.filter(a => !a.resolved).length,
  };
}
