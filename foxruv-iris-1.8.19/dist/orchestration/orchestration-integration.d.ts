/**
 * Agent Orchestration Integration
 *
 * Wraps @foxruv/agent-orchestration to provide:
 * - Seven-phase orchestration workflow
 * - Consensus computation and validation
 * - Integration with Iris's learning systems
 *
 * @module orchestration-integration
 */
/**
 * Orchestration configuration options
 */
export interface OrchestrationConfig {
    /** Platform type for orchestration */
    platform?: 'local' | 'distributed' | 'cloud';
    /** Enable learning capabilities */
    enableLearning?: boolean;
    /** Enable conflict resolution */
    enableConflictResolution?: boolean;
    /** Enable adaptive sampling */
    enableAdaptiveSampling?: boolean;
    /** Confidence threshold for consensus (0-1) */
    confidenceThreshold?: number;
}
/**
 * Analysis result from an agent
 */
export interface AgentAnalysis {
    agentId: string;
    phase: string;
    result: any;
    confidence: number;
    timestamp: Date;
    metadata?: Record<string, any>;
}
/**
 * Challenger validation result
 */
export interface ChallengerValidation {
    challengerId: string;
    targetAnalysisId: string;
    isValid: boolean;
    confidence: number;
    issues?: string[];
    suggestions?: string[];
}
/**
 * Validation check result
 */
export interface ValidationResult {
    validatorId: string;
    passed: boolean;
    confidence: number;
    checks: Array<{
        name: string;
        passed: boolean;
        message?: string;
    }>;
}
/**
 * Consensus computation result
 */
export interface ConsensusResult {
    consensusReached: boolean;
    confidence: number;
    finalResult: any;
    agreementLevel: number;
    dissenting: Array<{
        agentId: string;
        reason: string;
    }>;
    metadata: {
        analysesCount: number;
        challengersCount: number;
        validationsCount: number;
        computedAt: Date;
    };
}
/**
 * Seven-phase orchestration result
 */
export interface OrchestrationPhaseResult {
    phase: string;
    phaseNumber: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: any;
    startedAt?: Date;
    completedAt?: Date;
    error?: Error;
}
/**
 * Agent Orchestration Manager
 *
 * Manages the seven-phase orchestration workflow and consensus computation
 * for Iris's multi-agent learning system.
 */
export declare class AgentOrchestrationManager {
    private orchestrator;
    private config;
    /**
     * Seven phases of the orchestration workflow
     */
    private readonly SEVEN_PHASES;
    constructor(config?: OrchestrationConfig);
    /**
     * Create a seven-phase orchestrator instance
     *
     * Initializes the orchestrator with learning and conflict resolution enabled.
     *
     * @returns Orchestrator instance
     */
    createSevenPhaseOrchestrator(): any;
    /**
     * Validate consensus across analyses, challengers, and validations
     *
     * Computes consensus using the @foxruv/agent-orchestration package,
     * applying confidence thresholds and adaptive sampling.
     *
     * @param analyses - Array of agent analyses
     * @param challengers - Array of challenger validations
     * @param validations - Array of validation results
     * @returns Consensus computation result
     */
    validateConsensus(analyses: AgentAnalysis[], challengers: ChallengerValidation[], validations: ValidationResult[]): Promise<ConsensusResult>;
    /**
     * Execute a single phase of the orchestration workflow
     *
     * @param phase - Phase name to execute
     * @param input - Input data for the phase
     * @returns Phase execution result
     */
    executePhase(phase: typeof this.SEVEN_PHASES[number], _input: any): Promise<OrchestrationPhaseResult>;
    /**
     * Execute the complete seven-phase workflow
     *
     * @param initialInput - Initial input data
     * @returns Array of phase results
     */
    executeSevenPhases(initialInput: any): Promise<OrchestrationPhaseResult[]>;
    /**
     * Phase 1: Pattern Discovery
     * Integrates with PatternDiscovery service
     */
    private executePatternDiscovery;
    /**
     * Phase 2: Prompt Generation
     * Integrates with PromptRegistry service
     */
    private executePromptGeneration;
    /**
     * Phase 3: Autonomous Analysis
     * Delegates to autonomous agents for analysis
     */
    private executeAutonomousAnalysis;
    /**
     * Phase 4: Challenger Validation
     * Runs challenger agents to validate analyses
     */
    private executeChallengerValidation;
    /**
     * Phase 5: Consensus Building
     * Computes consensus across all analyses and validations
     */
    private executeConsensusBuilding;
    /**
     * Phase 6: Reflexion Learning
     * Integrates with Reflexions service for learning
     */
    private executeReflexionLearning;
    /**
     * Phase 7: Notification Dispatch
     * Integrates with NotificationService to send results
     */
    private executeNotificationDispatch;
    /**
     * Get the current orchestrator instance
     */
    getOrchestrator(): any;
    /**
     * Get orchestration configuration
     */
    getConfig(): OrchestrationConfig;
    /**
     * Get the seven phases
     */
    getPhases(): readonly string[];
    /**
     * Check if a phase is valid
     */
    isValidPhase(phase: string): phase is typeof this.SEVEN_PHASES[number];
}
/**
 * Factory function to create an orchestration manager instance
 *
 * @param config - Optional configuration
 * @returns AgentOrchestrationManager instance
 */
export declare function createOrchestrationManager(config?: OrchestrationConfig): AgentOrchestrationManager;
/**
 * Default export
 */
declare const _default: {
    AgentOrchestrationManager: typeof AgentOrchestrationManager;
    createOrchestrationManager: typeof createOrchestrationManager;
};
export default _default;
//# sourceMappingURL=orchestration-integration.d.ts.map