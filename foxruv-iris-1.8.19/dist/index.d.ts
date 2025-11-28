/**
 * @foxruv/iris
 *
 * Cross-project self-improving agent engine with federated learning
 *
 * Core Infrastructure:
 * - Python DSPy optimizer client
 * - AgentDB persistence with vector search
 * - LLM provider abstractions
 * - Time-aware dataset splitting
 * - Parallel swarm coordination
 *
 * Federated Learning:
 * - Cross-project pattern discovery
 * - Reflexion drift monitoring
 * - Global telemetry & drift detection
 * - Consensus lineage tracking
 * - Prompt registry & versioning
 *
 * @author FoxRuv
 * @license MIT
 * @version 1.0.0
 */
export { PythonOptimizerClient, createOptimizerClient, isOptimizerAvailable } from './clients/python-optimizer-client.js';
export type { SignatureField, SignatureDefinition, TrainingExample, OptimizationConfig, LMConfig, OptimizationRequest, OptimizationResult } from './clients/python-optimizer-client.js';
export { SwarmCoordinator, createSwarmCoordinator, trainExpertsParallel } from './clients/swarm-coordinator.js';
export type { ExpertTrainingTask, SwarmConfig, TrainingResult, SwarmStats } from './clients/swarm-coordinator.js';
export { AgentDBOptimizerStorage, createOptimizerStorage, storeOptimization, loadOptimization } from './storage/agentdb-optimizer-storage.js';
export type { StoredOptimization, OptimizationHistory } from './storage/agentdb-optimizer-storage.js';
export { ReasoningBankManager, createReasoningBank } from './storage/reasoning-bank.js';
export type { LearningTrajectory, TrajectoryPattern, LearningInsights } from './storage/reasoning-bank.js';
export { AgentDBManager, createAgentDB } from './storage/agentdb-integration.js';
export type { ExpertEmbedding, CausalDecision, ReflexionEntry, LearnedSkill, AgentDBConfig } from './storage/agentdb-integration.js';
export { trainExpertsInParallel, calculateSwarmStats, retryFailedTasks, shardTrainingData, aggregateMetrics, loadBalanceTasks, faultTolerantTrain, TrainingMonitor } from './utils/swarm-utils.js';
export type { TrainingTask, TrainingResult as SwarmTrainingResult, SwarmConfig as SwarmUtilsConfig, SwarmStats as SwarmUtilsStats } from './utils/swarm-utils.js';
export { withTelemetry, createTelemetryWrapper, wrapWithTelemetry } from './utils/with-telemetry.js';
export type { TelemetryOptions } from './utils/with-telemetry.js';
export { TelemetryEmitter } from './telemetry/telemetry-emitter.js';
export type { TelemetryEmitterConfig } from './telemetry/telemetry-emitter.js';
export { logTelemetry, getExpertStats, detectDrift } from './supabase/telemetry.js';
export type { TelemetryData } from './supabase/telemetry.js';
export { LMProviderManager, getLMProvider, resetLMProvider } from './providers/lm-provider.js';
export type { ModelProvider, LMProviderConfig, PerformanceMetrics } from './providers/lm-provider.js';
export { ClaudeProvider } from './providers/claude-provider.js';
export { Qwen3Provider } from './providers/qwen3-provider.js';
export type { Signature } from './providers/qwen3-provider.js';
export { DatasetBuilder, balanceByOutcome, balanceByCategory, exportToJSONL, exportSplitToJSONL } from './training/dataset-core.js';
export type { TemporalExample, DatasetSplit, SplitStrategy, TemporalSplitConfig } from './training/dataset-core.js';
export { ReflexionMonitor, createReflexionMonitor } from './reflexion/reflexion-monitor.js';
export type { TrackedReflexion, DriftDetection, ReflexionComparison, ReflexionAdvisory, ReflexionMonitorConfig } from './reflexion/reflexion-monitor.js';
export { GlobalMetricsCollector, createGlobalMetrics } from './telemetry/global-metrics.js';
export type { TelemetryEvent, ExpertMetrics, DriftAlert, CrossProjectMetrics, GlobalMetricsConfig } from './telemetry/global-metrics.js';
export { ConsensusLineageTracker, createConsensusLineageTracker } from './consensus/lineage-tracker.js';
export type { ExpertParticipation, ConsensusDecision, VersionLineage, ConsensusPattern, VersionImpact, RotationRecommendation, LineageTrackerConfig } from './consensus/lineage-tracker.js';
export { PromptRegistry, createPromptRegistry } from './patterns/prompt-registry.js';
export type { ExpertSignature, SignatureComparison, BestSignature, PromptEvolution, PromptRegistryConfig } from './patterns/prompt-registry.js';
export { PatternDiscovery, createPatternDiscovery } from './patterns/pattern-discovery.js';
export type { LearnedPattern, PatternMatch, TransferRecommendation, PatternEvolution as PatternEvolutionHistory, PatternDiscoveryConfig } from './patterns/pattern-discovery.js';
export { PromptBreederEngine, createPromptBreeder } from './evolution/prompt-breeder.js';
export type { PromptIndividual, FitnessEvaluation, Generation, MutationStrategy, CrossoverStrategy, FitnessFunction, PromptBreederConfig } from './evolution/prompt-breeder.js';
export { IrisPrime, createIrisPrime, irisPrime } from './orchestrators/iris-prime.js';
export type { IrisReport, CrossProjectReport, ProjectConfig, IrisPrimeConfig } from './orchestrators/iris-prime.js';
export { ScheduledIrisRunner } from './orchestrators/run-iris-scheduled.js';
export * from './notifications/index.js';
export * from './supabase/index.js';
export * from './config/validator.js';
export * from './cli/index.js';
export { SmartExecutionEngine, getExecutionEngine, executeWithDefaults } from './cli/execution-engine.js';
export type { ExecutionConfig, ExecutionContext, ExecutionResult } from './cli/execution-engine.js';
export * from './migration/agentdb-to-supabase.js';
export * from './types/index.js';
//# sourceMappingURL=index.d.ts.map