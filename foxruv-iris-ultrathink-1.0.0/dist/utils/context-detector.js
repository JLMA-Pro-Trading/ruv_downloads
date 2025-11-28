/**
 * Main context detector - orchestrates all detection systems
 * Zero-config with graceful fallbacks and performance caching
 */
import os from 'os';
import { getCachedProjectInfo } from './project-detector.js';
import { getCachedUserInfo } from './user-detector.js';
import { getCachedGitInfo } from './git-detector.js';
/**
 * Detect environment information
 */
function detectEnvironment() {
    return {
        hostname: os.hostname(),
        platform: `${os.platform()}-${os.arch()}`,
        nodeVersion: process.version
    };
}
/**
 * Auto-detect all context from environment
 * Falls back gracefully if any detection fails
 *
 * @param projectRoot - Root directory of the project (defaults to cwd)
 * @returns Complete auto-detected context
 */
export async function autoDetectContext(projectRoot = process.cwd()) {
    // Run detections in parallel where possible
    const [projectInfo, userInfo, gitInfo] = await Promise.all([
        getCachedProjectInfo(projectRoot),
        Promise.resolve(getCachedUserInfo(projectRoot)),
        Promise.resolve(getCachedGitInfo(projectRoot))
    ]);
    const envInfo = detectEnvironment();
    return {
        // Project
        projectId: projectInfo.projectId,
        projectName: projectInfo.projectName,
        projectVersion: projectInfo.projectVersion,
        projectDescription: projectInfo.projectDescription,
        // User
        userId: userInfo.userId,
        userName: userInfo.userName,
        // Git
        gitRepo: gitInfo.gitRepo,
        gitBranch: gitInfo.gitBranch,
        gitCommit: gitInfo.gitCommit,
        // Environment
        hostname: envInfo.hostname,
        platform: envInfo.platform,
        nodeVersion: envInfo.nodeVersion
    };
}
/**
 * Global context cache for performance
 */
let globalContextCache = null;
let globalContextCacheRoot = null;
/**
 * Get cached context or detect if not cached
 * Uses global cache for maximum performance
 *
 * @param projectRoot - Root directory of the project
 * @returns Complete auto-detected context (cached if possible)
 */
export async function getOrDetectContext(projectRoot) {
    const root = projectRoot || process.cwd();
    // Return cached context if available and root matches
    if (globalContextCache && globalContextCacheRoot === root) {
        return globalContextCache;
    }
    // Detect new context
    const context = await autoDetectContext(root);
    // Update global cache
    globalContextCache = context;
    globalContextCacheRoot = root;
    return context;
}
/**
 * Clear all context caches
 * Useful for testing or when context changes
 */
export function clearContextCache() {
    globalContextCache = null;
    globalContextCacheRoot = null;
}
/**
 * Force refresh context (clears cache and re-detects)
 */
export async function refreshContext(projectRoot) {
    clearContextCache();
    return getOrDetectContext(projectRoot);
}
//# sourceMappingURL=context-detector.js.map