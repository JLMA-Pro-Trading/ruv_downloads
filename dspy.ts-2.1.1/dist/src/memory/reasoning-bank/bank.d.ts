/**
 * ReasoningBank - Main Memory System
 *
 * Persistent memory system for AI agents with self-learning capabilities
 */
import { AgentDBClient } from '../agentdb/client';
import { KnowledgeUnit, Experience, KnowledgeQuery, PatternMatch, SAFLAConfig } from './types';
export declare class ReasoningBank {
    private logger;
    private agentDB;
    private safla;
    private units;
    private initialized;
    constructor(agentDB: AgentDBClient, saflaConfig?: Partial<SAFLAConfig>);
    /**
     * Initialize ReasoningBank
     */
    init(): Promise<void>;
    /**
     * Store a knowledge unit
     */
    store(unit: KnowledgeUnit): Promise<void>;
    /**
     * Retrieve knowledge units matching query
     */
    retrieve(query: KnowledgeQuery): Promise<KnowledgeUnit[]>;
    /**
     * Learn from experience
     */
    learnFromExperience(experience: Experience): Promise<KnowledgeUnit>;
    /**
     * Find pattern matches for a given context
     */
    findPatterns(context: any): Promise<PatternMatch[]>;
    /**
     * Evolve knowledge through SAFLA
     */
    evolve(): Promise<void>;
    /**
     * Get statistics
     */
    getStats(): {
        totalUnits: number;
        successfulUnits: number;
        transferableUnits: number;
        avgConfidence: number;
        avgSuccessRate: number;
    };
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Load knowledge units from AgentDB
     */
    private loadKnowledgeUnits;
    /**
     * Create knowledge unit from experience
     */
    private createKnowledgeUnit;
    /**
     * Find similar knowledge unit
     */
    private findSimilar;
    /**
     * Extract pattern from experience
     */
    private extractPattern;
    /**
     * Assess if knowledge is transferable
     */
    private assessTransferability;
    /**
     * Calculate similarity between unit and context
     */
    private calculateSimilarity;
    /**
     * Generate explanation for pattern match
     */
    private generateExplanation;
    /**
     * Generate embedding for knowledge unit
     */
    private generateEmbedding;
    /**
     * Simple text embedding (placeholder)
     */
    private simpleTextEmbedding;
    /**
     * Check if unit matches context
     */
    private matchesContext;
    /**
     * Ensure initialized
     */
    private ensureInitialized;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Check if context matches
     */
    private matchContext;
}
