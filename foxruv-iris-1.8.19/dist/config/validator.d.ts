/**
 * Configuration Validator
 *
 * Validates system configuration including:
 * - Supabase environment variables
 * - E2B API key (optional)
 * - Database connectivity
 * - Required project IDs
 */
export interface ConfigValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export interface RequiredEnvVars {
    supabase: {
        url: string;
        serviceRoleKey: string;
        projectId: string;
    };
    optional: {
        e2bApiKey?: string;
    };
}
/**
 * Get required environment variables
 * @returns Object containing required environment variables
 * @throws Error if required variables are missing
 */
export declare function getRequiredEnvVars(): RequiredEnvVars;
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
export declare function validateConfiguration(): Promise<ConfigValidationResult>;
/**
 * Validate configuration and throw if invalid
 * Useful for startup validation
 */
export declare function validateConfigurationOrThrow(): Promise<void>;
/**
 * Get configuration summary for logging
 */
export declare function getConfigSummary(): Record<string, string | boolean>;
//# sourceMappingURL=validator.d.ts.map