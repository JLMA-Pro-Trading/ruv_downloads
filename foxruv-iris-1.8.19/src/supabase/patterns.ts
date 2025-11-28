/**
 * Pattern storage and discovery utilities
 * Enables cross-project pattern sharing and reuse
 */

import { getSupabase, getProjectId, getTenantId } from './client.js';

export type StoredPattern = Record<string, any>;

export interface PatternMatch {
  pattern: StoredPattern;
  similarity: number;
  relevanceScore: number;
}

/**
 * Store a learned pattern for cross-project reuse
 */
export async function storePattern(
  patternName: string,
  patternType: string,
  patternData: Record<string, any>,
  options?: {
    expertId?: string;
    successRate?: number;
    domain?: string;
    tags?: string[];
    embedding?: number[];
    metadata?: Record<string, any>;
  }
): Promise<StoredPattern> {
  const supabase = getSupabase();
  const project = getProjectId();
  const tenantId = getTenantId();

  const payload: any = {
    tenant_id: tenantId,
    project,
    expert_id: options?.expertId,
    pattern_name: patternName,
    pattern_type: patternType,
    pattern_data: patternData,
    success_rate: options?.successRate ?? 0.5,
    usage_count: 0,
    domain: options?.domain,
    tags: options?.tags || [],
    embedding: options?.embedding,
    metadata: options?.metadata,
  };

  const { data, error } = await supabase
    .from('learned_patterns')
    .insert(payload)
    .select()
    .single();

  if (error) throw new Error(`Failed to store pattern: ${error.message}`);
  return data;
}

/**
 * Find patterns by type and domain
 */
export async function findPatterns(options?: {
  patternType?: string;
  domain?: string;
  expertId?: string;
  tags?: string[];
  minSuccessRate?: number;
  limit?: number;
}): Promise<StoredPattern[]> {
  const supabase = getSupabase();
  const project = getProjectId();

  let query = supabase
    .from('learned_patterns')
    .select('*')
    .eq('project', project);

  if (options?.patternType) {
    query = query.eq('pattern_type', options.patternType);
  }

  if (options?.domain) {
    query = query.eq('domain', options.domain);
  }

  if (options?.expertId) {
    query = query.eq('expert_id', options.expertId);
  }

  if (options?.minSuccessRate !== undefined) {
    query = query.gte('success_rate', options.minSuccessRate);
  }

  if (options?.tags && options.tags.length > 0) {
    query = query.contains('tags', options.tags);
  }

  query = query
    .order('success_rate', { ascending: false })
    .limit(options?.limit || 20);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to find patterns: ${error.message}`);
  return data || [];
}

/**
 * Get a specific pattern by ID
 */
export async function getPattern(patternId: string): Promise<StoredPattern | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('learned_patterns')
    .select('*')
    .eq('id', patternId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get pattern: ${error.message}`);
  }

  return data;
}

/**
 * Find similar patterns using vector search
 * Falls back to metadata-based search if embeddings not available
 */
export async function findSimilarPatterns(
  _queryEmbedding: number[],
  options?: {
    patternType?: string;
    minSimilarity?: number;
    limit?: number;
    excludeProjects?: string[];
  }
): Promise<PatternMatch[]> {
  const supabase = getSupabase();
  const project = getProjectId();

  const limit = options?.limit || 10;

  // Future: Use vector similarity with RPC function
  // const { data, error } = await supabase.rpc('match_patterns', {
  //   query_embedding: queryEmbedding,
  //   match_threshold: options?.minSimilarity || 0.7,
  //   match_count: limit
  // })

  // Fallback: Get patterns by type and rank by success rate
  let query = supabase
    .from('learned_patterns')
    .select('*')
    .neq('project', project)
    .order('success_rate', { ascending: false })
    .limit(limit);

  if (options?.patternType) {
    query = query.eq('pattern_type', options.patternType);
  }

  if (options?.excludeProjects) {
    query = query.not('project', 'in', `(${options.excludeProjects.join(',')})`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to find similar patterns: ${error.message}`);

  // Calculate simple relevance score based on success rate and usage
  const matches: PatternMatch[] = (data || []).map(pattern => ({
    pattern,
    similarity: 0.8, // Placeholder - would use actual vector similarity
    relevanceScore: (pattern.success_rate || 0) * (Math.log10((pattern.usage_count || 0) + 1) / 3 + 0.7)
  }));

  return matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Mark a pattern as used (increments usage_count)
 */
export async function markPatternUsed(patternId: string): Promise<void> {
  const supabase = getSupabase();

  // Try to use RPC function first
  const { error: rpcError } = await supabase.rpc('increment_pattern_usage', {
    pattern_id: patternId,
  });

  // Fallback if RPC doesn't exist
  if (rpcError) {
  const { data: current } = await supabase
    .from('learned_patterns')
    .select('usage_count')
      .eq('id', patternId)
      .single();

    if (current) {
      await supabase
        .from('learned_patterns')
        .update({
          usage_count: (current.usage_count || 0) + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq('id', patternId);
    }
  }
}

/**
 * Update pattern success rate based on new outcomes
 */
export async function updatePatternSuccessRate(
  patternId: string,
  newSuccessRate: number
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('learned_patterns')
    .update({
      success_rate: newSuccessRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', patternId);

  if (error) throw new Error(`Failed to update pattern success rate: ${error.message}`);
}

/**
 * Get pattern usage statistics
 */
export async function getPatternStats(options?: {
  patternType?: string;
  domain?: string;
}): Promise<{
  totalPatterns: number;
  avgSuccessRate: number;
  totalUsage: number;
  topPatterns: StoredPattern[];
  patternsByDomain: Record<string, number>;
}> {
  const supabase = getSupabase();
  const project = getProjectId();

  let query = supabase
    .from('learned_patterns')
    .select('*')
    .eq('project', project);

  if (options?.patternType) {
    query = query.eq('pattern_type', options.patternType);
  }

  if (options?.domain) {
    query = query.eq('domain', options.domain);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get pattern stats: ${error.message}`);

  if (!data || data.length === 0) {
    return {
      totalPatterns: 0,
      avgSuccessRate: 0,
      totalUsage: 0,
      topPatterns: [],
      patternsByDomain: {},
    };
  }

  const totalPatterns = data.length;
  const avgSuccessRate = data.reduce((sum, p) => sum + (p.success_rate || 0), 0) / totalPatterns;
  const totalUsage = data.reduce((sum, p) => sum + (p.usage_count || 0), 0);
  const topPatterns = [...data]
    .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
    .slice(0, 5);

  const patternsByDomain: Record<string, number> = {};
  data.forEach(p => {
    if (p.domain) {
      patternsByDomain[p.domain] = (patternsByDomain[p.domain] || 0) + 1;
    }
  });

  return {
    totalPatterns,
    avgSuccessRate,
    totalUsage,
    topPatterns,
    patternsByDomain,
  };
}

/**
 * Delete a pattern
 */
export async function deletePattern(patternId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('learned_patterns')
    .delete()
    .eq('id', patternId);

  if (error) throw new Error(`Failed to delete pattern: ${error.message}`);
}

/**
 * Get cross-project patterns (excluding current project)
 */
export async function getCrossProjectPatterns(options?: {
  patternType?: string;
  minSuccessRate?: number;
  limit?: number;
}): Promise<StoredPattern[]> {
  const supabase = getSupabase();
  const project = getProjectId();

  let query = supabase
    .from('learned_patterns')
    .select('*')
    .neq('project', project);

  if (options?.patternType) {
    query = query.eq('pattern_type', options.patternType);
  }

  if (options?.minSuccessRate !== undefined) {
    query = query.gte('success_rate', options.minSuccessRate);
  }

  query = query
    .order('success_rate', { ascending: false })
    .limit(options?.limit || 20);

  const { data, error } = await query;

  if (error) throw new Error(`Failed to get cross-project patterns: ${error.message}`);
  return data || [];
}
