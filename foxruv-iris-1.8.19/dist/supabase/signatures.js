/**
 * Expert signature management utilities
 *
 * Manages expert prompt signatures with versioning and optimization tracking:
 * - Store and load optimized expert prompts
 * - Track signature versions and upgrades
 * - Manage active/inactive versions
 * - Performance metrics per signature
 *
 * Signatures represent the optimized prompts that define how an expert agent
 * behaves. This module enables prompt evolution tracking and A/B testing.
 *
 * @example
 * ```typescript
 * // Store a new expert signature
 * await storeExpertSignature(
 *   'TheScout',
 *   'v1.1.0',
 *   'You are an expert NFL scout...',
 *   { fields: [...] },
 *   {
 *     performanceMetrics: { accuracy: 0.88 },
 *     setActive: true
 *   }
 * );
 *
 * // Load the active signature
 * const active = await loadActiveExpertSignature('TheScout');
 *
 * // Track an upgrade
 * await recordSignatureUpgrade(
 *   'TheScout',
 *   'v1.0.0',
 *   'v1.1.0',
 *   'Improved prediction accuracy by 6%',
 *   { accuracyImprovement: 0.06 }
 * );
 * ```
 */
import { getSupabase, getProjectId, getTenantId } from './client.js';
/**
 * Store an optimized expert signature with version tracking
 *
 * Saves a new or updated expert prompt signature. Optionally deactivates
 * previous versions when setting as active. This enables clean version
 * management and A/B testing capabilities.
 *
 * @param expertId - Unique identifier for the expert
 * @param version - Semantic version (e.g., 'v1.0.0', 'v2.1.0')
 * @param prompt - The expert's system prompt text
 * @param signature - DSPy signature definition
 * @param options - Optional configuration
 * @param options.performanceMetrics - Metrics for this signature version
 * @param options.metadata - Additional metadata
 * @param options.setActive - Set as active version (default: true)
 * @returns The stored signature record
 * @throws Error if storage fails
 *
 * @example
 * ```typescript
 * const signature = await storeExpertSignature(
 *   'TheAnalyst',
 *   'v2.0.0',
 *   'You are an expert NFL analyst with 20 years of experience...',
 *   {
 *     inputs: { teamStats: 'string', matchup: 'string' },
 *     outputs: { prediction: 'string', confidence: 'number' }
 *   },
 *   {
 *     performanceMetrics: {
 *       accuracy: 0.91,
 *       avgConfidence: 0.87,
 *       avgLatency: 1250
 *     },
 *     metadata: {
 *       trainingDate: '2024-11-15',
 *       modelUsed: 'claude-3-5-sonnet'
 *     },
 *     setActive: true
 *   }
 * );
 * ```
 */
export async function storeExpertSignature(expertId, version, prompt, signature, options) {
    const supabase = getSupabase();
    const project = getProjectId();
    const tenantId = getTenantId();
    // If setting as active, deactivate other versions
    if (options?.setActive !== false) {
        await supabase
            .from('expert_signatures')
            .update({ active: false })
            .eq('project', project)
            .eq('expert_id', expertId)
            .eq('active', true);
    }
    const { data, error } = await supabase
        .from('expert_signatures')
        .insert({
        tenant_id: tenantId,
        project,
        expert_id: expertId,
        version,
        prompt,
        signature,
        performance_metrics: options?.performanceMetrics,
        metadata: options?.metadata,
        active: options?.setActive !== false,
    })
        .select()
        .single();
    if (error)
        throw new Error(`Failed to store expert signature: ${error.message}`);
    return data;
}
/**
 * Load the active expert signature for a given expert
 */
export async function loadActiveExpertSignature(expertId) {
    const supabase = getSupabase();
    const project = getProjectId();
    const { data, error } = await supabase
        .from('expert_signatures')
        .select('*')
        .eq('project', project)
        .eq('expert_id', expertId)
        .eq('active', true)
        .single();
    if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load expert signature: ${error.message}`);
    }
    return data;
}
/**
 * Load a specific version of an expert signature
 */
export async function loadExpertSignatureVersion(expertId, version) {
    const supabase = getSupabase();
    const project = getProjectId();
    const { data, error } = await supabase
        .from('expert_signatures')
        .select('*')
        .eq('project', project)
        .eq('expert_id', expertId)
        .eq('version', version)
        .single();
    if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to load expert signature version: ${error.message}`);
    }
    return data;
}
/**
 * Get all versions of an expert signature
 */
export async function getSignatureHistory(expertId) {
    const supabase = getSupabase();
    const project = getProjectId();
    const { data, error } = await supabase
        .from('expert_signatures')
        .select('*')
        .eq('project', project)
        .eq('expert_id', expertId)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(`Failed to load signature history: ${error.message}`);
    return data || [];
}
/**
 * Track a signature version upgrade
 */
export async function recordSignatureUpgrade(expertId, fromVersion, toVersion, changelog, improvementMetrics) {
    const supabase = getSupabase();
    const project = getProjectId();
    const tenantId = getTenantId();
    const { data, error } = await supabase
        .from('signature_versions')
        .insert({
        tenant_id: tenantId,
        project,
        expert_id: expertId,
        from_version: fromVersion,
        to_version: toVersion,
        changelog,
        improvement_metrics: improvementMetrics,
    })
        .select()
        .single();
    if (error)
        throw new Error(`Failed to record signature upgrade: ${error.message}`);
    return data;
}
/**
 * Get signature version history for an expert
 */
export async function getSignatureVersionHistory(expertId) {
    const supabase = getSupabase();
    const project = getProjectId();
    const { data, error } = await supabase
        .from('signature_versions')
        .select('*')
        .eq('project', project)
        .eq('expert_id', expertId)
        .order('created_at', { ascending: false });
    if (error)
        throw new Error(`Failed to load version history: ${error.message}`);
    return data || [];
}
