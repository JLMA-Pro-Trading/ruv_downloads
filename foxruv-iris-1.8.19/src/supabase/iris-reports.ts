/**
 * IRIS report storage and retrieval utilities
 * Tracks AI Operations health assessments and recommendations
 */

import { getSupabase, getProjectId, getTenantId } from './client.js';

export interface StoredIrisReport {
  id: string;
  tenant_id?: string;
  project: string;
  report_type: 'project_evaluation' | 'cross_project' | 'auto_retrain' | 'rotation' | 'pattern_transfer';
  health_score: number;
  overall_health: 'healthy' | 'degraded' | 'critical';
  drift_alerts_count: number;
  recommended_actions_count: number;
  report_data: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface IrisReportSummary {
  totalReports: number;
  avgHealthScore: number;
  healthTrend: 'improving' | 'stable' | 'degrading';
  criticalReports: number;
  recentReports: StoredIrisReport[];
}

/**
 * Store an IRIS evaluation report
 */
export async function storeIrisReport(
  reportType: StoredIrisReport['report_type'],
  healthScore: number,
  overallHealth: StoredIrisReport['overall_health'],
  reportData: Record<string, any>,
  options?: {
    projectId?: string;
    driftAlertsCount?: number;
    recommendedActionsCount?: number;
    metadata?: Record<string, any>;
  }
): Promise<StoredIrisReport> {
  const supabase = getSupabase();
  const project = options?.projectId || getProjectId();
  const tenantId = getTenantId();

  const { data, error } = await supabase
    .from('iris_reports')
    .insert({
      tenant_id: tenantId,
      project,
      report_type: reportType,
      health_score: healthScore,
      overall_health: overallHealth,
      drift_alerts_count: options?.driftAlertsCount || 0,
      recommended_actions_count: options?.recommendedActionsCount || 0,
      report_data: reportData,
      metadata: options?.metadata,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to store IRIS report: ${error.message}`);
  return data;
}

/**
 * Get the most recent IRIS report for a project
 */
export async function getLatestIrisReport(
  projectId?: string,
  reportType?: StoredIrisReport['report_type']
): Promise<StoredIrisReport | null> {
  const supabase = getSupabase();
  const project = projectId || getProjectId();

  let query = supabase
    .from('iris_reports')
    .select('*')
    .eq('project', project);

  if (reportType) {
    query = query.eq('report_type', reportType);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(1);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get latest IRIS report: ${error.message}`);
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Get IRIS report history for a project
 */
export async function getIrisReportHistory(
  options?: {
    projectId?: string;
    reportType?: StoredIrisReport['report_type'];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<StoredIrisReport[]> {
  const supabase = getSupabase();
  const project = options?.projectId || getProjectId();

  let query = supabase
    .from('iris_reports')
    .select('*')
    .eq('project', project);

  if (options?.reportType) {
    query = query.eq('report_type', options.reportType);
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get IRIS report history: ${error.message}`);
  return data || [];
}

/**
 * Get IRIS report summary and trends
 */
export async function getIrisReportSummary(
  projectId?: string,
  lookbackDays: number = 30
): Promise<IrisReportSummary> {
  const supabase = getSupabase();
  const project = projectId || getProjectId();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - lookbackDays);

  const { data, error } = await supabase
    .from('iris_reports')
    .select('*')
    .eq('project', project)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get IRIS report summary: ${error.message}`);

  if (!data || data.length === 0) {
    return {
      totalReports: 0,
      avgHealthScore: 0,
      healthTrend: 'stable',
      criticalReports: 0,
      recentReports: [],
    };
  }

  const totalReports = data.length;
  const avgHealthScore = data.reduce((sum, r) => sum + r.health_score, 0) / totalReports;
  const criticalReports = data.filter(r => r.overall_health === 'critical').length;

  // Calculate trend - compare first half vs second half of period
  const midpoint = Math.floor(data.length / 2);
  const recentHalf = data.slice(0, midpoint);
  const olderHalf = data.slice(midpoint);

  const recentAvg = recentHalf.reduce((sum, r) => sum + r.health_score, 0) / (recentHalf.length || 1);
  const olderAvg = olderHalf.reduce((sum, r) => sum + r.health_score, 0) / (olderHalf.length || 1);

  let healthTrend: 'improving' | 'stable' | 'degrading' = 'stable';
  const trendDiff = recentAvg - olderAvg;
  if (trendDiff > 5) healthTrend = 'improving';
  else if (trendDiff < -5) healthTrend = 'degrading';

  return {
    totalReports,
    avgHealthScore,
    healthTrend,
    criticalReports,
    recentReports: data.slice(0, 10),
  };
}

/**
 * Get all critical health reports across projects
 */
export async function getCriticalReports(
  options?: {
    startDate?: Date;
    limit?: number;
  }
): Promise<StoredIrisReport[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('iris_reports')
    .select('*')
    .eq('overall_health', 'critical');

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(options?.limit || 20);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get critical reports: ${error.message}`);
  return data || [];
}

/**
 * Compare health across projects
 */
export async function compareProjectHealth(
  projectIds?: string[]
): Promise<Array<{
  project: string;
  latestHealthScore: number;
  overallHealth: StoredIrisReport['overall_health'];
  trend: 'improving' | 'stable' | 'degrading';
  lastReportDate: string;
}>> {
  const supabase = getSupabase();

  let query = supabase
    .from('iris_reports')
    .select('*');

  if (projectIds && projectIds.length > 0) {
    query = query.in('project', projectIds);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to compare project health: ${error.message}`);

  if (!data || data.length === 0) return [];

  // Group by project
  const projectMap = new Map<string, StoredIrisReport[]>();
  data.forEach(report => {
    if (!projectMap.has(report.project)) {
      projectMap.set(report.project, []);
    }
    projectMap.get(report.project)!.push(report);
  });

  // Calculate health for each project
  const comparison = Array.from(projectMap.entries()).map(([project, reports]) => {
    const latest = reports[0];

    // Calculate trend from last 5 reports
    const recent = reports.slice(0, 5);
    if (recent.length < 2) {
      return {
        project,
        latestHealthScore: latest.health_score,
        overallHealth: latest.overall_health,
        trend: 'stable' as const,
        lastReportDate: latest.created_at!,
      };
    }

    const recentAvg = recent.slice(0, 2).reduce((sum, r) => sum + r.health_score, 0) / 2;
    const olderAvg = recent.slice(2).reduce((sum, r) => sum + r.health_score, 0) / (recent.length - 2);

    const diff = recentAvg - olderAvg;
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (diff > 3) trend = 'improving';
    else if (diff < -3) trend = 'degrading';

    return {
      project,
      latestHealthScore: latest.health_score,
      overallHealth: latest.overall_health,
      trend,
      lastReportDate: latest.created_at!,
    };
  });

  return comparison.sort((a, b) => b.latestHealthScore - a.latestHealthScore);
}

/**
 * Delete old IRIS reports (cleanup)
 */
export async function deleteOldIrisReports(
  daysToKeep: number = 90,
  projectId?: string
): Promise<number> {
  const supabase = getSupabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  let query = supabase
    .from('iris_reports')
    .delete()
    .lt('created_at', cutoffDate.toISOString());

  if (projectId) {
    query = query.eq('project', projectId);
  }

  const { error, count } = await query;

  if (error) throw new Error(`Failed to delete old IRIS reports: ${error.message}`);
  return count || 0;
}

/**
 * Get all projects with their latest health status
 * Returns array of projects with health scores, status, etc.
 */
export async function getAllProjectsSummary(): Promise<Array<{
  project: string;
  latestHealthScore: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  lastReportDate: string;
  totalRuns: number;
  avgSuccessRate: number;
  activeExperts: number;
  totalReflexions: number;
}>> {
  const supabase = getSupabase();

  // Get all unique projects
  const { data: reports, error } = await supabase
    .from('iris_reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get projects summary: ${error.message}`);
  if (!reports || reports.length === 0) return [];

  // Group by project and get latest report for each
  const projectMap = new Map<string, StoredIrisReport[]>();
  reports.forEach(report => {
    if (!projectMap.has(report.project)) {
      projectMap.set(report.project, []);
    }
    projectMap.get(report.project)!.push(report);
  });

  // Get telemetry stats for each project
  const projectSummaries = await Promise.all(
    Array.from(projectMap.entries()).map(async ([project, projectReports]) => {
      const latest = projectReports[0];

      // Get telemetry stats
      const { data: runLogs } = await supabase
        .from('model_run_log')
        .select('*')
        .eq('project', project);

      const totalRuns = runLogs?.length || 0;
      const successfulRuns = runLogs?.filter(r => r.outcome === 'success').length || 0;
      const avgSuccessRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;

      // Count active experts
      const activeExperts = new Set(runLogs?.map(r => r.expert_id) || []).size;

      // Count reflexions
      const { data: reflexions } = await supabase
        .from('reflexion_bank')
        .select('id')
        .eq('project', project);

      const totalReflexions = reflexions?.length || 0;

      return {
        project,
        latestHealthScore: latest.health_score,
        overallHealth: latest.overall_health,
        lastReportDate: latest.created_at || new Date().toISOString(),
        totalRuns,
        avgSuccessRate,
        activeExperts,
        totalReflexions,
      };
    })
  );

  return projectSummaries.sort((a, b) => b.latestHealthScore - a.latestHealthScore);
}

/**
 * Get overview metrics aggregated across all projects
 * Used for dashboard top-level metrics
 */
export async function getOverviewMetrics(): Promise<{
  total_projects: number;
  healthy_projects: number;
  warning_projects: number;
  critical_projects: number;
  total_runs_today: number;
  avg_success_rate: number;
  active_experts: number;
  total_reflexions: number;
}> {
  const supabase = getSupabase();

  // Get all projects summary
  const projectsSummary = await getAllProjectsSummary();

  const total_projects = projectsSummary.length;
  const healthy_projects = projectsSummary.filter(p => p.overallHealth === 'healthy').length;
  const warning_projects = projectsSummary.filter(p => p.overallHealth === 'degraded').length;
  const critical_projects = projectsSummary.filter(p => p.overallHealth === 'critical').length;

  // Get today's runs
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayRuns } = await supabase
    .from('model_run_log')
    .select('*')
    .gte('timestamp', today.toISOString());

  const total_runs_today = todayRuns?.length || 0;

  // Calculate average success rate across all projects
  const totalRuns = projectsSummary.reduce((sum, p) => sum + p.totalRuns, 0);
  const totalSuccess = projectsSummary.reduce((sum, p) => sum + (p.totalRuns * p.avgSuccessRate), 0);
  const avg_success_rate = totalRuns > 0 ? totalSuccess / totalRuns : 0;

  // Count unique experts across all projects
  const { data: allExperts } = await supabase
    .from('model_run_log')
    .select('expert_id');

  const active_experts = new Set(allExperts?.map(e => e.expert_id) || []).size;

  // Count all reflexions
  const { data: allReflexions } = await supabase
    .from('reflexion_bank')
    .select('id');

  const total_reflexions = allReflexions?.length || 0;

  return {
    total_projects,
    healthy_projects,
    warning_projects,
    critical_projects,
    total_runs_today,
    avg_success_rate,
    active_experts,
    total_reflexions,
  };
}

/**
 * Transform StoredIrisReport to frontend Project type
 * Helper function for converting backend data to frontend format
 */
export function transformReportToProject(report: StoredIrisReport): {
  id: string;
  name: string;
  health: 'healthy' | 'degraded' | 'critical';
  healthScore: number;
  status: string;
  lastEvaluated: string;
} {
  return {
    id: report.id,
    name: report.project,
    health: report.overall_health,
    healthScore: report.health_score,
    status: report.overall_health === 'healthy' ? 'Active' :
            report.overall_health === 'degraded' ? 'Warning' : 'Critical',
    lastEvaluated: report.created_at || new Date().toISOString(),
  };
}
