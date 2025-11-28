/**
 * User detection from git config or OS
 * Zero-config with graceful fallbacks
 */
import { execSync } from 'child_process';
import os from 'os';
/**
 * Detect user information from git config or OS
 * Priority: git config > OS user info > fallback
 */
export function detectUser(projectRoot = process.cwd()) {
    let userId = 'unknown-user';
    let userName = 'Unknown User';
    try {
        // Try git config first (most accurate for dev context)
        const gitEmail = execSync('git config user.email', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: projectRoot
        }).trim();
        const gitName = execSync('git config user.name', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: projectRoot
        }).trim();
        if (gitEmail)
            userId = gitEmail;
        if (gitName)
            userName = gitName;
    }
    catch {
        // Git not available, try OS user info
        try {
            const osUser = os.userInfo();
            userId = osUser.username;
            userName = osUser.username;
        }
        catch {
            // Ultimate fallback (shouldn't happen)
            console.warn('⚠️  Could not detect user, using unknown-user');
        }
    }
    return { userId, userName };
}
/**
 * Cache for user detection
 */
const userCache = new Map();
/**
 * Get cached user info or detect if not cached
 */
export function getCachedUserInfo(projectRoot = process.cwd()) {
    const cached = userCache.get(projectRoot);
    if (cached) {
        return cached;
    }
    const info = detectUser(projectRoot);
    userCache.set(projectRoot, info);
    return info;
}
/**
 * Clear user cache
 */
export function clearUserCache() {
    userCache.clear();
}
//# sourceMappingURL=user-detector.js.map