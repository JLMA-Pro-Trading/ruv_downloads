/**
 * Minimal Supabase table typings used across the core package.
 * These are intentionally narrow and can be replaced by generated types
 * (see roadmap) when Supabase schema generation is wired in.
 */
export interface ModelRunLog {
    tenant_id?: string;
    project: string;
    expert_id: string;
    version?: string;
    run_id?: string;
    input_hash?: string;
    confidence?: number;
    latency_ms?: number;
    tokens_in?: number;
    tokens_out?: number;
    cost_usd?: number | string;
    outcome?: string;
    reflexion_used?: boolean;
    reflexion_ids?: string[];
    consensus_participation?: boolean;
    error_message?: string;
    metadata?: Record<string, any>;
    timestamp?: string;
}
export interface TelemetryLog {
    project: string;
    event_type: string;
    payload?: Record<string, any>;
    created_at?: string;
    run_id?: string;
}
export interface DecisionDraftRecord {
    id: string;
    created_at?: string;
    updated_at?: string;
    status: 'pending' | 'approved' | 'rejected';
    source: 'advisor' | 'council' | 'manual';
    type: 'pattern_transfer' | 'rotation' | 'other';
    recommendation: string;
    rationale?: string;
    payload?: Record<string, any>;
    confidence?: number;
}
//# sourceMappingURL=supabase-types.d.ts.map