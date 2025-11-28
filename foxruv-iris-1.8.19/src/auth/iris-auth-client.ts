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

export class IrisAuthClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://api.iris.yourdomain.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Login with email/password
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      return data as AuthResponse;
    } catch (error) {
      return {
        success: false,
        error: `Login failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Register new account
   */
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();
      return data as AuthResponse;
    } catch (error) {
      return {
        success: false,
        error: `Registration failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      return data as AuthResponse;
    } catch (error) {
      return {
        success: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Refresh API key
   */
  async refreshApiKey(currentApiKey: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentApiKey}`,
        },
      });

      const data = await response.json();
      return data as AuthResponse;
    } catch (error) {
      return {
        success: false,
        error: `Refresh failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get user info
   */
  async getUserInfo(apiKey: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();
      return data as AuthResponse;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get user info: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
