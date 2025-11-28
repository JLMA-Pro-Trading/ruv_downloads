/**
 * Prompt Registry - Expert Signature Version Management
 *
 * Centralized registry for tracking expert signatures, prompt versions,
 * and their performance across projects. Enables prompt discovery and reuse.
 *
 * Features:
 * - Expert signature versioning
 * - Performance tracking per version
 * - Cross-project prompt discovery
 * - Signature comparison and diff
 * - Best-in-class prompt retrieval
 *
 * @module prompt-registry
 * @version 2.0.0
 * @note Now uses Supabase as primary store, AgentDB as optional local cache
 */
/**
 * Expert signature with version tracking
 */
export interface ExpertSignature {
    signatureId: string;
    expertId: string;
    expertRole: string;
    project: string;
    version: string;
    prompt: string;
    inputFields: string[];
    outputFields: string[];
    deployedAt: Date;
    deprecatedAt?: Date;
    eval: {
        accuracy: number;
        confidence: number;
        avgLatency: number;
        totalEvaluations: number;
        lastUpdated: Date;
    };
    metadata?: Record<string, any>;
}
/**
 * Signature comparison result
 */
export interface SignatureComparison {
    signatureId1: string;
    signatureId2: string;
    similarity: number;
    differences: Array<{
        field: string;
        value1: string;
        value2: string;
    }>;
    performanceComparison: {
        accuracyDiff: number;
        confidenceDiff: number;
        latencyDiff: number;
    };
    recommendation: 'keep_first' | 'keep_second' | 'merge' | 'both_viable';
}
/**
 * Best signature for a role across projects
 */
export interface BestSignature {
    expertRole: string;
    signatureId: string;
    project: string;
    version: string;
    accuracy: number;
    confidence: number;
    evaluations: number;
    deployedAt: Date;
}
/**
 * Prompt evolution history
 */
export interface PromptEvolution {
    expertId: string;
    role: string;
    versions: Array<{
        version: string;
        prompt: string;
        accuracy: number;
        deployedAt: Date;
        deprecatedAt?: Date;
    }>;
    performanceTrend: 'improving' | 'stable' | 'declining';
    bestVersion: string;
}
/**
 * Configuration for prompt registry
 */
export interface PromptRegistryConfig {
    dbPath?: string;
    enableEmbeddings?: boolean;
    minEvaluationsForValidity?: number;
    useSupabase?: boolean;
    enableLocalCache?: boolean;
}
/**
 * Prompt Registry
 */
export declare class PromptRegistry {
    private db;
    private dbReady;
    private config;
    private useSupabase;
    constructor(config?: PromptRegistryConfig);
    /**
     * Initialize AgentDB (async sql.js loader with singleton)
     */
    private initializeAgentDb;
    /**
     * Ensure AgentDB is ready for operations
     */
    private ensureDbReady;
    /**
     * Get database instance after ensuring it's ready
     */
    private getDb;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Register a new expert signature
     */
    registerSignature(signature: Omit<ExpertSignature, 'signatureId' | 'eval'>, options?: {
        changelog?: string;
        improvementMetrics?: Record<string, any>;
    }): Promise<string>;
    /**
     * Update signature evaluation metrics
     */
    recordEvaluation(signatureId: string, accuracy: number, confidence: number, latencyMs: number, context?: Record<string, any>): Promise<void>;
    /**
     * Update signature aggregate metrics (local cache only)
     */
    private updateSignatureMetrics;
    /**
     * Deprecate a signature
     */
    deprecateSignature(signatureId: string): Promise<void>;
    /**
     * Get latest signature for an expert
     */
    getLatestSignature(expertId: string, project?: string): Promise<ExpertSignature | null>;
    /**
     * Get best performing signature for a role across all projects
     */
    getBestAcrossProjects(expertRole: string): Promise<BestSignature | null>;
    /**
     * Find similar signatures across projects
     */
    findSimilarSignatures(signatureId: string, threshold?: number): Promise<ExpertSignature[]>;
    /**
     * Calculate simple prompt similarity
     */
    private calculatePromptSimilarity;
    /**
     * Compare two signatures
     */
    compareSignatures(signatureId1: string, signatureId2: string): Promise<SignatureComparison>;
    /**
     * Get prompt evolution history
     */
    getPromptEvolution(expertId: string, project?: string): Promise<PromptEvolution>;
    /**
     * Get signature by ID
     */
    getSignature(signatureId: string): Promise<ExpertSignature | null>;
    /**
     * Map database row to ExpertSignature
     */
    private mapRowToSignature;
    /**
     * Get all signatures for a project
     */
    getProjectSignatures(project: string, includeDeprecated?: boolean): Promise<ExpertSignature[]>;
    /**
     * Close database connection
     */
    close(): Promise<void>;
}
/**
 * Create prompt registry
 */
export declare function createPromptRegistry(config?: PromptRegistryConfig): PromptRegistry;
//# sourceMappingURL=prompt-registry.d.ts.map