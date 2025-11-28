/**
 * API Key Generation and Validation
 */

/**
 * Generate IRIS API key
 * Format: iris_[32 alphanumeric characters]
 */
export function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'iris_';

  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return key;
}

/**
 * Validate API key format
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  return /^iris_[a-zA-Z0-9]{32}$/.test(apiKey);
}

/**
 * Extract user ID from JWT token
 */
export function extractUserId(token: string): string | null {
  try {
    const payload = Buffer.from(token.split('.')[1], 'base64').toString();
    const data = JSON.parse(payload);
    return data.userId || data.sub || null;
  } catch {
    return null;
  }
}
