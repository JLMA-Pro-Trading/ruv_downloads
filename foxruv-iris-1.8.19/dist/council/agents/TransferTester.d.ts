/**
 * TransferTester Agent - Tier 2 Validator
 *
 * Tests pattern/prompt applicability across projects with A/B testing
 *
 * Responsibilities:
 * - Run A/B tests with small traffic percentages
 * - Measure accuracy, confidence, latency changes
 * - Assess domain compatibility
 * - Calculate improvement confidence intervals
 *
 * @module council/agents/TransferTester
 * @version 1.0.0
 */
import type { CouncilTelemetryInput, TransferTestAnalysis } from '../types/index.js';
/**
 * TransferTester configuration
 */
export interface TransferTesterConfig {
    testPercentage?: number;
    testDuration?: string;
    minImprovement?: number;
    voteWeight?: number;
}
/**
 * TransferTester Agent - Validates cross-domain applicability
 */
export declare class TransferTester {
    private config;
    constructor(config?: TransferTesterConfig);
    /**
     * Validate pattern/prompt transfers
     */
    analyze(telemetry: CouncilTelemetryInput): Promise<TransferTestAnalysis>;
    /**
     * Run transfer tests for patterns
     */
    private runTransferTests;
    /**
     * Find compatible target projects for a pattern
     */
    private findCompatibleProjects;
    /**
     * Simulate A/B test for pattern transfer
     */
    private simulateABTest;
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
 * Create TransferTester agent
 */
export declare function createTransferTester(config?: TransferTesterConfig): TransferTester;
//# sourceMappingURL=TransferTester.d.ts.map