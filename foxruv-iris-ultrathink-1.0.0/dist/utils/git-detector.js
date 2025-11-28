/**
 * Git repository detection
 * Zero-config with graceful fallbacks
 */
import { execSync } from 'child_process';
/**
 * Detect git repository information
 * Returns undefined for fields that cannot be detected
 */
export function detectGit(projectRoot = process.cwd()) {
    let gitRepo;
    let gitBranch;
    let gitCommit;
    // Detect remote URL
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
    // Detect current branch
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
    // Detect current commit
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
    return { gitRepo, gitBranch, gitCommit };
}
/**
 * Cache for git detection
 */
const gitCache = new Map();
/**
 * Get cached git info or detect if not cached
 */
export function getCachedGitInfo(projectRoot = process.cwd()) {
    const cached = gitCache.get(projectRoot);
    if (cached) {
        return cached;
    }
    const info = detectGit(projectRoot);
    gitCache.set(projectRoot, info);
    return info;
}
/**
 * Clear git cache
 */
export function clearGitCache() {
    gitCache.clear();
}
/**
 * Force refresh git info (clears cache and re-detects)
 */
export function refreshGitInfo(projectRoot = process.cwd()) {
    gitCache.delete(projectRoot);
    return getCachedGitInfo(projectRoot);
}
//# sourceMappingURL=git-detector.js.map