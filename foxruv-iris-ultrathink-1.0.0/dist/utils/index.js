/**
 * Ultrathink utility functions
 * Zero-config context detection with graceful fallbacks
 */
// Main context detection
export { autoDetectContext, getOrDetectContext, clearContextCache, refreshContext } from './context-detector.js';
// Individual detectors (for advanced usage)
export { detectProject, getCachedProjectInfo, clearProjectCache } from './project-detector.js';
export { detectUser, getCachedUserInfo, clearUserCache } from './user-detector.js';
export { detectGit, getCachedGitInfo, clearGitCache, refreshGitInfo } from './git-detector.js';
//# sourceMappingURL=index.js.map