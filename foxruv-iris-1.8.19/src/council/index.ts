/**
 * FoxRuv Prime AI Council
 *
 * 6-Agent federated learning control plane for cross-project meta-decisions
 *
 * Architecture:
 * - Tier 1: PatternMaster, PromptScientist, PerformanceJudge (vote weight 2.0)
 * - Tier 2: TransferTester, SafetyValidator (vote weight 1.5)
 * - Tier 3: ConsensusOrchestrator (ReConcile algorithm)
 *
 * Decision Types:
 * - Pattern Transfer: Cross-project pattern deployment
 * - Prompt Upgrade: PromptBreeder evolved prompts
 * - Expert Rotation: Performance-based expert management
 *
 * @module council
 * @version 1.0.0
 */

// Main orchestrator
export {
  AICouncil,
  createAICouncil
} from './AICouncil.js'

// All agents
export * from './agents/index.js'

// Types
export * from './types/index.js'
