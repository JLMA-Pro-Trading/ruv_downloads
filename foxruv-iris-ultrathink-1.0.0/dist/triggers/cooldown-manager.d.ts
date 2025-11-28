/**
 * Cooldown Manager
 *
 * Manages cooldown periods between invocations to prevent spam.
 * Tracks last invocation timestamps per context and action.
 */
import type { CooldownStatus, InvocationRecord } from './types.js';
export declare class CooldownManager {
    private readonly dbBasePath;
    private invocationPath;
    private historyPath;
    private cache;
    constructor(dbBasePath: string);
    /**
     * Check if cooldown is active
     */
    checkCooldown(context: string, cooldownPeriodMs: number, actionName?: string): CooldownStatus;
    /**
     * Record an invocation
     */
    recordInvocation(context: string, event: string, actionName: string, reason: string, outcome: 'success' | 'failure', durationMs: number, error?: string): void;
    /**
     * Get last invocation timestamp
     */
    getLastInvocation(context: string, actionName?: string): number | null;
    /**
     * Get invocation history
     */
    getHistory(context?: string, actionName?: string, limit?: number): InvocationRecord[];
    /**
     * Get invocation count
     */
    getInvocationCount(context: string, timeWindowMs: number, actionName?: string): number;
    /**
     * Get success rate
     */
    getSuccessRate(context: string, timeWindowMs: number, actionName?: string): number;
    /**
     * Get average duration
     */
    getAverageDuration(context: string, timeWindowMs: number, actionName?: string): number;
    /**
     * Clear cooldown for a context
     */
    clearCooldown(context: string, actionName?: string): void;
    /**
     * Clear all cooldowns
     */
    clearAll(): void;
    /**
     * Cleanup old history
     */
    cleanupHistory(retentionMs: number): number;
    /**
     * Export history to JSON
     */
    exportHistory(): string;
    /**
     * Get cache key
     */
    private getKey;
    /**
     * Load cache from file
     */
    private loadCache;
    /**
     * Persist cache to file
     */
    private persistCache;
    /**
     * Ensure directory exists
     */
    private ensureDir;
}
/**
 * Adaptive cooldown manager that adjusts based on success rate
 */
export declare class AdaptiveCooldownManager extends CooldownManager {
    /**
     * Get adaptive cooldown period based on recent success
     */
    getAdaptiveCooldown(context: string, baseCooldownMs: number, actionName?: string): number;
    /**
     * Check adaptive cooldown
     */
    checkAdaptiveCooldown(context: string, baseCooldownMs: number, actionName?: string): CooldownStatus;
}
//# sourceMappingURL=cooldown-manager.d.ts.map