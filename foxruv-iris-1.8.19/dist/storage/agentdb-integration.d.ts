/**
 * Real AgentDB Integration
 *
 * Full-featured AgentDB integration with:
 * - Vector similarity search for expert retrieval
 * - Causal reasoning for decision tracking
 * - Reflexion memory for self-improvement
 * - Skill library for learned capabilities
 * - Episodic memory for experience tracking
 *
 * @module agentdb-integration
 * @version 1.0.0
 */
/**
 * Expert embedding for semantic search
 */
export interface ExpertEmbedding {
    expertId: string;
    name: string;
    signature: string;
    embedding: number[];
    performance: number;
    metadata: Record<string, any>;
}
/**
 * Causal decision record for tracking reasoning chains
 */
export interface CausalDecision {
    id: string;
    timestamp: Date;
    expertId: string;
    input: Record<string, any>;
    output: any;
    reasoning: string[];
    causality: {
        causes: string[];
        effects: string[];
        confidence: number;
    };
    outcome?: {
        success: boolean;
        metrics: Record<string, number>;
    };
}
/**
 * Reflexion entry for self-improvement
 */
export interface ReflexionEntry {
    id: string;
    timestamp: Date;
    experience: string;
    reflection: string;
    insights: string[];
    actionItems: string[];
    relatedDecisions: string[];
}
/**
 * Learned skill in the skill library
 */
export interface LearnedSkill {
    id: string;
    name: string;
    description: string;
    implementation: string;
    prerequisites: string[];
    performance: {
        successRate: number;
        avgLatency: number;
        usageCount: number;
    };
    examples: Array<{
        input: any;
        output: any;
        context?: string;
    }>;
}
/**
 * Configuration for AgentDB integration
 */
export interface AgentDBConfig {
    dbPath?: string;
    enableCausalReasoning?: boolean;
    enableReflexion?: boolean;
    enableSkillLibrary?: boolean;
    vectorDimension?: number;
    similarityThreshold?: number;
}
/**
 * AgentDB Manager for learning and memory
 */
export declare class AgentDBManager {
    private db;
    private ready;
    private config;
    constructor(config?: AgentDBConfig);
    /**
     * Initialize AgentDB using singleton pattern
     */
    private initializeAgentDb;
    /**
     * Initialize database tables for learning features
     */
    private initializeTables;
    /**
     * Store expert embedding for semantic search
     */
    storeExpertEmbedding(expert: ExpertEmbedding): Promise<void>;
    /**
     * Find similar experts using vector similarity search
     */
    findSimilarExperts(queryEmbedding: number[], topK?: number): Promise<ExpertEmbedding[]>;
    /**
     * Get expert by ID
     */
    getExpert(expertId: string): Promise<ExpertEmbedding | null>;
    /**
     * Record a causal decision
     */
    recordCausalDecision(decision: CausalDecision): Promise<void>;
    /**
     * Get causal chain for a decision
     */
    getCausalChain(decisionId: string, depth?: number): Promise<CausalDecision[]>;
    /**
     * Add reflexion entry for self-improvement
     */
    addReflexion(entry: ReflexionEntry): Promise<void>;
    /**
     * Get recent reflexions
     */
    getRecentReflexions(limit?: number): Promise<ReflexionEntry[]>;
    /**
     * Add skill to library
     */
    addSkill(skill: LearnedSkill): Promise<void>;
    /**
     * Get skill by name
     */
    getSkill(name: string): Promise<LearnedSkill | null>;
    /**
     * List all skills
     */
    listSkills(): Promise<LearnedSkill[]>;
    /**
     * Update skill performance metrics
     */
    updateSkillPerformance(skillName: string, metrics: {
        successRate?: number;
        avgLatency?: number;
        usageCount?: number;
    }): Promise<void>;
    /**
     * Find experts across all projects by role
     */
    findExpertsByRole(role: string, topK?: number): Promise<ExpertEmbedding[]>;
    /**
     * Compare expert performance across projects
     */
    compareExpertsAcrossProjects(expertRole: string): Promise<{
        expertRole: string;
        totalExperts: number;
        avgPerformance: number;
        bestExpert: {
            expertId: string;
            project: string;
            performance: number;
        } | null;
        projectPerformance: Array<{
            project: string;
            avgPerformance: number;
            count: number;
        }>;
    }>;
    /**
     * Export expert knowledge for cross-project sharing
     */
    exportExpertKnowledge(expertId: string): Promise<{
        expert: ExpertEmbedding;
        skills: LearnedSkill[];
        reflexions: ReflexionEntry[];
        decisions: CausalDecision[];
    } | null>;
    /**
     * Import expert knowledge from another project
     */
    importExpertKnowledge(knowledge: {
        expert: ExpertEmbedding;
        skills: LearnedSkill[];
        reflexions: ReflexionEntry[];
        decisions: CausalDecision[];
    }, targetProject: string): Promise<string>;
    /**
     * Close database connection
     */
    /**
     * Close database connection via Singleton
     */
    close(): void;
    /**
     * Get database statistics
     */
    getStats(): Promise<{
        expertCount: number;
        decisionCount: number;
        reflexionCount: number;
        skillCount: number;
    }>;
    setKeyValue(key: string, value: any): Promise<void>;
    getKeyValue<T = any>(key: string): Promise<T | null>;
    deleteKey(key: string): Promise<void>;
    listKeyPrefix(prefix: string): Promise<Array<{
        key: string;
        value: any;
    }>>;
    /**
     * Get expert performance statistics
     */
    getExpertStats(expertId: string): Promise<{
        expertId: string;
        totalDecisions: number;
        successfulDecisions: number;
        winRate: number;
        averageConfidence: number;
        recentPerformance: number;
    } | null>;
    /**
     * Alias for getExpertStats (backward compatibility)
     */
    getExpertPerformance(expertId: string): Promise<{
        expertId: string;
        totalDecisions: number;
        successfulDecisions: number;
        winRate: number;
        averageConfidence: number;
        recentPerformance: number;
    } | null>;
    /**
     * Get win rate for an expert
     */
    getWinRate(expertId: string): Promise<number>;
    /**
     * Get recent decisions with optional filtering
     */
    getRecentDecisions(options?: {
        expertId?: string;
        limit?: number;
        successOnly?: boolean;
    }): Promise<CausalDecision[]>;
    /**
     * Get all experts
     */
    getAllExperts(): Promise<ExpertEmbedding[]>;
    /**
     * Get open decisions (decisions without outcomes)
     */
    getOpenDecisions(): Promise<CausalDecision[]>;
    /**
     * Discover patterns in decision data
     */
    discoverPatterns(options?: {
        expertId?: string;
        minOccurrences?: number;
        timeWindowDays?: number;
    }): Promise<Array<{
        pattern: string;
        occurrences: number;
        successRate: number;
        examples: string[];
    }>>;
}
/**
 * Create AgentDB manager with default configuration
 */
export declare function createAgentDB(config?: AgentDBConfig): AgentDBManager;
//# sourceMappingURL=agentdb-integration.d.ts.map