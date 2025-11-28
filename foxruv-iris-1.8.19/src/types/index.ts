/**
 * Shared Types for Agent Learning Core
 *
 * Re-exports all types from different modules for convenience
 */

// Python Optimizer Client Types
export type {
  SignatureField,
  SignatureDefinition,
  TrainingExample,
  OptimizationConfig,
  LMConfig,
  OptimizationRequest,
  OptimizationResult
} from '../clients/python-optimizer-client.js'

// AgentDB Storage Types
export type {
  StoredOptimization,
  OptimizationHistory
} from '../storage/agentdb-optimizer-storage.js'

// LM Provider Types
export type {
  ModelProvider,
  LMProviderConfig,
  PerformanceMetrics
} from '../providers/lm-provider.js'

// Qwen3 Provider Types
export type {
  Signature
} from '../providers/qwen3-provider.js'

// Dataset Core Types
export type {
  TemporalExample,
  DatasetSplit,
  SplitStrategy,
  TemporalSplitConfig
} from '../training/dataset-core.js'
