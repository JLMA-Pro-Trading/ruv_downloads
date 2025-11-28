/**
 * FoxRuv Prime AI Council - Type Definitions
 *
 * Types for the 6-agent federated learning control plane
 *
 * @module council/types
 * @version 1.0.0
 */

// ============================================================================
// Core Decision Types
// ============================================================================

/**
 * Types of decisions the council can make
 */
export type DecisionType = 'pattern_transfer' | 'prompt_upgrade' | 'expert_rotation'

/**
 * Vote decision options
 */
export type VoteDecision = 'APPROVE' | 'REJECT' | 'NEUTRAL' | 'CONDITIONAL'

/**
 * Alert severity levels
 */
export type SeverityLevel = 'info' | 'warning' | 'critical'

// ============================================================================
// Agent Vote & Evidence
// ============================================================================

/**
 * Vote from a council agent
 */
export interface AgentVote {
  agent: string
  decision: VoteDecision
  confidence: number // 0-1
  weight: number // Agent voting weight
  evidence: Record<string, any>
  reasoning: string[]
  timestamp: Date
}

/**
 * Consensus result from voting
 */
export interface ConsensusResult {
  consensusReached: boolean
  decision: VoteDecision
  confidence: number // Weighted average
  votes: AgentVote[]
  iterations: number
  breakdown: {
    approveCount: number
    rejectCount: number
    neutralCount: number
    conditionalCount: number
  }
}

// ============================================================================
// Pattern Transfer
// ============================================================================

/**
 * A discovered pattern that could be transferred
 */
export interface DiscoveredPattern {
  id: string
  name: string
  description: string
  sourceProject: string
  sourceExpert: string
  pattern: {
    type: string // 'confidence_calibration', 'reasoning_chain', etc.
    implementation: string
    config: Record<string, any>
  }
  successRate: number
  sampleSize: number
  domains: string[]
  embedding?: number[]
}

/**
 * Pattern transfer decision
 */
export interface PatternTransferDecision {
  type: 'pattern_transfer'
  pattern: DiscoveredPattern
  targetProjects: string[]
  rollout: {
    strategy: 'gradual' | 'immediate' | 'canary'
    percentage: number // Initial rollout percentage
    duration: string // e.g., '24h', '7d'
  }
  monitoring: {
    checkInterval: string
    successMetric: string
    rollbackTrigger: string
  }
  consensus: ConsensusResult
  timestamp: Date
}

// ============================================================================
// Prompt Evolution
// ============================================================================

/**
 * Evolved prompt version
 */
export interface EvolvedPrompt {
  id: string
  expertType: string
  version: string
  previousVersion: string
  template: string
  mutations: Array<{
    type: 'wording' | 'structure' | 'examples' | 'crossover'
    description: string
  }>
  fitnessTests: Array<{
    project: string
    improvement: number
    sampleSize: number
  }>
  avgImprovement: number
}

/**
 * Prompt upgrade decision
 */
export interface PromptUpgradeDecision {
  type: 'prompt_upgrade'
  prompt: EvolvedPrompt
  targetExperts: Array<{
    project: string
    expertId: string
    expertType: string
  }>
  rollout: {
    strategy: 'gradual' | 'immediate' | 'ab_test'
    percentage: number
    duration: string
  }
  safetyGuards: {
    rollbackCondition: string
    monitoringDuration: string
    requiredConfidence: number
  }
  consensus: ConsensusResult
  timestamp: Date
}

// ============================================================================
// Expert Rotation
// ============================================================================

/**
 * Expert performance in league
 */
export interface ExpertLeagueEntry {
  expertId: string
  project: string
  expertType: string
  accuracy: number
  confidence: number
  latency: number
  rank: number
  trend: 'improving' | 'stable' | 'declining'
  driftSeverity?: SeverityLevel
}

/**
 * Expert rotation decision
 */
export interface ExpertRotationDecision {
  type: 'expert_rotation'
  action: 'promote' | 'demote' | 'retrain' | 'transfer_knowledge'
  sourceExpert: ExpertLeagueEntry
  targetExpert?: ExpertLeagueEntry
  league: ExpertLeagueEntry[]
  strategy: {
    type: 'knowledge_transfer' | 'prompt_adaptation' | 'retraining'
    steps: string[]
  }
  monitoringPlan: {
    duration: string
    metrics: string[]
    successCriteria: Record<string, number>
  }
  consensus: ConsensusResult
  timestamp: Date
}

// ============================================================================
// Council Decision (Union Type)
// ============================================================================

/**
 * Any decision made by the council
 */
export type CouncilDecision =
  | PatternTransferDecision
  | PromptUpgradeDecision
  | ExpertRotationDecision

// ============================================================================
// Telemetry Input
// ============================================================================

/**
 * Aggregated telemetry for council analysis
 */
export interface CouncilTelemetryInput {
  timeWindow: {
    start: Date
    end: Date
    duration: string
  }
  projects: Array<{
    project: string
    eventCount: number
    experts: Array<{
      expertId: string
      expertType: string
      version: string
      metrics: {
        accuracy: number
        confidence: number
        latency: number
        totalRuns: number
      }
      drift?: {
        detected: boolean
        severity: SeverityLevel
        metric: string
        change: number
      }
    }>
  }>
  patterns: DiscoveredPattern[]
  alerts: Array<{
    alertId: string
    project: string
    expertId: string
    severity: SeverityLevel
    message: string
  }>
}

// ============================================================================
// Agent Analysis Results
// ============================================================================

/**
 * Pattern analysis from PatternMaster
 */
export interface PatternAnalysis {
  agent: 'PatternMaster'
  patternsFound: DiscoveredPattern[]
  transferCandidates: Array<{
    pattern: DiscoveredPattern
    targetProjects: string[]
    transferConfidence: number
    reasoning: string[]
  }>
  recommendation: VoteDecision
  confidence: number
  evidence: Record<string, any>
}

/**
 * Prompt evolution analysis from PromptScientist
 */
export interface PromptAnalysis {
  agent: 'PromptScientist'
  evolvedPrompts: EvolvedPrompt[]
  deploymentCandidates: Array<{
    prompt: EvolvedPrompt
    targetExperts: string[]
    expectedImprovement: number
    reasoning: string[]
  }>
  recommendation: VoteDecision
  confidence: number
  evidence: Record<string, any>
}

/**
 * Performance analysis from PerformanceJudge
 */
export interface PerformanceAnalysis {
  agent: 'PerformanceJudge'
  leagues: Map<string, ExpertLeagueEntry[]> // expertType -> league
  driftingExperts: ExpertLeagueEntry[]
  topPerformers: ExpertLeagueEntry[]
  rotationRecommendations: Array<{
    action: 'promote' | 'demote' | 'retrain'
    expert: ExpertLeagueEntry
    reasoning: string[]
  }>
  recommendation: VoteDecision
  confidence: number
  evidence: Record<string, any>
}

/**
 * Transfer test results from TransferTester
 */
export interface TransferTestAnalysis {
  agent: 'TransferTester'
  testsCompleted: Array<{
    pattern: DiscoveredPattern
    targetProject: string
    testDuration: string
    results: {
      baselineAccuracy: number
      patternAccuracy: number
      improvement: number
      sampleSize: number
    }
    passed: boolean
  }>
  recommendation: VoteDecision
  confidence: number
  evidence: Record<string, any>
}

/**
 * Safety validation from SafetyValidator
 */
export interface SafetyAnalysis {
  agent: 'SafetyValidator'
  safetyChecks: Array<{
    check: string
    passed: boolean
    details: string
  }>
  safetyScore: number
  requiredGuardrails: string[]
  rollbackTriggers: string[]
  recommendation: VoteDecision
  confidence: number
  evidence: Record<string, any>
}

/**
 * Union type for all agent analyses
 */
export type AgentAnalysis =
  | PatternAnalysis
  | PromptAnalysis
  | PerformanceAnalysis
  | TransferTestAnalysis
  | SafetyAnalysis

// ============================================================================
// Council Configuration
// ============================================================================

/**
 * Configuration for AI Council
 */
export interface AICouncilConfig {
  // AgentDB for data queries
  agentDbPath?: string

  // Voting thresholds
  consensusThreshold?: number // Default: 0.80
  maxIterations?: number // ReConcile iterations, default: 3

  // Agent vote weights
  agentWeights?: {
    PatternMaster?: number
    PromptScientist?: number
    PerformanceJudge?: number
    TransferTester?: number
    SafetyValidator?: number
  }

  // Decision frequency
  analysisInterval?: string // e.g., '5m', '24h'

  // Rollout defaults
  defaultRolloutPercentage?: number
  defaultMonitoringDuration?: string

  // Safety defaults
  defaultRollbackThreshold?: number
}

// ============================================================================
// Council Execution Result
// ============================================================================

/**
 * Result of council meeting/decision
 */
export interface CouncilMeetingResult {
  meetingId: string
  timestamp: Date
  telemetryInput: CouncilTelemetryInput
  analyses: AgentAnalysis[]
  decisions: CouncilDecision[]
  consensusResults: ConsensusResult[]
  executionPlan: Array<{
    decision: CouncilDecision
    steps: string[]
    estimatedDuration: string
  }>
  summary: {
    totalDecisions: number
    approvedDecisions: number
    rejectedDecisions: number
    avgConfidence: number
    topRecommendations: string[]
  }
}
