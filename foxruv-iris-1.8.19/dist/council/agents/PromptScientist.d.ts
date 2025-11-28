/**
 * PromptScientist Agent - Tier 1 Core Decision Maker
 *
 * Evolves prompts using PromptBreeder genetic algorithm
 *
 * Responsibilities:
 * - Identify top-performing prompts across projects
 * - Apply mutation and crossover techniques
 * - Evaluate fitness across multiple projects
 * - Vote on prompt upgrade decisions
 *
 * @module council/agents/PromptScientist
 * @version 1.0.0
 */
import type { CouncilTelemetryInput, PromptAnalysis } from '../types/index.js';
/**
 * PromptScientist configuration
 */
export interface PromptScientistConfig {
    minImprovementThreshold?: number;
    minTestProjects?: number;
    voteWeight?: number;
}
/**
 * PromptScientist Agent - Evolves prompts using genetic algorithms
 */
export declare class PromptScientist {
    private config;
    constructor(config?: PromptScientistConfig);
    /**
     * Analyze telemetry and evolve prompts
     */
    analyze(telemetry: CouncilTelemetryInput): Promise<PromptAnalysis>;
    /**
     * Identify top-performing experts across projects
     */
    private identifyTopExperts;
    /**
     * Evolve prompts using PromptBreeder techniques
     */
    private evolvePrompts;
    /**
     * Generate mutations for prompt evolution
     */
    private generateMutations;
    /**
     * Simulate fitness testing across projects
     */
    private simulateFitnessTesting;
    /**
     * Find deployment candidates
     */
    private findDeploymentCandidates;
    /**
     * Generate voting recommendation
     */
    private generateRecommendation;
    /**
     * Increment version string
     */
    private incrementVersion;
    /**
     * Get agent vote weight
     */
    getVoteWeight(): number;
}
/**
 * Create PromptScientist agent
 */
export declare function createPromptScientist(config?: PromptScientistConfig): PromptScientist;
//# sourceMappingURL=PromptScientist.d.ts.map