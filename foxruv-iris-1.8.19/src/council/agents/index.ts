/**
 * FoxRuv Prime AI Council Agents
 *
 * 6-Agent federated learning control plane
 *
 * @module council/agents
 * @version 1.0.0
 */

// Tier 1: Core Decision Makers
export {
  PatternMaster,
  createPatternMaster,
  type PatternMasterConfig
} from './PatternMaster.js'

export {
  PromptScientist,
  createPromptScientist,
  type PromptScientistConfig
} from './PromptScientist.js'

export {
  PerformanceJudge,
  createPerformanceJudge,
  type PerformanceJudgeConfig
} from './PerformanceJudge.js'

// Tier 2: Validators
export {
  TransferTester,
  createTransferTester,
  type TransferTesterConfig
} from './TransferTester.js'

export {
  SafetyValidator,
  createSafetyValidator,
  type SafetyValidatorConfig
} from './SafetyValidator.js'

// Tier 3: Consensus
export {
  ConsensusOrchestrator,
  createConsensusOrchestrator,
  type ConsensusOrchestratorConfig
} from './ConsensusOrchestrator.js'
