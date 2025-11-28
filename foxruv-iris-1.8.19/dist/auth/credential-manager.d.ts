/**
 * Credential Manager
 * Priority resolution: env vars > IRIS_API_KEY > local store > prompt
 */
export interface ResolvedCredentials {
    mode: 'managed' | 'self-hosted';
    source: 'env' | 'api_key' | 'stored' | 'prompt';
    managed?: {
        apiKey: string;
        userId?: string;
        email?: string;
    };
    selfHosted?: {
        supabase: {
            url: string;
            anonKey: string;
            serviceKey?: string;
        };
        llm?: {
            anthropic?: string;
            openai?: string;
            gemini?: string;
        };
        agentdb?: {
            path?: string;
        };
    };
}
export declare class CredentialManager {
    private store;
    constructor();
    /**
     * Resolve credentials with priority order:
     * 1. Environment variables (self-hosted)
     * 2. IRIS_API_KEY (managed mode)
     * 3. Local credential store
     * 4. Return null (caller should prompt)
     */
    resolve(): Promise<ResolvedCredentials | null>;
    /**
     * Store managed mode credentials
     */
    storeManagedCredentials(apiKey: string, userId?: string, email?: string): Promise<void>;
    /**
     * Store self-hosted mode credentials
     */
    storeSelfHostedCredentials(config: {
        supabase: {
            url: string;
            anonKey: string;
            serviceKey?: string;
        };
        llm?: {
            anthropic?: string;
            openai?: string;
            gemini?: string;
        };
        agentdb?: {
            path?: string;
        };
    }): Promise<void>;
    /**
     * Check if credentials exist
     */
    hasStoredCredentials(): boolean;
    /**
     * Clear stored credentials
     */
    clearCredentials(): Promise<void>;
    /**
     * Get credential store path
     */
    getStorePath(): string;
    /**
     * Validate API key format
     */
    static validateApiKey(apiKey: string): boolean;
    /**
     * Generate API key (for backend service)
     */
    static generateApiKey(): string;
}
//# sourceMappingURL=credential-manager.d.ts.map