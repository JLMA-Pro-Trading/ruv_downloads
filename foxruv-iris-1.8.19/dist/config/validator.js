/**
 * Configuration Validator
 *
 * Validates system configuration including:
 * - Supabase environment variables
 * - E2B API key (optional)
 * - Database connectivity
 * - Required project IDs
 */
import { createClient } from '@supabase/supabase-js';
/**
 * Get required environment variables
 * @returns Object containing required environment variables
 * @throws Error if required variables are missing
 */
export function getRequiredEnvVars() {
    const errors = [];
    const url = process.env.FOXRUV_SUPABASE_URL;
    const serviceRoleKey = process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY;
    const projectId = process.env.FOXRUV_PROJECT_ID;
    if (!url)
        errors.push('FOXRUV_SUPABASE_URL is required');
    if (!serviceRoleKey)
        errors.push('FOXRUV_SUPABASE_SERVICE_ROLE_KEY is required');
    if (!projectId)
        errors.push('FOXRUV_PROJECT_ID is required');
    if (errors.length > 0) {
        throw new Error(`Missing required environment variables:\n${errors.join('\n')}`);
    }
    return {
        supabase: {
            url: url,
            serviceRoleKey: serviceRoleKey,
            projectId: projectId,
        },
        optional: {
            e2bApiKey: process.env.E2B_API_KEY,
        },
    };
}
/**
 * Validate Supabase URL format
 */
function validateSupabaseUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && parsed.hostname.includes('supabase');
    }
    catch {
        return false;
    }
}
/**
 * Validate Supabase service role key format
 */
function validateServiceRoleKey(key) {
    // Service role keys are typically JWT tokens or long alphanumeric strings
    return key.length > 20 && /^[A-Za-z0-9._-]+$/.test(key);
}
/**
 * Test Supabase database connectivity
 */
async function testDatabaseConnection(url, serviceRoleKey) {
    const supabase = createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    // Test connection with a simple query
    const { error } = await supabase
        .from('reflexions')
        .select('count')
        .limit(1);
    if (error) {
        throw new Error(`Database query failed: ${error.message}`);
    }
}
/**
 * Validate complete system configuration
 *
 * Checks:
 * - Supabase environment variables
 * - E2B API key (optional, warns if missing)
 * - Required project IDs
 * - Database connectivity
 *
 * @returns Validation result with errors and warnings
 */
export async function validateConfiguration() {
    const errors = [];
    const warnings = [];
    // Check Supabase URL
    const supabaseUrl = process.env.FOXRUV_SUPABASE_URL;
    if (!supabaseUrl) {
        errors.push('Missing FOXRUV_SUPABASE_URL environment variable');
    }
    else if (!validateSupabaseUrl(supabaseUrl)) {
        errors.push('Invalid FOXRUV_SUPABASE_URL format (must be https://...supabase...)');
    }
    // Check Supabase service role key
    const serviceRoleKey = process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        errors.push('Missing FOXRUV_SUPABASE_SERVICE_ROLE_KEY environment variable');
    }
    else if (!validateServiceRoleKey(serviceRoleKey)) {
        errors.push('Invalid FOXRUV_SUPABASE_SERVICE_ROLE_KEY format');
    }
    // Check project ID
    const projectId = process.env.FOXRUV_PROJECT_ID;
    if (!projectId) {
        errors.push('Missing FOXRUV_PROJECT_ID environment variable');
    }
    else if (projectId.trim().length === 0) {
        errors.push('FOXRUV_PROJECT_ID cannot be empty');
    }
    // Check E2B API key (optional)
    const e2bApiKey = process.env.E2B_API_KEY;
    if (!e2bApiKey) {
        warnings.push('E2B_API_KEY not set - sandbox execution features will be disabled');
    }
    else if (e2bApiKey.trim().length < 10) {
        warnings.push('E2B_API_KEY appears to be invalid - sandbox features may not work');
    }
    // Test Supabase connection if credentials are available
    if (supabaseUrl && serviceRoleKey && !errors.length) {
        try {
            await testDatabaseConnection(supabaseUrl, serviceRoleKey);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push(`Supabase connection failed: ${message}`);
        }
    }
    // Additional validation warnings
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.LOG_LEVEL) {
            warnings.push('LOG_LEVEL not set - defaulting to "info"');
        }
        if (!process.env.MAX_RETRIES) {
            warnings.push('MAX_RETRIES not set - using default retry behavior');
        }
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
/**
 * Validate configuration and throw if invalid
 * Useful for startup validation
 */
export async function validateConfigurationOrThrow() {
    const result = await validateConfiguration();
    if (result.warnings.length > 0) {
        console.warn('Configuration warnings:');
        result.warnings.forEach(w => console.warn(`  - ${w}`));
    }
    if (!result.valid) {
        const errorMessage = 'Configuration validation failed:\n' +
            result.errors.map(e => `  - ${e}`).join('\n');
        throw new Error(errorMessage);
    }
}
/**
 * Get configuration summary for logging
 */
export function getConfigSummary() {
    return {
        hasSupabaseUrl: !!process.env.FOXRUV_SUPABASE_URL,
        hasSupabaseKey: !!process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY,
        hasProjectId: !!process.env.FOXRUV_PROJECT_ID,
        hasE2BKey: !!process.env.E2B_API_KEY,
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
    };
}
