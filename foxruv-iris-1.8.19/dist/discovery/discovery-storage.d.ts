/**
 * Discovery Storage - AgentDB-based Expert Discovery and Instrumentation Tracking
 *
 * Stores and tracks discovered experts from codebase scanning:
 * - Expert class detection with telemetry/Supabase status
 * - Instrumentation history and status tracking
 * - User approval workflow for automatic instrumentation
 * - Cross-project expert discovery and reuse
 *
 * Features:
 * - AgentDB singleton pattern for efficient storage
 * - Async initialization with sql.js compatibility
 * - UNIQUE constraints for duplicate prevention
 * - Foreign key relationships for data integrity
 * - Comprehensive indexing for fast queries
 *
 * @module discovery-storage
 * @version 1.0.0
 */
/**
 * Discovered expert class from codebase scanning
 */
export interface DiscoveredExpert {
    id: string;
    project: string;
    className: string;
    filePath: string;
    hasTelemetry: boolean;
    hasSupabaseInit: boolean;
    predictionMethods: string[];
    discoveredAt: Date;
    lastScanned: Date;
    instrumentationStatus: InstrumentationStatus;
    description?: string;
    expertType?: string;
    confidence?: number;
    dependencies?: string[];
}
/**
 * Instrumentation status states
 */
export type InstrumentationStatus = 'pending' | 'approved' | 'instrumented' | 'skipped' | 'failed' | 'needs_review';
/**
 * Code change record for instrumentation
 */
export interface CodeChange {
    filePath: string;
    changeType: 'import_added' | 'telemetry_added' | 'supabase_init' | 'method_wrapped';
    lineNumber?: number;
    originalCode?: string;
    newCode?: string;
    description: string;
}
/**
 * Instrumentation history record
 */
export interface InstrumentationRecord {
    id: string;
    expertId: string;
    timestamp: Date;
    action: InstrumentationAction;
    changesMade: CodeChange[];
    userApproved: boolean;
    userId?: string;
    notes?: string;
    errorMessage?: string;
}
/**
 * Instrumentation action types
 */
export type InstrumentationAction = 'discovered' | 'instrumented' | 'skipped' | 'failed' | 're_scanned' | 'updated';
/**
 * Configuration for discovery storage
 */
export interface DiscoveryStorageConfig {
    dbPath?: string;
    enableIndexing?: boolean;
    autoVacuum?: boolean;
}
/**
 * Filter options for querying experts
 */
export interface ExpertFilterOptions {
    project?: string;
    hasTelemetry?: boolean;
    hasSupabaseInit?: boolean;
    instrumentationStatus?: InstrumentationStatus | InstrumentationStatus[];
    expertType?: string;
    minConfidence?: number;
}
/**
 * Statistics about discovered experts
 */
export interface DiscoveryStats {
    totalExperts: number;
    byStatus: Record<InstrumentationStatus, number>;
    byProject: Record<string, number>;
    withTelemetry: number;
    withSupabase: number;
    needsInstrumentation: number;
    averageConfidence: number;
}
/**
 * Discovery Storage - AgentDB-based expert discovery and instrumentation tracking
 *
 * Manages discovered experts and their instrumentation lifecycle.
 */
export declare class DiscoveryStorage {
    private db;
    private config;
    private dbReady;
    constructor(config?: DiscoveryStorageConfig);
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    private initializeDatabase;
    /**
     * Ensure AgentDB is ready for operations
     */
    private ensureDbReady;
    /**
     * Get initialized DB instance
     */
    private getDb;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Enable auto-vacuum for database maintenance
     */
    private enableAutoVacuum;
    /**
     * Store a discovered expert
     *
     * Uses INSERT OR REPLACE to handle re-scans.
     * Updates last_scanned and other fields if expert already exists.
     */
    storeDiscoveredExpert(expert: DiscoveredExpert): Promise<void>;
    /**
     * Store multiple experts in a batch (uses transaction)
     */
    storeDiscoveredExpertsBatch(experts: DiscoveredExpert[]): Promise<void>;
    /**
     * Get expert by ID
     */
    getExpert(id: string): Promise<DiscoveredExpert | null>;
    /**
     * Get all experts for a project
     */
    getProjectExperts(project: string): Promise<DiscoveredExpert[]>;
    /**
     * Get experts that need instrumentation (no telemetry or Supabase)
     */
    getUninstrumentedExperts(project?: string): Promise<DiscoveredExpert[]>;
    /**
     * Get experts with filters
     */
    getExperts(filters?: ExpertFilterOptions): Promise<DiscoveredExpert[]>;
    /**
     * Update instrumentation status
     */
    updateInstrumentationStatus(expertId: string, status: InstrumentationStatus, notes?: string): Promise<void>;
    /**
     * Mark expert as instrumented with changes
     */
    markInstrumented(expertId: string, changes: CodeChange[], userId?: string, notes?: string): Promise<void>;
    /**
     * Delete expert by ID
     */
    deleteExpert(id: string): Promise<void>;
    /**
     * Record instrumentation event
     */
    recordInstrumentation(record: InstrumentationRecord): Promise<void>;
    /**
     * Get instrumentation history for a project
     */
    getInstrumentationHistory(project: string, limit?: number): Promise<InstrumentationRecord[]>;
    /**
     * Get instrumentation history for a specific expert
     */
    getExpertHistory(expertId: string): Promise<InstrumentationRecord[]>;
    /**
     * Get recent instrumentation events across all projects
     */
    getRecentInstrumentations(limit?: number): Promise<InstrumentationRecord[]>;
    /**
     * Get discovery statistics
     */
    getStats(project?: string): Promise<DiscoveryStats>;
    /**
     * Empty stats object
     */
    private emptyStats;
    /**
     * Convert database row to DiscoveredExpert
     */
    private rowToExpert;
    /**
     * Convert database row to InstrumentationRecord
     */
    private rowToHistory;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Close database connection
     */
    close(): void;
}
/**
 * Factory function to create storage instance
 */
export declare function createDiscoveryStorage(config?: DiscoveryStorageConfig): DiscoveryStorage;
//# sourceMappingURL=discovery-storage.d.ts.map