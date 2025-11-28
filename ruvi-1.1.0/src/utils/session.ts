import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SESSION_DIR = join(homedir(), '.ruv');
const SESSION_FILE = join(SESSION_DIR, 'session.json');

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  fullName?: string;
  expiresAt: number;
}

export function saveSession(session: SessionData): void {
  try {
    if (!existsSync(SESSION_DIR)) {
      mkdirSync(SESSION_DIR, { recursive: true });
    }
    writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
  } catch (error) {
    throw new Error('Failed to save session');
  }
}

export function loadSession(): SessionData | null {
  try {
    if (!existsSync(SESSION_FILE)) {
      return null;
    }
    const data = readFileSync(SESSION_FILE, 'utf-8');
    const session = JSON.parse(data) as SessionData;

    // Check if session is expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  } catch (error) {
    return null;
  }
}

export function clearSession(): void {
  try {
    if (existsSync(SESSION_FILE)) {
      writeFileSync(SESSION_FILE, '', 'utf-8');
    }
  } catch (error) {
    // Silent fail
  }
}

export function isSessionValid(): boolean {
  const session = loadSession();
  return session !== null;
}
