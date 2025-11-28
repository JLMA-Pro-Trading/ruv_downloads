/**
 * Ultrathink Trigger System
 *
 * Generic event-based trigger system for automated operations.
 * Extracted from IRIS auto-invocation system.
 *
 * @example
 * ```typescript
 * import { createTriggerEngine, DEFAULT_CONFIGS } from '@foxruv/iris-ultrathink/triggers'
 *
 * // Create engine with actions
 * const engine = createTriggerEngine(
 *   './data/triggers',
 *   [
 *     {
 *       name: 'evaluate-project',
 *       handler: async (context, event, metadata) => {
 *         console.log(`Evaluating project ${context}`)
 *         // Run evaluation...
 *       }
 *     }
 *   ],
 *   'development'
 * )
 *
 * // Process events
 * await engine.processEvent({
 *   event: 'file_edit',
 *   context: 'my-project',
 *   metadata: { file: 'src/index.ts' }
 * })
 *
 * // Check stats
 * const stats = engine.getStats('my-project')
 * console.log(`Total events: ${stats.totalEvents}`)
 * ```
 */
export type { EventRecord, TriggerConfig, TriggerResult, TriggerAction, TriggerEngineOptions, ProcessEventOptions, CooldownStatus, EventStats, InvocationRecord, TelemetryData, CategorizedEventRecord } from './types.js';
export { DEFAULT_CONFIGS, EventCategory, EventSeverity } from './types.js';
export { TriggerEngine, createTriggerEngine } from './auto-invoke.js';
export { EventTracker, EventAggregator } from './event-tracker.js';
export { CooldownManager, AdaptiveCooldownManager } from './cooldown-manager.js';
export { TriggerConfigManager, mergeConfigs } from './trigger-config.js';
/**
 * Utility functions
 */
/**
 * Create a simple file edit trigger
 */
export declare function createFileEditTrigger(dbBasePath: string, onTrigger: (project: string, file: string) => Promise<void>, threshold?: number): any;
/**
 * Create a model training trigger
 */
export declare function createMLTrigger(dbBasePath: string, onDrift: (project: string, expert: string) => Promise<void>, onTrain: (project: string, expert: string) => Promise<void>): any;
/**
 * Create a CI/CD trigger
 */
export declare function createCICDTrigger(dbBasePath: string, onFailure: (project: string, pipeline: string) => Promise<void>, onSuccess: (project: string, pipeline: string) => Promise<void>): any;
//# sourceMappingURL=index.d.ts.map