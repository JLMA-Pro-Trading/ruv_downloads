export interface MigrationOptions {
    agentDbPath: string;
    projectId: string;
    dryRun?: boolean;
    batchSize?: number;
    onProgress?: (progress: MigrationProgress) => void;
}
export interface MigrationProgress {
    phase: 'signatures' | 'reflexions' | 'telemetry' | 'consensus';
    current: number;
    total: number;
    percentage: number;
}
export interface MigrationResult {
    success: boolean;
    migratedRecords: {
        signatures: number;
        reflexions: number;
        telemetry: number;
        consensus: number;
    };
    errors: string[];
    duration: number;
}
/**
 * Migrate expert signatures from AgentDB to Supabase
 */
export declare function migrateSignatures(options: MigrationOptions): Promise<number>;
/**
 * Migrate reflexions from AgentDB to Supabase
 */
export declare function migrateReflexions(options: MigrationOptions): Promise<number>;
/**
 * Migrate telemetry data from AgentDB to Supabase
 */
export declare function migrateTelemetry(options: MigrationOptions): Promise<number>;
/**
 * Migrate consensus decisions from AgentDB to Supabase
 */
export declare function migrateConsensus(options: MigrationOptions): Promise<number>;
/**
 * Migrate all data from AgentDB to Supabase
 */
export declare function migrateAll(options: MigrationOptions): Promise<MigrationResult>;
//# sourceMappingURL=agentdb-to-supabase.d.ts.map