/**
 * Supabase client for @foxruv/iris
 *
 * Central intelligence backend connecting all foxruv projects:
 * - NFL Predictor
 * - Microbiome Analytics
 * - BeClever AI
 * - And more...
 */
import { createClient } from '@supabase/supabase-js';
let supabaseInstance = null;
let currentConfig = null;
/**
 * Initialize the Supabase client
 * Call this once at app startup with your credentials
 */
export function initSupabase(config) {
    if (supabaseInstance && currentConfig?.url === config.url) {
        return supabaseInstance;
    }
    // Create custom fetch with timeout
    const fetchWithTimeout = async (input, init) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        try {
            const response = await fetch(input, {
                ...init,
                signal: controller.signal,
            });
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    };
    supabaseInstance = createClient(config.url, config.serviceRoleKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
        global: {
            fetch: fetchWithTimeout,
        },
    });
    currentConfig = config;
    return supabaseInstance;
}
/**
 * Get the initialized Supabase client
 * Throws if not initialized
 */
export function getSupabase() {
    if (!supabaseInstance) {
        throw new Error('Supabase client not initialized. Call initSupabase() first with your credentials.');
    }
    return supabaseInstance;
}
/**
 * Get current project ID
 */
export function getProjectId() {
    if (!currentConfig?.projectId) {
        throw new Error('Project ID not set. Initialize Supabase with projectId.');
    }
    return currentConfig.projectId;
}
/**
 * Get current tenant ID (optional for multi-tenancy)
 */
export function getTenantId() {
    return currentConfig?.tenantId;
}
/**
 * Initialize from environment variables
 * Expects:
 * - FOXRUV_SUPABASE_URL
 * - FOXRUV_SUPABASE_SERVICE_ROLE_KEY
 * - FOXRUV_PROJECT_ID
 * - FOXRUV_TENANT_ID (optional)
 */
export function initSupabaseFromEnv() {
    const url = process.env.FOXRUV_SUPABASE_URL;
    const serviceRoleKey = process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY;
    const projectId = process.env.FOXRUV_PROJECT_ID;
    const tenantId = process.env.FOXRUV_TENANT_ID;
    if (!url || !serviceRoleKey || !projectId) {
        throw new Error('Missing required environment variables: FOXRUV_SUPABASE_URL, FOXRUV_SUPABASE_SERVICE_ROLE_KEY, FOXRUV_PROJECT_ID');
    }
    return initSupabase({
        url,
        serviceRoleKey,
        projectId,
        tenantId,
    });
}
/**
 * Check if Supabase is initialized
 */
export function isSupabaseInitialized() {
    return supabaseInstance !== null;
}
