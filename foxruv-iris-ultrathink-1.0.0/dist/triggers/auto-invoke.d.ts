/**
 * Auto-Invoke Trigger Engine
 *
 * Generic event-based trigger system for automated operations.
 * Supports threshold-based triggers, cooldowns, critical events, and custom actions.
 *
 * Key Features:
 * - Fast decision-making (<100ms)
 * - Configurable thresholds per event type
 * - Cooldown periods to prevent spam
 * - Critical events that bypass all checks
 * - Event history tracking
 * - Multiple action handlers
 * - Telemetry integration
 * - Dry-run mode
 */
import type { TriggerConfig, TriggerResult, ProcessEventOptions, TriggerEngineOptions, TriggerAction } from './types.js';
export declare class TriggerEngine {
    private eventTracker;
    private cooldownManager;
    private configManager;
    private aggregator;
    private actions;
    private verbose;
    private dryRun;
    private logPath?;
    private telemetryFn?;
    constructor(options: TriggerEngineOptions);
    /**
     * Process an event and potentially invoke actions
     */
    processEvent(options: ProcessEventOptions): Promise<TriggerResult>;
    /**
     * Check if triggers are met
     */
    checkTriggers(event: string, context: string, config: TriggerConfig): TriggerResult;
    /**
     * Invoke all registered actions
     */
    private invokeActions;
    /**
     * Add a new action handler
     */
    addAction(action: TriggerAction): void;
    /**
     * Remove an action handler
     */
    removeAction(name: string): boolean;
    /**
     * Get event statistics
     */
    getStats(context?: string, timeWindowMs?: number): import("./types.js").EventStats;
    /**
     * Get invocation history
     */
    getHistory(context?: string, limit?: number): import("./types.js").InvocationRecord[];
    /**
     * Get top events
     */
    getTopEvents(context: string, timeWindowMs: number, limit?: number): {
        event: string;
        count: number;
    }[];
    /**
     * Detect event spikes
     */
    detectSpike(eventType: string, context: string, shortWindowMs: number, longWindowMs: number, threshold?: number): boolean;
    /**
     * Update configuration
     */
    updateConfig(context: string, config: Partial<TriggerConfig>): void;
    /**
     * Get configuration
     */
    getConfig(context: string): TriggerConfig;
    /**
     * Cleanup old data
     */
    cleanup(retentionMs: number): {
        events: number;
        invocations: number;
    };
    /**
     * Export data
     */
    exportData(context?: string): {
        events: string;
        history: string;
        config: string;
    };
    /**
     * Log message
     */
    private log;
    /**
     * Ensure directory exists
     */
    private ensureDir;
}
/**
 * Create a trigger engine with default configuration
 */
export declare function createTriggerEngine(dbBasePath: string, actions: TriggerAction[], preset?: 'development' | 'production' | 'ml_training' | 'ci_cd', options?: Partial<TriggerEngineOptions>): TriggerEngine;
//# sourceMappingURL=auto-invoke.d.ts.map