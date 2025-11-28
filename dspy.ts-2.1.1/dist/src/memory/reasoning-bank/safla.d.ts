/**
 * SAFLA - Self-Aware Feedback Loop Algorithm
 *
 * Implements the core algorithm for evolving knowledge in ReasoningBank
 */
import { KnowledgeUnit, SAFLAConfig } from './types';
/**
 * Default SAFLA configuration
 */
export declare const DEFAULT_SAFLA_CONFIG: SAFLAConfig;
/**
 * SAFLA engine for knowledge evolution
 */
export declare class SAFLA {
    private config;
    private logger;
    private evolutionTimer?;
    constructor(config?: Partial<SAFLAConfig>);
    /**
     * Start automatic evolution
     */
    startAutoEvolution(callback: () => Promise<void>): void;
    /**
     * Stop automatic evolution
     */
    stopAutoEvolution(): void;
    /**
     * Evaluate knowledge units for pruning
     */
    evaluateForPruning(units: KnowledgeUnit[]): {
        keep: KnowledgeUnit[];
        prune: KnowledgeUnit[];
    };
    /**
     * Determine if a knowledge unit should be pruned
     */
    private shouldPrune;
    /**
     * Update knowledge unit based on new experience
     */
    updateFromExperience(unit: KnowledgeUnit, success: boolean, feedback?: {
        score: number;
        comments: string[];
    }): KnowledgeUnit;
    /**
     * Update confidence score using exponential moving average
     */
    private updateConfidence;
    /**
     * Merge related knowledge units
     */
    mergeUnits(units: KnowledgeUnit[]): KnowledgeUnit;
    /**
     * Generate ID for merged unit
     */
    private generateMergedId;
    /**
     * Get age of knowledge unit in days
     */
    private getAgeInDays;
    /**
     * Evolve knowledge through reflection
     *
     * Analyzes patterns and generates insights
     */
    evolve(units: KnowledgeUnit[]): Promise<{
        insights: string[];
        patterns: string[];
        recommendations: string[];
    }>;
    /**
     * Extract common patterns from knowledge units
     */
    private extractPatterns;
    /**
     * Generate recommendations based on failures and successes
     */
    private generateRecommendations;
}
