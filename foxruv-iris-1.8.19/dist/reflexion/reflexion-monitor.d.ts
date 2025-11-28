/**
 * Reflexion Monitor - Drift-Aware Self-Correction System
 *
 * Tracks whether reflexions remain valid over time based on recent outcomes.
 * Flags outdated reasoning chains and triggers self-correction when needed.
 *
 * Features:
 * - Reflexion drift detection
 * - Validity scoring based on recent outcomes
 * - Automatic staleness marking
 * - Advisory generation for developers
 * - Cross-project reflexion comparison
 *
 * Integrates with Supabase reflexion_bank for persistence and vector search
 * while maintaining AgentDB as a fallback cache.
 *
 * @module reflexion-monitor
 * @version 2.0.0
 */
/**
 * Reflexion with validity tracking
 */
export interface TrackedReflexion {
    id: string;
    project: string;
    expertRole: string;
    experience: string;
    reflection: string;
    insights: string[];
    actionItems: string[];
    timestamp: Date;
    validityScore: number;
    usageCount: number;
    successfulUses: number;
    lastUsed?: Date;
    markedStale: boolean;
    staleReason?: string;
}
/**
 * Drift detection result
 */
export interface DriftDetection {
    reflexionId: string;
    driftDetected: boolean;
    severityLevel: 'low' | 'medium' | 'high' | 'critical';
    reason: string;
    recommendations: string[];
    affectedProjects: string[];
    validityChange: number;
}
/**
 * Reflexion comparison across projects
 */
export interface ReflexionComparison {
    reflexionId: string;
    project: string;
    similarReflexions: Array<{
        id: string;
        project: string;
        similarity: number;
        validityScore: number;
        reusable: boolean;
    }>;
    transferPotential: number;
}
/**
 * Advisory for developers
 */
export interface ReflexionAdvisory {
    type: 'update_needed' | 'deprecation' | 'transfer_opportunity' | 'conflict';
    severity: 'info' | 'warning' | 'error';
    message: string;
    reflexionId: string;
    recommendations: string[];
    timestamp: Date;
}
/**
 * Configuration for reflexion monitoring
 */
export interface ReflexionMonitorConfig {
    dbPath?: string;
    validityThreshold?: number;
    driftWindow?: number;
    minUsageForValidity?: number;
    crossProjectEnabled?: boolean;
}
/**
 * Reflexion Monitor - Track and manage reflexion validity
 */
export declare class ReflexionMonitor {
    private db;
    private config;
    private dbReady;
    constructor(config?: ReflexionMonitorConfig);
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Initialize AgentDB (async sql.js loader)
     */
    private initializeDatabase;
    /**
     * Ensure AgentDB is ready for operations
     */
    private ensureDbReady;
    /**
     * Helper to return initialized AgentDB instance
     */
    private getDb;
    /**
     * Track a new reflexion
     * DUAL-WRITE: Saves to BOTH Supabase and AgentDB
     */
    trackReflexion(id: string, project: string, expertRole: string, experience: string, reflection: string, insights: string[], actionItems: string[]): Promise<void>;
    /**
     * Cache reflexion in local AgentDB
     */
    private cacheReflexionLocally;
    /**
     * Record reflexion usage and outcome
     */
    recordUsage(reflexionId: string, project: string, success: boolean, context?: Record<string, any>, outcome?: Record<string, any>): Promise<void>;
    /**
     * Recalculate validity score based on recent outcomes
     */
    private recalculateValidity;
    /**
     * Mark reflexion as stale
     * Updates both Supabase and local cache
     */
    markAsStale(reflexionId: string, reason: string): Promise<void>;
    /**
     * Mark reflexion as reused
     * Primary: Updates Supabase reuse_count
     * Fallback: Updates local AgentDB
     */
    markAsReused(reflexionId: string): Promise<void>;
    /**
     * Increment reuse count in local AgentDB
     */
    private incrementLocalReuseCount;
    /**
     * Detect drift for a reflexion
     */
    detectDrift(reflexionId: string): Promise<DriftDetection>;
    /**
     * Calculate validity for a specific time period
     */
    private calculateValidityForPeriod;
    /**
     * Generate recommendations based on drift
     */
    private generateDriftRecommendations;
    /**
     * Find similar reflexions across projects
     * DUAL-READ: Queries BOTH Supabase and AgentDB, merges results
     */
    findSimilarReflexions(reflexionId: string, threshold?: number): Promise<ReflexionComparison>;
    /**
     * Local similarity search using AgentDB
     */
    private findSimilarReflexionsLocal;
    /**
     * Generate embedding for reflexion (placeholder - integrate with actual embedding service)
     */
    private generateEmbedding;
    /**
     * Extract project from Supabase reflexion context
     */
    private extractProjectFromContext;
    /**
     * Extract ID from Supabase reflexion context
     */
    private extractIdFromContext;
    /**
     * Create advisory for developers
     */
    createAdvisory(advisory: ReflexionAdvisory): Promise<void>;
    /**
     * Get unacknowledged advisories
     */
    getUnacknowledgedAdvisories(): Promise<ReflexionAdvisory[]>;
    /**
     * Acknowledge advisory
     */
    acknowledgeAdvisory(advisoryId: number): Promise<void>;
    /**
     * Get reflexion by ID
     */
    getReflexion(id: string): Promise<TrackedReflexion | null>;
    /**
     * Get all reflexions for a project
     */
    getProjectReflexions(project: string, includeStale?: boolean): Promise<TrackedReflexion[]>;
    /**
     * Get statistics
     * Primary: Uses Supabase reflexion stats
     * Fallback: Uses local AgentDB stats
     */
    getStats(project?: string): Promise<{
        totalReflexions: number;
        staleReflexions: number;
        avgValidity: number;
        totalUsage: number;
        recentDriftEvents: number;
    }>;
    /**
     * Close database connection
     */
    close(): void;
}
/**
 * Create reflexion monitor instance
 */
export declare function createReflexionMonitor(config?: ReflexionMonitorConfig): ReflexionMonitor;
//# sourceMappingURL=reflexion-monitor.d.ts.map