/**
 * Pattern Discovery and Learning
 *
 * Discovers and learns from MCP usage patterns:
 * - Sequential tool usage patterns
 * - Successful generation patterns
 * - Anti-patterns and failure modes
 * - Optimization recommendations
 *
 * Uses AgentDB's vector search and learning algorithms
 */
import type { DiscoveredPattern, PatternRecommendation, AntiPattern, MCPInvocation } from './types.js';
export declare class PatternLearner {
    private db;
    private vectorSearch;
    private embedder;
    private learningSystem;
    private patterns;
    constructor(dbPath?: string, embeddingModel?: string);
    /**
     * Initialize database schema for patterns
     */
    private initializeSchema;
    /**
     * Discover patterns from invocation history
     */
    discoverPatterns(invocations: MCPInvocation[]): Promise<DiscoveredPattern[]>;
    /**
     * Discover sequential tool usage patterns
     */
    private discoverSequentialPatterns;
    /**
     * Discover combination patterns (tools used together)
     */
    private discoverCombinationPatterns;
    /**
     * Discover success patterns from high-performing invocations
     */
    private discoverSuccessPatterns;
    /**
     * Discover anti-patterns (things to avoid)
     */
    private discoverAntiPatterns;
    /**
     * Get recommendations based on context
     */
    getRecommendations(context: string, currentTools: string[], limit?: number): Promise<PatternRecommendation[]>;
    /**
     * Learn from successful generations
     */
    learnFromSuccess(invocations: MCPInvocation[], outcome: 'success' | 'failure', feedback?: string): Promise<void>;
    /**
     * Get anti-patterns to avoid
     */
    getAntiPatterns(): Promise<AntiPattern[]>;
    private groupBySession;
    private calculateAvgLatency;
    private calculateReliability;
    private determineImpact;
    private storePattern;
    private rowToPattern;
    private generateRemediation;
    private generateReasoning;
    private determineApplicableContext;
    private describeExpectedImpact;
    private invocationToState;
}
//# sourceMappingURL=patterns.d.ts.map