/**
 * Git repository detection
 * Zero-config with graceful fallbacks
 */
import type { GitInfo } from './types.js';
/**
 * Detect git repository information
 * Returns undefined for fields that cannot be detected
 */
export declare function detectGit(projectRoot?: string): GitInfo;
/**
 * Get cached git info or detect if not cached
 */
export declare function getCachedGitInfo(projectRoot?: string): GitInfo;
/**
 * Clear git cache
 */
export declare function clearGitCache(): void;
/**
 * Force refresh git info (clears cache and re-detects)
 */
export declare function refreshGitInfo(projectRoot?: string): GitInfo;
//# sourceMappingURL=git-detector.d.ts.map