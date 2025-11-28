/**
 * ReasoningBank Learning Integration
 *
 * Implements trajectory-based learning for self-improving agents using AgentDB's
 * ReasoningBank. Stores learning trajectories, performs pattern recognition,
 * and enables agents to learn from past experiences.
 *
 * @module reasoning-bank
 * @version 1.0.0
 */
import type { OptimizationResult } from '../clients/python-optimizer-client.js';
export interface LearningTrajectory {
    id: string;
    timestamp: string;
    expert_role: string;
    context: Record<string, any>;
    action: string;
    outcome: Record<string, any>;
    verdict: 'success' | 'partial' | 'failure';
    confidence: number;
    metadata?: Record<string, any>;
}
export interface TrajectoryPattern {
    pattern_id: string;
    pattern_type: 'success' | 'failure' | 'optimization';
    frequency: number;
    avg_confidence: number;
    contexts: Array<Record<string, any>>;
    actions: string[];
    outcomes: Array<Record<string, any>>;
}
export interface LearningInsights {
    expert_role: string;
    total_trajectories: number;
    success_rate: number;
    avg_confidence: number;
    top_patterns: TrajectoryPattern[];
    recent_improvements: Array<{
        timestamp: string;
        improvement: number;
        context: string;
    }>;
}
export declare class ReasoningBankManager {
    private db;
    private dbReady;
    private agentDB;
    constructor(dbPath?: string);
    /**
     * Initialize database asynchronously using singleton
     */
    private initializeDatabase;
    /**
     * Ensure database is ready before use
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
     * Store a learning trajectory
     */
    storeTrajectory(trajectory: LearningTrajectory): Promise<void>;
    /**
     * Store optimization result as learning trajectory
     */
    storeOptimizationTrajectory(expertRole: string, optimization: OptimizationResult): Promise<void>;
    /**
     * Get all trajectories for an expert
     */
    getTrajectories(expertRole: string, options?: {
        limit?: number;
        verdict?: 'success' | 'partial' | 'failure';
        since?: string;
    }): Promise<LearningTrajectory[]>;
    /**
     * Analyze patterns in trajectories
     */
    analyzePatterns(expertRole: string): Promise<TrajectoryPattern[]>;
    /**
     * Get learning insights for an expert
     */
    getInsights(expertRole: string): Promise<LearningInsights>;
    /**
     * Get success patterns that can inform future optimizations
     */
    getSuccessPatterns(expertRole: string): Promise<{
        high_confidence_contexts: Array<Record<string, any>>;
        successful_actions: string[];
        avg_improvement: number;
    }>;
    /**
     * Record a causal decision using AgentDB
     */
    recordCausalDecision(expertRole: string, input: Record<string, any>, output: any, reasoning: string[], causality: {
        causes: string[];
        effects: string[];
        confidence: number;
    }): Promise<string>;
    /**
     * Get causal chain for understanding decision dependencies
     */
    getCausalChain(decisionId: string, depth?: number): Promise<import("./agentdb-integration.js").CausalDecision[]>;
    /**
     * Add reflexion entry for self-improvement
     */
    addReflexion(expertRole: string, experience: string, reflection: string, insights: string[], actionItems: string[]): Promise<void>;
    /**
     * Get recent reflexions for learning
     */
    getRecentReflexions(limit?: number): Promise<import("./agentdb-integration.js").ReflexionEntry[]>;
    /**
     * Add learned skill to library
     */
    addLearnedSkill(name: string, description: string, implementation: string, prerequisites?: string[]): Promise<void>;
    /**
     * Get learned skill by name
     */
    getLearnedSkill(name: string): Promise<import("./agentdb-integration.js").LearnedSkill | null>;
    /**
     * List all learned skills
     */
    listLearnedSkills(): Promise<import("./agentdb-integration.js").LearnedSkill[]>;
    /**
     * Get comprehensive statistics including AgentDB features
     */
    getComprehensiveStats(): Promise<{
        trajectoryCount: any;
        expertCount: number;
        decisionCount: number;
        reflexionCount: number;
        skillCount: number;
    }>;
    /**
     * Close database connections
     */
    close(): void;
}
/**
 * Create ReasoningBank manager instance
 */
export declare function createReasoningBank(dbPath?: string): ReasoningBankManager;
//# sourceMappingURL=reasoning-bank.d.ts.map