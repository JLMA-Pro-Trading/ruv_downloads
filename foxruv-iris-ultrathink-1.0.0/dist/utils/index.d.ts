/**
 * Ultrathink utility functions
 * Zero-config context detection with graceful fallbacks
 */
export type { AutoDetectedContext, ProjectInfo, UserInfo, GitInfo, EnvironmentInfo } from './types.js';
export { autoDetectContext, getOrDetectContext, clearContextCache, refreshContext } from './context-detector.js';
export { detectProject, getCachedProjectInfo, clearProjectCache } from './project-detector.js';
export { detectUser, getCachedUserInfo, clearUserCache } from './user-detector.js';
export { detectGit, getCachedGitInfo, clearGitCache, refreshGitInfo } from './git-detector.js';
//# sourceMappingURL=index.d.ts.map