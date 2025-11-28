/**
 * Supabase client for @foxruv/iris
 *
 * Central intelligence backend connecting all foxruv projects:
 * - NFL Predictor
 * - Microbiome Analytics
 * - BeClever AI
 * - And more...
 */
import { type SupabaseClient as SupabaseClientBase } from '@supabase/supabase-js';
type SupabaseClient = SupabaseClientBase<any, any, any>;
export interface SupabaseConfig {
    url: string;
    serviceRoleKey: string;
    projectId: string;
    tenantId?: string;
}
/**
 * Initialize the Supabase client
 * Call this once at app startup with your credentials
 */
export declare function initSupabase(config: SupabaseConfig): SupabaseClient;
/**
 * Get the initialized Supabase client
 * Throws if not initialized
 */
export declare function getSupabase(): SupabaseClient;
/**
 * Get current project ID
 */
export declare function getProjectId(): string;
/**
 * Get current tenant ID (optional for multi-tenancy)
 */
export declare function getTenantId(): string | undefined;
/**
 * Initialize from environment variables
 * Expects:
 * - FOXRUV_SUPABASE_URL
 * - FOXRUV_SUPABASE_SERVICE_ROLE_KEY
 * - FOXRUV_PROJECT_ID
 * - FOXRUV_TENANT_ID (optional)
 */
export declare function initSupabaseFromEnv(): SupabaseClient;
/**
 * Check if Supabase is initialized
 */
export declare function isSupabaseInitialized(): boolean;
export type { SupabaseClient };
//# sourceMappingURL=client.d.ts.map