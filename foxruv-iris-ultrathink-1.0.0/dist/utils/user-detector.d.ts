/**
 * User detection from git config or OS
 * Zero-config with graceful fallbacks
 */
import type { UserInfo } from './types.js';
/**
 * Detect user information from git config or OS
 * Priority: git config > OS user info > fallback
 */
export declare function detectUser(projectRoot?: string): UserInfo;
/**
 * Get cached user info or detect if not cached
 */
export declare function getCachedUserInfo(projectRoot?: string): UserInfo;
/**
 * Clear user cache
 */
export declare function clearUserCache(): void;
//# sourceMappingURL=user-detector.d.ts.map