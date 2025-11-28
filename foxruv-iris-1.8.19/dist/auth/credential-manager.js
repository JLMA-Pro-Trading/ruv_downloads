/**
 * Credential Manager
 * Priority resolution: env vars > IRIS_API_KEY > local store > prompt
 */
import { CredentialStore } from './credential-store.js';
export class CredentialManager {
    store;
    constructor() {
        this.store = new CredentialStore();
    }
    /**
     * Resolve credentials with priority order:
     * 1. Environment variables (self-hosted)
     * 2. IRIS_API_KEY (managed mode)
     * 3. Local credential store
     * 4. Return null (caller should prompt)
     */
    async resolve() {
        // Priority 1: Self-hosted via environment variables
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            return {
                mode: 'self-hosted',
                source: 'env',
                selfHosted: {
                    supabase: {
                        url: process.env.SUPABASE_URL,
                        anonKey: process.env.SUPABASE_ANON_KEY,
                        serviceKey: process.env.SUPABASE_SERVICE_KEY,
                    },
                    llm: {
                        anthropic: process.env.ANTHROPIC_API_KEY,
                        openai: process.env.OPENAI_API_KEY,
                        gemini: process.env.GEMINI_API_KEY,
                    },
                    agentdb: {
                        path: process.env.AGENTDB_PATH,
                    },
                },
            };
        }
        // Priority 2: Managed mode via IRIS_API_KEY
        if (process.env.IRIS_API_KEY) {
            return {
                mode: 'managed',
                source: 'api_key',
                managed: {
                    apiKey: process.env.IRIS_API_KEY,
                },
            };
        }
        // Priority 3: Local credential store
        const stored = await this.store.load();
        if (stored) {
            await this.store.updateLastUsed();
            return {
                mode: stored.mode,
                source: 'stored',
                managed: stored.managed,
                selfHosted: stored.selfHosted,
            };
        }
        // Priority 4: No credentials found
        return null;
    }
    /**
     * Store managed mode credentials
     */
    async storeManagedCredentials(apiKey, userId, email) {
        const credentials = {
            mode: 'managed',
            managed: {
                apiKey,
                userId,
                email,
            },
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
        };
        await this.store.store(credentials);
    }
    /**
     * Store self-hosted mode credentials
     */
    async storeSelfHostedCredentials(config) {
        const credentials = {
            mode: 'self-hosted',
            selfHosted: config,
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
        };
        await this.store.store(credentials);
    }
    /**
     * Check if credentials exist
     */
    hasStoredCredentials() {
        return this.store.exists();
    }
    /**
     * Clear stored credentials
     */
    async clearCredentials() {
        await this.store.clear();
    }
    /**
     * Get credential store path
     */
    getStorePath() {
        return this.store.getStorePath();
    }
    /**
     * Validate API key format
     */
    static validateApiKey(apiKey) {
        // IRIS API keys: iris_[a-zA-Z0-9]{32}
        return /^iris_[a-zA-Z0-9]{32}$/.test(apiKey);
    }
    /**
     * Generate API key (for backend service)
     */
    static generateApiKey() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let key = 'iris_';
        for (let i = 0; i < 32; i++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return key;
    }
}
