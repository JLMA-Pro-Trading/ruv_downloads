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
export function createFileEditTrigger(dbBasePath, onTrigger, threshold = 10) {
    const { createTriggerEngine } = require('./auto-invoke.js');
    return createTriggerEngine(dbBasePath, [
        {
            name: 'file-edit-handler',
            handler: async (context, event, metadata) => {
                await onTrigger(context, metadata?.file || '');
            }
        }
    ], 'development', {
        config: {
            eventThresholds: { file_edit: threshold },
            timeWindow: 60 * 60 * 1000,
            cooldownPeriod: 30 * 60 * 1000,
            criticalEvents: []
        }
    });
}
/**
 * Create a model training trigger
 */
export function createMLTrigger(dbBasePath, onDrift, onTrain) {
    const { createTriggerEngine } = require('./auto-invoke.js');
    return createTriggerEngine(dbBasePath, [
        {
            name: 'drift-handler',
            handler: async (context, event, metadata) => {
                if (event.event === 'drift_detected') {
                    await onDrift(context, metadata?.expert || '');
                }
            }
        },
        {
            name: 'train-handler',
            handler: async (context, event, metadata) => {
                if (event.event === 'model_train') {
                    await onTrain(context, metadata?.expert || '');
                }
            }
        }
    ], 'ml_training');
}
/**
 * Create a CI/CD trigger
 */
export function createCICDTrigger(dbBasePath, onFailure, onSuccess) {
    const { createTriggerEngine } = require('./auto-invoke.js');
    return createTriggerEngine(dbBasePath, [
        {
            name: 'failure-handler',
            handler: async (context, event, metadata) => {
                if (event.event.includes('failure')) {
                    await onFailure(context, metadata?.pipeline || '');
                }
            }
        },
        {
            name: 'success-handler',
            handler: async (context, event, metadata) => {
                if (event.event.includes('success')) {
                    await onSuccess(context, metadata?.pipeline || '');
                }
            }
        }
    ], 'ci_cd');
}
//# sourceMappingURL=index.js.map