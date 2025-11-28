/**
 * IRIS Auth Client
 * Handles authentication with IRIS backend service
 */
export interface AuthResponse {
    success: boolean;
    apiKey?: string;
    userId?: string;
    email?: string;
    tier?: 'free' | 'pro' | 'enterprise';
    error?: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name?: string;
}
export declare class IrisAuthClient {
    private baseUrl;
    constructor(baseUrl?: string);
    /**
     * Login with email/password
     */
    login(email: string, password: string): Promise<AuthResponse>;
    /**
     * Register new account
     */
    register(email: string, password: string, name?: string): Promise<AuthResponse>;
    /**
     * Validate API key
     */
    validateApiKey(apiKey: string): Promise<AuthResponse>;
    /**
     * Refresh API key
     */
    refreshApiKey(currentApiKey: string): Promise<AuthResponse>;
    /**
     * Get user info
     */
    getUserInfo(apiKey: string): Promise<AuthResponse>;
}
//# sourceMappingURL=iris-auth-client.d.ts.map