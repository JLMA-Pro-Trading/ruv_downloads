/**
 * CLI for Expert League and Rotation Management
 *
 * Commands:
 * - leagues: Show all league tables
 * - drift: Identify drifting experts
 * - recommend: Generate rotation recommendations
 * - execute: Execute approved rotation
 * - monitor: Check rotation monitoring status
 * - history: View ranking history
 */
import { GlobalMetricsCollector } from '../telemetry/global-metrics.js';
import { AgentDBManager } from '../storage/agentdb-integration.js';
export declare class RotationCLI {
    private leagueManager;
    constructor(agentDB: AgentDBManager, metricsCollector: GlobalMetricsCollector);
    /**
     * Display all league tables
     */
    showLeagues(expertType?: string): Promise<void>;
    /**
     * Identify and display drifting experts
     */
    showDriftingExperts(): Promise<void>;
    /**
     * Generate and display rotation recommendations
     */
    showRecommendations(): Promise<void>;
    /**
     * Execute rotation
     */
    executeRotation(rotationId: string): Promise<void>;
    /**
     * Check rotation monitoring status
     */
    showMonitoringStatus(rotationId: string): Promise<void>;
    /**
     * Show ranking history
     */
    showRankingHistory(expertId: string, projectId: string): Promise<void>;
}
/**
 * CLI entry point
 */
export declare function runRotationCLI(args: string[]): Promise<void>;
//# sourceMappingURL=rotation-cli.d.ts.map