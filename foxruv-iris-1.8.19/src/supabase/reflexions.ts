/**
 * Reflexion bank utilities for storing and retrieving reasoning patterns
 */

import { getSupabase, getProjectId, getTenantId } from './client.js';
import { ReflexionEntry } from './types.js';
import { withRetry } from './retry-wrapper.js';

/**
 * Save a reflexion (reasoning pattern) to the bank
 */
export async function saveReflexion(
  reflexionType: string,
  context: Record<string, any>,
  outcome: Record<string, any>,
  success: boolean,
  options?: {
    expertId?: string;
    embedding?: number[];
    confidence?: number;
    impactScore?: number;
  }
): Promise<ReflexionEntry> {
  return await withRetry(async () => {
    const supabase = getSupabase();
    const project = getProjectId();
    const tenantId = getTenantId();

    const { data, error } = await supabase
      .from('reflexion_bank')
      .insert({
        tenant_id: tenantId,
        project,
        expert_id: options?.expertId,
        reflexion_type: reflexionType,
        embedding: options?.embedding,
        context,
        outcome,
        success,
        confidence: options?.confidence,
        impact_score: options?.impactScore || 0.5,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to save reflexion: ${error.message}`);
    return data;
  }, { maxRetries: 3, timeoutMs: 30000 });
}

/**
 * Find similar reflexions using vector similarity search
 */
export async function findSimilarReflexions(
  _embedding: number[],
  options?: {
    reflexionType?: string;
    expertId?: string;
    successOnly?: boolean;
    limit?: number;
    minImpactScore?: number;
  }
): Promise<ReflexionEntry[]> {
  return await withRetry(async () => {
    const supabase = getSupabase();
    const project = getProjectId();

    const limit = options?.limit || 10;

    // Note: Vector search requires a custom Postgres function
    // Future: supabase.rpc('match_reflexions', { query_embedding, ... })

    // Current approach: Get all reflexions and filter (not using vector search yet)

    // Fallback: get all reflexions and filter (not using vector search)
    let fallbackQuery = supabase
      .from('reflexion_bank')
      .select('*')
      .eq('project', project)
      .order('impact_score', { ascending: false })
      .limit(limit);

    if (options?.reflexionType) {
      fallbackQuery = fallbackQuery.eq('reflexion_type', options.reflexionType);
    }

    if (options?.expertId) {
      fallbackQuery = fallbackQuery.eq('expert_id', options.expertId);
    }

    if (options?.successOnly) {
      fallbackQuery = fallbackQuery.eq('success', true);
    }

    if (options?.minImpactScore) {
      fallbackQuery = fallbackQuery.gte('impact_score', options.minImpactScore);
    }

    const { data, error } = await fallbackQuery;

    if (error) throw new Error(`Failed to find similar reflexions: ${error.message}`);
    return data || [];
  }, { maxRetries: 3, timeoutMs: 30000 });
}

/**
 * Get successful reflexions by type
 */
export async function getSuccessfulReflexions(
  reflexionType: string,
  options?: {
    expertId?: string;
    minImpactScore?: number;
    limit?: number;
  }
): Promise<ReflexionEntry[]> {
  return await withRetry(async () => {
    const supabase = getSupabase();
    const project = getProjectId();

    let query = supabase
      .from('reflexion_bank')
      .select('*')
      .eq('project', project)
      .eq('reflexion_type', reflexionType)
      .eq('success', true)
      .order('impact_score', { ascending: false })
      .limit(options?.limit || 20);

    if (options?.expertId) {
      query = query.eq('expert_id', options.expertId);
    }

    if (options?.minImpactScore) {
      query = query.gte('impact_score', options.minImpactScore);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get successful reflexions: ${error.message}`);
    return data || [];
  }, { maxRetries: 3, timeoutMs: 30000 });
}

/**
 * Mark a reflexion as reused (increments reuse_count)
 */
export async function markReflexionReused(reflexionId: string): Promise<void> {
  return await withRetry(async () => {
    const supabase = getSupabase();

    const { error } = await supabase.rpc('increment_reflexion_reuse', {
      reflexion_id: reflexionId,
    });

    // Fallback if RPC doesn't exist
    if (error) {
      const { data: current } = await supabase
        .from('reflexion_bank')
        .select('reuse_count')
        .eq('id', reflexionId)
        .single();

      if (current) {
        await supabase
          .from('reflexion_bank')
          .update({
            reuse_count: (current.reuse_count || 0) + 1,
            last_reused_at: new Date().toISOString(),
          })
          .eq('id', reflexionId);
      }
    }
  }, { maxRetries: 3, timeoutMs: 30000 });
}

/**
 * Get reflexion statistics by type
 */
export async function getReflexionStats(
  reflexionType?: string
): Promise<{
  total: number;
  successRate: number;
  avgImpactScore: number;
  totalReuses: number;
  topReflexions: ReflexionEntry[];
}> {
  return await withRetry(async () => {
    const supabase = getSupabase();
    const project = getProjectId();

    let query = supabase
      .from('reflexion_bank')
      .select('*')
      .eq('project', project);

    if (reflexionType) {
      query = query.eq('reflexion_type', reflexionType);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get reflexion stats: ${error.message}`);

    if (!data || data.length === 0) {
      return {
        total: 0,
        successRate: 0,
        avgImpactScore: 0,
        totalReuses: 0,
        topReflexions: [],
      };
    }

    const total = data.length;
    const successful = data.filter((r) => r.success).length;
    const successRate = successful / total;
    const avgImpactScore =
      data.reduce((sum, r) => sum + (r.impact_score || 0), 0) / total;
    const totalReuses = data.reduce((sum, r) => sum + (r.reuse_count || 0), 0);
    const topReflexions = data
      .sort((a, b) => (b.reuse_count || 0) - (a.reuse_count || 0))
      .slice(0, 5);

    return {
      total,
      successRate,
      avgImpactScore,
      totalReuses,
      topReflexions,
    };
  }, { maxRetries: 3, timeoutMs: 30000 });
}
