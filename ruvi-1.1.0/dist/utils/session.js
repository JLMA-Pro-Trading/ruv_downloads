import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
const SESSION_DIR = join(homedir(), '.ruv');
const SESSION_FILE = join(SESSION_DIR, 'session.json');
export function saveSession(session) {
    try {
        if (!existsSync(SESSION_DIR)) {
            mkdirSync(SESSION_DIR, { recursive: true });
        }
        writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), 'utf-8');
    }
    catch (error) {
        throw new Error('Failed to save session');
    }
}
export function loadSession() {
    try {
        if (!existsSync(SESSION_FILE)) {
            return null;
        }
        const data = readFileSync(SESSION_FILE, 'utf-8');
        const session = JSON.parse(data);
        // Check if session is expired
        if (session.expiresAt && Date.now() > session.expiresAt) {
            clearSession();
            return null;
        }
        return session;
    }
    catch (error) {
        return null;
    }
}
export function clearSession() {
    try {
        if (existsSync(SESSION_FILE)) {
            writeFileSync(SESSION_FILE, '', 'utf-8');
        }
    }
    catch (error) {
        // Silent fail
    }
}
export function isSessionValid() {
    const session = loadSession();
    return session !== null;
}
//# sourceMappingURL=session.js.map