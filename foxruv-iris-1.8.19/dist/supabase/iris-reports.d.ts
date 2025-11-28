/**
 * IRIS report storage and retrieval utilities
 * Tracks AI Operations health assessments and recommendations
 */
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
export declare function storeIrisReport(reportType: StoredIrisReport['report_type'], healthScore: number, overallHealth: StoredIrisReport['overall_health'], reportData: Record<string, any>, options?: {
    projectId?: string;
    driftAlertsCount?: number;
    recommendedActionsCount?: number;
    metadata?: Record<string, any>;
}): Promise<StoredIrisReport>;
/**
 * Get the most recent IRIS report for a project
 */
export declare function getLatestIrisReport(projectId?: string, reportType?: StoredIrisReport['report_type']): Promise<StoredIrisReport | null>;
/**
 * Get IRIS report history for a project
 */
export declare function getIrisReportHistory(options?: {
    projectId?: string;
    reportType?: StoredIrisReport['report_type'];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}): Promise<StoredIrisReport[]>;
/**
 * Get IRIS report summary and trends
 */
export declare function getIrisReportSummary(projectId?: string, lookbackDays?: number): Promise<IrisReportSummary>;
/**
 * Get all critical health reports across projects
 */
export declare function getCriticalReports(options?: {
    startDate?: Date;
    limit?: number;
}): Promise<StoredIrisReport[]>;
/**
 * Compare health across projects
 */
export declare function compareProjectHealth(projectIds?: string[]): Promise<Array<{
    project: string;
    latestHealthScore: number;
    overallHealth: StoredIrisReport['overall_health'];
    trend: 'improving' | 'stable' | 'degrading';
    lastReportDate: string;
}>>;
/**
 * Delete old IRIS reports (cleanup)
 */
export declare function deleteOldIrisReports(daysToKeep?: number, projectId?: string): Promise<number>;
/**
 * Get all projects with their latest health status
 * Returns array of projects with health scores, status, etc.
 */
export declare function getAllProjectsSummary(): Promise<Array<{
    project: string;
    latestHealthScore: number;
    overallHealth: 'healthy' | 'degraded' | 'critical';
    lastReportDate: string;
    totalRuns: number;
    avgSuccessRate: number;
    activeExperts: number;
    totalReflexions: number;
}>>;
/**
 * Get overview metrics aggregated across all projects
 * Used for dashboard top-level metrics
 */
export declare function getOverviewMetrics(): Promise<{
    total_projects: number;
    healthy_projects: number;
    warning_projects: number;
    critical_projects: number;
    total_runs_today: number;
    avg_success_rate: number;
    active_experts: number;
    total_reflexions: number;
}>;
/**
 * Transform StoredIrisReport to frontend Project type
 * Helper function for converting backend data to frontend format
 */
export declare function transformReportToProject(report: StoredIrisReport): {
    id: string;
    name: string;
    health: 'healthy' | 'degraded' | 'critical';
    healthScore: number;
    status: string;
    lastEvaluated: string;
};
//# sourceMappingURL=iris-reports.d.ts.map