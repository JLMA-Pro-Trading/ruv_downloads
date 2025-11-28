/**
 * Project detection from package.json
 * Zero-config with graceful fallbacks
 */
import type { ProjectInfo } from './types.js';
/**
 * Detect project information from package.json
 * Falls back to directory name if package.json not found
 */
export declare function detectProject(projectRoot?: string): Promise<ProjectInfo>;
/**
 * Get cached project info or detect if not cached
 */
export declare function getCachedProjectInfo(projectRoot?: string): Promise<ProjectInfo>;
/**
 * Clear project cache
 */
export declare function clearProjectCache(): void;
//# sourceMappingURL=project-detector.d.ts.map