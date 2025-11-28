/**
 * iris telemetry - Telemetry management commands
 *
 * Commands for managing the dual-lane telemetry system:
 * - migrate: Migrate historical data from AgentDB to Supabase
 * - sync: Trigger manual sync of queued events
 * - status: Show sync status and statistics
 */
import { type MigrationResult } from '../../migration/agentdb-to-supabase.js';
export interface TelemetryMigrateOptions {
    agentDbPath?: string;
    projectId?: string;
    dryRun?: boolean;
    batchSize?: number;
}
export interface TelemetrySyncOptions {
    force?: boolean;
    timeout?: number;
}
export interface TelemetryStatusOptions {
    detailed?: boolean;
    json?: boolean;
}
/**
 * Migrate historical data from AgentDB to Supabase
 * Usage: npx iris telemetry migrate [options]
 */
export declare function runTelemetryMigrate(options?: TelemetryMigrateOptions): Promise<MigrationResult>;
/**
 * Trigger manual sync of queued telemetry events
 * Usage: npx iris telemetry sync [options]
 */
export declare function runTelemetrySync(options?: TelemetrySyncOptions): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    pending: number;
}>;
/**
 * Show telemetry sync status and statistics
 * Usage: npx iris telemetry status [options]
 */
export declare function runTelemetryStatus(options?: TelemetryStatusOptions): Promise<void>;
export declare const telemetryCommands: {
    migrate: typeof runTelemetryMigrate;
    sync: typeof runTelemetrySync;
    status: typeof runTelemetryStatus;
};
export default telemetryCommands;
//# sourceMappingURL=telemetry.d.ts.map