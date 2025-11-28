/**
 * Auto-detect project and user context
 * NO environment variables needed!
 */
export interface AutoDetectedContext {
    projectId: string;
    projectName: string;
    projectVersion?: string;
    projectDescription?: string;
    userId: string;
    userName: string;
    gitRepo?: string;
    gitBranch?: string;
    gitCommit?: string;
    hostname: string;
    platform: string;
    nodeVersion: string;
}
/**
 * Auto-detect all context from environment
 * Falls back gracefully if any detection fails
 */
export declare function autoDetectContext(projectRoot?: string): Promise<AutoDetectedContext>;
export declare function getOrDetectContext(projectRoot?: string): Promise<AutoDetectedContext>;
/**
 * Clear cache (useful for testing)
 */
export declare function clearContextCache(): void;
//# sourceMappingURL=auto-detect-context.d.ts.map