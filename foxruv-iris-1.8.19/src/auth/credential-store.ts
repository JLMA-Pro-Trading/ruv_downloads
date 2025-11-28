/**
 * Encrypted Credential Store
 * Stores user credentials securely in ~/.iris/credentials
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

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

export class CredentialStore {
  private readonly credPath: string;
  private readonly keyPath: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    const irisDir = join(homedir(), '.iris');
    if (!existsSync(irisDir)) {
      mkdirSync(irisDir, { recursive: true });
    }
    this.credPath = join(irisDir, 'credentials.enc');
    this.keyPath = join(irisDir, '.key');
  }

  /**
   * Initialize encryption key (derived from machine-specific data)
   */
  private getEncryptionKey(): Buffer {
    if (!existsSync(this.keyPath)) {
      // Generate a random salt for this machine
      const salt = randomBytes(32);
      writeFileSync(this.keyPath, salt, { mode: 0o600 });
    }

    const salt = readFileSync(this.keyPath);
    // Derive key from salt + machine info (hostname, user)
    const keyMaterial = `${process.env.USER || 'iris'}-${require('os').hostname()}`;
    return scryptSync(keyMaterial, salt, 32);
  }

  /**
   * Encrypt credentials
   */
  private encrypt(data: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt credentials
   */
  private decrypt(encryptedData: string): string {
    const key = this.getEncryptionKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Store credentials securely
   */
  async store(credentials: StoredCredentials): Promise<void> {
    const data = JSON.stringify(credentials);
    const encrypted = this.encrypt(data);
    writeFileSync(this.credPath, encrypted, { mode: 0o600 });
  }

  /**
   * Load stored credentials
   */
  async load(): Promise<StoredCredentials | null> {
    if (!existsSync(this.credPath)) {
      return null;
    }

    try {
      const encrypted = readFileSync(this.credPath, 'utf8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      return null;
    }
  }

  /**
   * Check if credentials exist
   */
  exists(): boolean {
    return existsSync(this.credPath);
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(): Promise<void> {
    const creds = await this.load();
    if (creds) {
      creds.lastUsed = new Date().toISOString();
      await this.store(creds);
    }
  }

  /**
   * Clear stored credentials
   */
  async clear(): Promise<void> {
    if (existsSync(this.credPath)) {
      writeFileSync(this.credPath, '');
      require('fs').unlinkSync(this.credPath);
    }
  }

  /**
   * Get credential store path (for debugging)
   */
  getStorePath(): string {
    return this.credPath;
  }
}
