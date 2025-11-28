/**
 * SafetyValidator Agent - Tier 2 Validator
 *
 * Ensures changes don't break production with safety guardrails
 *
 * Responsibilities:
 * - Check for degradation risk
 * - Verify rollback mechanisms exist
 * - Ensure monitoring is in place
 * - Validate gradual rollout plan
 *
 * @module council/agents/SafetyValidator
 * @version 1.0.0
 */
import type { CouncilTelemetryInput, SafetyAnalysis } from '../types/index.js';
/**
 * SafetyValidator configuration
 */
export interface SafetyValidatorConfig {
    minSafetyScore?: number;
    maxRolloutPercentage?: number;
    voteWeight?: number;
}
/**
 * SafetyValidator Agent - Ensures deployment safety
 */
export declare class SafetyValidator {
    private config;
    constructor(config?: SafetyValidatorConfig);
    /**
     * Validate safety of proposed changes
     */
    analyze(telemetry: CouncilTelemetryInput): Promise<SafetyAnalysis>;
    /**
     * Run safety checks on proposed changes
     */
    private runSafetyChecks;
    /**
     * Calculate overall safety score
     */
    private calculateSafetyScore;
    /**
     * Generate required safety guardrails
     */
    private generateGuardrails;
    /**
     * Generate rollback triggers
     */
    private generateRollbackTriggers;
    /**
     * Calculate average accuracy across all projects
     */
    private calculateAvgAccuracy;
    /**
     * Generate voting recommendation
     */
    private generateRecommendation;
    /**
     * Get agent vote weight
     */
    getVoteWeight(): number;
}
/**
 * Create SafetyValidator agent
 */
export declare function createSafetyValidator(config?: SafetyValidatorConfig): SafetyValidator;
//# sourceMappingURL=SafetyValidator.d.ts.map