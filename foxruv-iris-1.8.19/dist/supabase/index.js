/**
 * @foxruv/iris Supabase Integration
 *
 * Centralized intelligence backend for all foxruv projects:
 * - Expert signatures and optimization tracking
 * - Reflexion bank with vector similarity search
 * - Telemetry and performance monitoring
 * - Multi-expert consensus lineage
 */
// Client
export { initSupabase, initSupabaseFromEnv, getSupabase, getProjectId, getTenantId, isSupabaseInitialized, } from './client.js';
// Signatures
export { storeExpertSignature, loadActiveExpertSignature, loadExpertSignatureVersion, getSignatureHistory, recordSignatureUpgrade, getSignatureVersionHistory, } from './signatures.js';
// Telemetry
export { logTelemetry, getExpertStats, getRecentLogs, detectDrift, getProjectExpertStats, getExpertPerformanceTrends, } from './telemetry.js';
// Reflexions
export { saveReflexion, findSimilarReflexions, getSuccessfulReflexions, markReflexionReused, getReflexionStats, } from './reflexions.js';
// Consensus
export { recordConsensusLineage, getConsensusHistory, getConsensusForTask, calculateConsensus, getExpertParticipationStats, } from './consensus.js';
// Patterns
export { storePattern, findPatterns, getPattern, findSimilarPatterns, markPatternUsed, updatePatternSuccessRate, getPatternStats, deletePattern, getCrossProjectPatterns, } from './patterns.js';
// IRIS Reports
export { storeIrisReport, getLatestIrisReport, getIrisReportHistory, getIrisReportSummary, getCriticalReports, compareProjectHealth, deleteOldIrisReports, getAllProjectsSummary, getOverviewMetrics, transformReportToProject, } from './iris-reports.js';
// Analytics
export { getHealthTrends, getSuccessRateTrends, getLatencyTrends, getReflexionImpactStats, getTokenConsumptionTrends, getErrorDistribution, } from './analytics.js';
// Events and Anomalies
export { getRecentEvents, getAnomalies, resolveAnomaly, getAnomalyStats, } from './events.js';
