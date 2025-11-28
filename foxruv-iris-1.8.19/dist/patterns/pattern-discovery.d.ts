/**
 * Pattern Discovery - Cross-Domain Learning Engine
 *
 * Discovers effective patterns, strategies, and reasoning chains across domains
 * using Supabase pgvector for centralized pattern storage and vector search.
 * Falls back to AgentDB for local acceleration.
 *
 * Features:
 * - Vector similarity search for patterns (Supabase pgvector primary, AgentDB fallback)
 * - Cross-domain strategy discovery
 * - Few-shot example retrieval
 * - Decision chain matching
 * - Transfer learning recommendations
 * - Centralized pattern storage across all projects
 *
 * @module pattern-discovery
 * @version 2.0.0
 */
/**
 * Learned pattern that can transfer across domains
 */
export interface LearnedPattern {
    patternId: string;
    project: string;
    domain: string;
    patternType: 'strategy' | 'reasoning_chain' | 'few_shot' | 'decision_tree';
    name: string;
    description: string;
    context: Record<string, any>;
    implementation: string;
    embedding: number[];
    performanceMetrics: {
        successRate: number;
        avgConfidence: number;
        usageCount: number;
        domains: string[];
    };
    reusable: boolean;
    metadata?: Record<string, any>;
}
/**
 * Pattern match result
 */
export interface PatternMatch {
    pattern: LearnedPattern;
    similarity: number;
    transferPotential: number;
    adaptationRequired: 'none' | 'minor' | 'moderate' | 'major';
    suggestions: string[];
}
/**
 * Transfer learning recommendation
 */
export interface TransferRecommendation {
    sourceProject: string;
    targetProject: string;
    patternId: string;
    patternType: string;
    expectedImprovement: number;
    confidence: number;
    adaptationSteps: string[];
    requiredContext: string[];
    risks: string[];
}
/**
 * Pattern evolution history
 */
export interface PatternEvolution {
    patternId: string;
    versions: Array<{
        version: string;
        timestamp: Date;
        successRate: number;
        changes: string[];
    }>;
    crossDomainUsage: Array<{
        project: string;
        domain: string;
        successRate: number;
        adaptations: string[];
    }>;
}
/**
 * Configuration for pattern discovery
 */
export interface PatternDiscoveryConfig {
    dbPath?: string;
    agentDBPath?: string;
    similarityThreshold?: number;
    minUsageForTransfer?: number;
    enableAutoTransfer?: boolean;
    useSupabase?: boolean;
    enableAgentDBCache?: boolean;
}
/**
 * Pattern Discovery Engine
 */
export declare class PatternDiscovery {
    private db;
    private agentDB?;
    private config;
    private useSupabase;
    private agentDbReady;
    constructor(config?: PatternDiscoveryConfig);
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    private initializeAgentDb;
    /**
     * Ensure AgentDB (if enabled) has finished initializing
     */
    private ensureAgentDbReady;
    /**
     * Convenience helper to get initialized DB instance
     */
    private getDb;
    /**
     * Initialize database tables
     */
    private initializeTables;
    /**
     * Learn and store a new pattern
     * DUAL-WRITE: Saves to BOTH Supabase, AgentDB, and local DB
     */
    learnPattern(pattern: Omit<LearnedPattern, 'patternId' | 'embedding'>): Promise<string>;
    /**
     * Generate embedding for a pattern (mock - replace with real embeddings)
     */
    private generatePatternEmbedding;
    /**
     * Record pattern usage
     */
    recordUsage(patternId: string, project: string, domain: string, success: boolean, adaptations?: string[], context?: Record<string, any>): Promise<void>;
    /**
     * Update pattern metrics
     */
    private updatePatternMetrics;
    /**
     * Find similar patterns using vector search
     * DUAL-READ: Queries BOTH Supabase and AgentDB, merges results
     */
    findSimilarPatterns(context: Record<string, any>, threshold?: number): Promise<PatternMatch[]>;
    /**
     * Calculate transfer potential
     */
    private calculateTransferPotential;
    /**
     * Calculate context overlap
     */
    private calculateContextOverlap;
    /**
     * Assess adaptation needed
     */
    private assessAdaptationNeeded;
    /**
     * Generate transfer suggestions
     */
    private generateTransferSuggestions;
    /**
     * Generate transfer recommendations for a project
     */
    generateTransferRecommendations(targetProject: string, _targetDomain: string, targetContext: Record<string, any>): Promise<TransferRecommendation[]>;
    /**
     * Generate adaptation steps
     */
    private generateAdaptationSteps;
    /**
     * Extract required context
     */
    private extractRequiredContext;
    /**
     * Assess transfer risks
     */
    private assessTransferRisks;
    /**
     * Get pattern evolution history
     */
    getPatternEvolution(patternId: string): Promise<PatternEvolution>;
    /**
     * Get pattern by ID
     */
    getPattern(patternId: string): Promise<LearnedPattern | null>;
    /**
     * Get all patterns for a project
     */
    getProjectPatterns(project: string): Promise<LearnedPattern[]>;
    /**
     * Close connections
     */
    close(): void;
}
/**
 * Create pattern discovery engine
 */
export declare function createPatternDiscovery(config?: PatternDiscoveryConfig): PatternDiscovery;
//# sourceMappingURL=pattern-discovery.d.ts.map