/**
 * Telemetry and performance tracking utilities
 *
 * Provides comprehensive telemetry logging and drift detection for AI agents:
 * - Log every prediction with latency, tokens, cost metrics
 * - Track confidence scores and outcomes over time
 * - Detect performance drift using rolling time windows
 * - Generate expert performance statistics
 *
 * @example
 * ```typescript
 * // Log a prediction
 * await logTelemetry({
 *   expertId: 'TheScout',
 *   version: 'v1.0.0',
 *   confidence: 0.85,
 *   latencyMs: 1200,
 *   tokensIn: 500,
 *   tokensOut: 150,
 *   outcome: 'success'
 * });
 *
 * // Detect drift
 * const drift = await detectDrift('TheScout', 'v1.0.0', {
 *   recentWindow: 24,  // hours
 *   thresholdPct: 10   // 10% drop triggers alert
 * });
 *
 * if (drift.driftDetected) {
 *   console.log(`⚠️ Drift detected: ${drift.recommendation}`);
 * }
 * ```
 */
import { ModelRunLog } from './types.js';
export interface TelemetryData {
    expertId: string;
    version?: string;
    runId?: string;
    inputHash?: string;
    confidence?: number;
    latencyMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    outcome?: string;
    reflexionUsed?: boolean;
    reflexionIds?: string[];
    consensusParticipation?: boolean;
    errorMessage?: string;
    metadata?: Record<string, any>;
}
/**
 * Log telemetry for an expert prediction run
 *
 * Records comprehensive metrics about each AI prediction including:
 * - Performance (latency, confidence)
 * - Resource usage (tokens, cost)
 * - Outcome and error tracking
 * - Reflexion and consensus participation
 *
 * @param data - Telemetry data for the prediction run
 * @returns The created telemetry log entry or null if Supabase unavailable
 * @throws Error if logging fails
 *
 * @example
 * ```typescript
 * const log = await logTelemetry({
 *   expertId: 'TheAnalyst',
 *   version: 'v2.1.0',
 *   runId: 'run-123',
 *   confidence: 0.92,
 *   latencyMs: 850,
 *   tokensIn: 450,
 *   tokensOut: 200,
 *   costUsd: 0.0032,
 *   outcome: 'success',
 *   reflexionUsed: true,
 *   reflexionIds: ['refl-456']
 * });
 * ```
 */
export declare function logTelemetry(data: TelemetryData): Promise<ModelRunLog | null>;
/**
 * Get comprehensive telemetry statistics for an expert
 *
 * Aggregates all prediction runs to provide:
 * - Total runs and success rate
 * - Average confidence and latency
 * - Token consumption and cost
 * - Reflexion usage patterns
 *
 * @param expertId - ID of the expert to analyze
 * @param options - Optional filters (version, date range)
 * @returns Aggregated statistics
 * @throws Error if query fails
 *
 * @example
 * ```typescript
 * const stats = await getExpertStats('TheScout', {
 *   version: 'v1.0.0',
 *   startDate: new Date('2024-10-01'),
 *   endDate: new Date('2024-11-01')
 * });
 *
 * console.log(`Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
 * console.log(`Avg Confidence: ${stats.avgConfidence.toFixed(2)}`);
 * console.log(`Total Cost: $${stats.totalCost.toFixed(4)}`);
 * ```
 */
export declare function getExpertStats(expertId: string, options?: {
    version?: string;
    startDate?: Date;
    endDate?: Date;
}): Promise<{
    totalRuns: number;
    avgConfidence: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCost: number;
    successRate: number;
    reflexionUsageRate: number;
}>;
/**
 * Get recent telemetry logs for debugging and analysis
 *
 * Retrieves the most recent prediction logs, optionally filtered by expert.
 * Useful for debugging issues, analyzing recent performance, and investigating failures.
 *
 * @param expertId - Optional expert ID to filter by
 * @param limit - Maximum number of logs to return (default: 50)
 * @returns Array of recent telemetry logs, newest first
 * @throws Error if query fails
 *
 * @example
 * ```typescript
 * // Get all recent logs
 * const allLogs = await getRecentLogs(undefined, 100);
 *
 * // Get recent logs for specific expert
 * const expertLogs = await getRecentLogs('TheOddsmaker', 25);
 *
 * // Find recent errors
 * const errors = expertLogs.filter(log => log.error_message);
 * ```
 */
export declare function getRecentLogs(expertId?: string, options?: {
    limit?: number;
    outcome?: string;
}): Promise<ModelRunLog[]>;
/**
 * Detect performance drift by comparing recent performance to historical baseline
 *
 * Uses a rolling time window approach to detect degradation:
 * - Compares recent predictions (default: 24h) to historical baseline
 * - Flags drift when confidence drops beyond threshold (default: 10%)
 * - Provides actionable recommendations
 *
 * This is critical for maintaining AI agent quality over time as data distributions
 * and patterns change.
 *
 * @param expertId - ID of the expert to monitor
 * @param version - Version of the expert to monitor
 * @param options - Configuration for drift detection
 * @param options.recentWindow - Hours to consider as "recent" (default: 24)
 * @param options.thresholdPct - Percentage drop to trigger drift alert (default: 10)
 * @returns Drift detection results with recommendations
 * @throws Error if drift detection fails
 *
 * @example
 * ```typescript
 * // Standard drift detection
 * const drift = await detectDrift('TheAnalyst', 'v2.1.0');
 *
 * // Custom window and threshold
 * const customDrift = await detectDrift('TheScout', 'v1.0.0', {
 *   recentWindow: 48,    // 2 days
 *   thresholdPct: 15     // 15% drop threshold
 * });
 *
 * if (customDrift.driftDetected) {
 *   console.log(`⚠️ Critical drift detected!`);
 *   console.log(`Baseline: ${customDrift.baselineConfidence.toFixed(2)}`);
 *   console.log(`Recent: ${customDrift.recentConfidence.toFixed(2)}`);
 *   console.log(`Drop: ${customDrift.confidenceDrop.toFixed(1)}%`);
 *   console.log(customDrift.recommendation);
 * }
 * ```
 */
export declare function detectDrift(expertId: string, version: string, options?: {
    recentWindow?: number;
    thresholdPct?: number;
}): Promise<{
    driftDetected: boolean;
    baselineConfidence: number;
    recentConfidence: number;
    confidenceDrop: number;
    recommendation?: string;
}>;
/**
 * Get all expert stats for a project
 * Aggregates stats for all experts in a project
 */
export declare function getProjectExpertStats(projectId: string, options?: {
    startDate?: Date;
    endDate?: Date;
}): Promise<Array<{
    expertId: string;
    expertName: string;
    accuracy: number;
    calls: number;
    latency: number;
    successRate: number;
}>>;
/**
 * Get expert performance trends over time
 * Returns time-series data for charts
 */
export declare function getExpertPerformanceTrends(projectId: string, expertId: string, hours?: number): Promise<Array<{
    time: string;
    accuracy: number;
    latency: number;
    calls: number;
}>>;
//# sourceMappingURL=telemetry.d.ts.map