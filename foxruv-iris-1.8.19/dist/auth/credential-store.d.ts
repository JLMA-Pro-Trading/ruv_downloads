/**
 * Encrypted Credential Store
 * Stores user credentials securely in ~/.iris/credentials
 */
export interface StoredCredentials {
    mode: 'managed' | 'self-hosted';
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
    createdAt: string;
    lastUsed: string;
}
export declare class CredentialStore {
    private readonly credPath;
    private readonly keyPath;
    private readonly algorithm;
    constructor();
    /**
     * Initialize encryption key (derived from machine-specific data)
     */
    private getEncryptionKey;
    /**
     * Encrypt credentials
     */
    private encrypt;
    /**
     * Decrypt credentials
     */
    private decrypt;
    /**
     * Store credentials securely
     */
    store(credentials: StoredCredentials): Promise<void>;
    /**
     * Load stored credentials
     */
    load(): Promise<StoredCredentials | null>;
    /**
     * Check if credentials exist
     */
    exists(): boolean;
    /**
     * Update last used timestamp
     */
    updateLastUsed(): Promise<void>;
    /**
     * Clear stored credentials
     */
    clear(): Promise<void>;
    /**
     * Get credential store path (for debugging)
     */
    getStorePath(): string;
}
//# sourceMappingURL=credential-store.d.ts.map