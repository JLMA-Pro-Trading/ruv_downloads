/**
 * FoxRuv Prime AI Council - Main Orchestrator
 *
 * 6-Agent federated learning control plane for cross-project decisions
 *
 * Architecture:
 * - Tier 1: PatternMaster, PromptScientist, PerformanceJudge
 * - Tier 2: TransferTester, SafetyValidator
 * - Tier 3: ConsensusOrchestrator
 *
 * @module council/AICouncil
 * @version 1.0.0
 */
import type { AICouncilConfig, CouncilTelemetryInput, CouncilMeetingResult } from './types/index.js';
/**
 * FoxRuv Prime AI Council
 *
 * Main orchestrator for 6-agent federated learning control plane
 */
export declare class AICouncil {
    private patternMaster;
    private promptScientist;
    private performanceJudge;
    private transferTester;
    private safetyValidator;
    private consensusOrchestrator;
    private metricsCollector;
    private config;
    constructor(config?: AICouncilConfig);
    /**
     * Hold council meeting: Analyze telemetry and make decisions
     */
    holdMeeting(telemetry: CouncilTelemetryInput): Promise<CouncilMeetingResult>;
    /**
     * Run PatternMaster analysis
     */
    private runPatternMasterAnalysis;
    /**
     * Run PromptScientist analysis
     */
    private runPromptScientistAnalysis;
    /**
     * Run PerformanceJudge analysis
     */
    private runPerformanceJudgeAnalysis;
    /**
     * Run TransferTester analysis
     */
    private runTransferTesterAnalysis;
    /**
     * Run SafetyValidator analysis
     */
    private runSafetyValidatorAnalysis;
    /**
     * Generate decisions from analyses and consensus
     */
    private generateDecisions;
    /**
     * Create execution plan for decisions
     */
    private createExecutionPlan;
    /**
     * Generate meeting summary
     */
    private generateSummary;
    /**
     * Execute council decisions
     */
    executeDecisions(result: CouncilMeetingResult): Promise<void>;
    /**
     * Close all resources
     */
    close(): void;
}
/**
 * Create AI Council
 */
export declare function createAICouncil(config?: AICouncilConfig): AICouncil;
//# sourceMappingURL=AICouncil.d.ts.map