/**
 * Auto-detect project and user context
 * NO environment variables needed!
 */
import { readFile } from 'fs/promises';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
/**
 * Auto-detect all context from environment
 * Falls back gracefully if any detection fails
 */
export async function autoDetectContext(projectRoot = process.cwd()) {
    // ============================================================================
    // 1. AUTO-DETECT PROJECT from package.json
    // ============================================================================
    let projectId = path.basename(projectRoot);
    let projectName = projectId;
    let projectVersion;
    let projectDescription;
    try {
        const packagePath = path.join(projectRoot, 'package.json');
        const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
        if (packageJson.name) {
            // Clean project ID (remove @scope/ if present)
            projectId = packageJson.name.replace(/^@[^/]+\//, '');
            projectName = packageJson.name;
        }
        projectVersion = packageJson.version;
        projectDescription = packageJson.description;
    }
    catch {
        // Fallback: use directory name
        console.warn('⚠️  No package.json found, using directory name as projectId');
    }
    // ============================================================================
    // 2. AUTO-DETECT USER from git config or OS
    // ============================================================================
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
    // ============================================================================
    // 3. AUTO-DETECT GIT REPOSITORY INFO
    // ============================================================================
    let gitRepo;
    let gitBranch;
    let gitCommit;
    try {
        gitRepo = execSync('git remote get-url origin', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: projectRoot
        }).trim();
    }
    catch {
        // No git remote
    }
    try {
        gitBranch = execSync('git branch --show-current', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: projectRoot
        }).trim();
    }
    catch {
        // Not in a git repo or detached HEAD
    }
    try {
        gitCommit = execSync('git rev-parse --short HEAD', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: projectRoot
        }).trim();
    }
    catch {
        // No git
    }
    // ============================================================================
    // 4. AUTO-DETECT ENVIRONMENT INFO
    // ============================================================================
    const hostname = os.hostname();
    const platform = `${os.platform()}-${os.arch()}`;
    const nodeVersion = process.version;
    return {
        projectId,
        projectName,
        projectVersion,
        projectDescription,
        userId,
        userName,
        gitRepo,
        gitBranch,
        gitCommit,
        hostname,
        platform,
        nodeVersion
    };
}
/**
 * Cached context (detect once, reuse)
 */
let cachedContext = null;
export async function getOrDetectContext(projectRoot) {
    if (!cachedContext || projectRoot) {
        cachedContext = await autoDetectContext(projectRoot);
    }
    return cachedContext;
}
/**
 * Clear cache (useful for testing)
 */
export function clearContextCache() {
    cachedContext = null;
}
