/**
 * Context types for zero-config auto-detection
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
export interface ProjectInfo {
    projectId: string;
    projectName: string;
    projectVersion?: string;
    projectDescription?: string;
}
export interface UserInfo {
    userId: string;
    userName: string;
}
export interface GitInfo {
    gitRepo?: string;
    gitBranch?: string;
    gitCommit?: string;
}
export interface EnvironmentInfo {
    hostname: string;
    platform: string;
    nodeVersion: string;
}
//# sourceMappingURL=types.d.ts.map