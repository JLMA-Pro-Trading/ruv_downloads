/**
 * Main context detector - orchestrates all detection systems
 * Zero-config with graceful fallbacks and performance caching
 */
import type { AutoDetectedContext } from './types.js';
/**
 * Auto-detect all context from environment
 * Falls back gracefully if any detection fails
 *
 * @param projectRoot - Root directory of the project (defaults to cwd)
 * @returns Complete auto-detected context
 */
export declare function autoDetectContext(projectRoot?: string): Promise<AutoDetectedContext>;
/**
 * Get cached context or detect if not cached
 * Uses global cache for maximum performance
 *
 * @param projectRoot - Root directory of the project
 * @returns Complete auto-detected context (cached if possible)
 */
export declare function getOrDetectContext(projectRoot?: string): Promise<AutoDetectedContext>;
/**
 * Clear all context caches
 * Useful for testing or when context changes
 */
export declare function clearContextCache(): void;
/**
 * Force refresh context (clears cache and re-detects)
 */
export declare function refreshContext(projectRoot?: string): Promise<AutoDetectedContext>;
//# sourceMappingURL=context-detector.d.ts.map