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

import { getSupabase, getProjectId, getTenantId, isSupabaseInitialized } from './client.js';
import { ModelRunLog, ModelRunLogInsert } from './types.js';
import { telemetryEmitter } from '../telemetry/emitter-singleton.js';

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
export async function logTelemetry(data: TelemetryData): Promise<ModelRunLog | null> {
  const project = safeProjectId();
  const tenantId = safeTenantId();

  const payload: ModelRunLogInsert = {
    tenant_id: tenantId,
    project,
    expert_id: data.expertId,
    version: data.version,
    run_id: data.runId,
    input_hash: data.inputHash,
    confidence: data.confidence,
    latency_ms: data.latencyMs,
    tokens_in: data.tokensIn,
    tokens_out: data.tokensOut,
    cost_usd: data.costUsd,
    outcome: data.outcome,
    reflexion_used: data.reflexionUsed,
    reflexion_ids: data.reflexionIds,
    consensus_participation: data.consensusParticipation,
    error_message: data.errorMessage,
    metadata: data.metadata,
    timestamp: new Date().toISOString()
  };

  // Dual-lane: persist locally and send upstream (API-first, Supabase fallback inside emitter)
  await telemetryEmitter.record(payload);
  return payload as ModelRunLog;
}

function safeProjectId(): string {
  try {
    return getProjectId();
  } catch {
    return process.env.FOXRUV_PROJECT_ID || 'local';
  }
}

function safeTenantId(): string | undefined {
  try {
    return getTenantId();
  } catch {
    return process.env.FOXRUV_TENANT_ID;
  }
}

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
export async function getExpertStats(
  expertId: string,
  options?: {
    version?: string;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<{
  totalRuns: number;
  avgConfidence: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  successRate: number;
  reflexionUsageRate: number;
}> {
  // Return empty stats if Supabase not initialized
  if (!isSupabaseInitialized()) {
    return {
      totalRuns: 0,
      avgConfidence: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
      successRate: 0,
      reflexionUsageRate: 0,
    };
  }

  const supabase = getSupabase();
  const project = getProjectId();

  let query = supabase
    .from('model_run_log')
    .select('*')
    .eq('project', project)
    .eq('expert_id', expertId);

  if (options?.version) {
    query = query.eq('version', options.version);
  }

  if (options?.startDate) {
    query = query.gte('timestamp', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('timestamp', options.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get expert stats: ${error.message}`);

  if (!data || data.length === 0) {
    return {
      totalRuns: 0,
      avgConfidence: 0,
      avgLatencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
      successRate: 0,
      reflexionUsageRate: 0,
    };
  }

  const totalRuns = data.length;
  const avgConfidence =
    data.reduce((sum: number, r: ModelRunLog) => sum + (r.confidence || 0), 0) / totalRuns;
  const avgLatencyMs =
    data.reduce((sum: number, r: ModelRunLog) => sum + (r.latency_ms || 0), 0) / totalRuns;
  const totalTokens = data.reduce(
    (sum: number, r: ModelRunLog) => sum + (r.tokens_in || 0) + (r.tokens_out || 0),
    0
  );
  const totalCost = data.reduce((sum: number, r: ModelRunLog) => sum + (parseFloat(r.cost_usd as any) || 0), 0);
  const successfulRuns = data.filter(
    (r) => r.outcome === 'success' && !r.error_message
  ).length;
  const successRate = successfulRuns / totalRuns;
  const reflexionUsageRate =
    data.filter((r) => r.reflexion_used).length / totalRuns;

  return {
    totalRuns,
    avgConfidence,
    avgLatencyMs,
    totalTokens,
    totalCost,
    successRate,
    reflexionUsageRate,
  };
}

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
export async function getRecentLogs(
  expertId?: string,
  options?: {
    limit?: number;
    outcome?: string;
  }
): Promise<ModelRunLog[]> {
  // Return empty array if Supabase not initialized
  if (!isSupabaseInitialized()) {
    return [];
  }

  const supabase = getSupabase();
  const project = getProjectId();
  const limit = options?.limit ?? 50;

  let query = supabase
    .from('model_run_log')
    .select('*')
    .eq('project', project)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (expertId) {
    query = query.eq('expert_id', expertId);
  }

  if (options?.outcome) {
    query = query.eq('outcome', options.outcome);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get recent logs: ${error.message}`);
  return data || [];
}

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
export async function detectDrift(
  expertId: string,
  version: string,
  options?: {
    recentWindow?: number; // hours
    thresholdPct?: number; // percentage drop to flag as drift
  }
): Promise<{
  driftDetected: boolean;
  baselineConfidence: number;
  recentConfidence: number;
  confidenceDrop: number;
  recommendation?: string;
}> {
  // Return no-drift result if Supabase not initialized
  if (!isSupabaseInitialized()) {
    return {
      driftDetected: false,
      baselineConfidence: 0,
      recentConfidence: 0,
      confidenceDrop: 0,
      recommendation: 'Supabase unavailable - drift detection disabled',
    };
  }

  const supabase = getSupabase();
  const project = getProjectId();

  const recentWindowHours = options?.recentWindow || 24;
  const thresholdPct = options?.thresholdPct || 10;

  const recentCutoff = new Date();
  recentCutoff.setHours(recentCutoff.getHours() - recentWindowHours);

  // Get baseline (all historical data before recent window)
  const { data: baselineData, error: baselineError } = await supabase
    .from('model_run_log')
    .select('confidence')
    .eq('project', project)
    .eq('expert_id', expertId)
    .eq('version', version)
    .lt('timestamp', recentCutoff.toISOString())
    .not('confidence', 'is', null);

  // Get recent data
  const { data: recentData, error: recentError } = await supabase
    .from('model_run_log')
    .select('confidence')
    .eq('project', project)
    .eq('expert_id', expertId)
    .eq('version', version)
    .gte('timestamp', recentCutoff.toISOString())
    .not('confidence', 'is', null);

  if (baselineError || recentError) {
    throw new Error('Failed to detect drift');
  }

  if (!baselineData || baselineData.length === 0 || !recentData || recentData.length === 0) {
    return {
      driftDetected: false,
      baselineConfidence: 0,
      recentConfidence: 0,
      confidenceDrop: 0,
      recommendation: 'Insufficient data for drift detection',
    };
  }

  const baselineConfidence =
    baselineData.reduce((sum: number, r: ModelRunLog) => sum + (r.confidence ?? 0), 0) / baselineData.length;
  const recentConfidence =
    recentData.reduce((sum: number, r: ModelRunLog) => sum + (r.confidence ?? 0), 0) / recentData.length;

  const confidenceDrop = ((baselineConfidence - recentConfidence) / baselineConfidence) * 100;

  const driftDetected = confidenceDrop > thresholdPct;

  return {
    driftDetected,
    baselineConfidence,
    recentConfidence,
    confidenceDrop,
    recommendation: driftDetected
      ? `⚠️ Drift detected! Consider rolling back to previous version or retraining.`
      : '✅ Performance stable',
  };
}

/**
 * Get all expert stats for a project
 * Aggregates stats for all experts in a project
 */
export async function getProjectExpertStats(
  projectId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<Array<{
  expertId: string;
  expertName: string;
  accuracy: number;
  calls: number;
  latency: number;
  successRate: number;
}>> {
  // Return empty array if Supabase not initialized
  if (!isSupabaseInitialized()) {
    return [];
  }

  const supabase = getSupabase();

  let query = supabase
    .from('model_run_log')
    .select('*')
    .eq('project', projectId);

  if (options?.startDate) {
    query = query.gte('timestamp', options.startDate.toISOString());
  }

  if (options?.endDate) {
    query = query.lte('timestamp', options.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get project expert stats: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Group by expert
  const expertMap = new Map<string, ModelRunLog[]>();
  data.forEach((log) => {
    if (!expertMap.has(log.expert_id)) {
      expertMap.set(log.expert_id, []);
    }
    expertMap.get(log.expert_id)!.push(log);
  });

  // Calculate stats for each expert
  const expertStats = Array.from(expertMap.entries()).map(([expertId, logs]) => {
    const totalCalls = logs.length;
    const successfulCalls = logs.filter(l => l.outcome === 'success' && !l.error_message).length;
    const avgConfidence = logs.reduce((sum: number, l: any) => sum + (l.confidence || 0), 0) / totalCalls;
    const avgLatency = logs.reduce((sum: number, l: any) => sum + (l.latency_ms || 0), 0) / totalCalls;
    const successRate = successfulCalls / totalCalls;

    return {
      expertId,
      expertName: expertId, // Can be enhanced with a lookup table
      accuracy: avgConfidence,
      calls: totalCalls,
      latency: avgLatency,
      successRate,
    };
  });

  return expertStats.sort((a, b) => b.calls - a.calls);
}

/**
 * Get expert performance trends over time
 * Returns time-series data for charts
 */
export async function getExpertPerformanceTrends(
  projectId: string,
  expertId: string,
  hours: number = 24
): Promise<Array<{
  time: string;
  accuracy: number;
  latency: number;
  calls: number;
}>> {
  // Return empty array if Supabase not initialized
  if (!isSupabaseInitialized()) {
    return [];
  }

  const supabase = getSupabase();

  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  const { data, error } = await supabase
    .from('model_run_log')
    .select('*')
    .eq('project', projectId)
    .eq('expert_id', expertId)
    .gte('timestamp', startDate.toISOString())
    .order('timestamp', { ascending: true });

  if (error) throw new Error(`Failed to get expert performance trends: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Group by hour
  const hourlyMap = new Map<string, ModelRunLog[]>();
  data.forEach((log) => {
    const timestamp = new Date(log.timestamp!);
    const hourKey = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours()).toISOString();

    if (!hourlyMap.has(hourKey)) {
      hourlyMap.set(hourKey, []);
    }
    hourlyMap.get(hourKey)!.push(log);
  });

  // Calculate stats for each hour
  const trends = Array.from(hourlyMap.entries()).map(([time, logs]) => {
    const avgConfidence = logs.reduce((sum: number, l: ModelRunLog) => sum + (l.confidence || 0), 0) / logs.length;
    const avgLatency = logs.reduce((sum: number, l: ModelRunLog) => sum + (l.latency_ms || 0), 0) / logs.length;

    return {
      time,
      accuracy: avgConfidence,
      latency: avgLatency,
      calls: logs.length,
    };
  });

  return trends.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}
