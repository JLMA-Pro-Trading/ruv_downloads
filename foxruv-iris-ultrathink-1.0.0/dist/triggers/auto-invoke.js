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
import { EventTracker, EventAggregator } from './event-tracker.js';
import { CooldownManager } from './cooldown-manager.js';
import { TriggerConfigManager } from './trigger-config.js';
import * as fs from 'fs';
import * as path from 'path';
export class TriggerEngine {
    eventTracker;
    cooldownManager;
    configManager;
    aggregator;
    actions;
    verbose;
    dryRun;
    logPath;
    telemetryFn;
    constructor(options) {
        this.eventTracker = new EventTracker(options.dbBasePath);
        this.cooldownManager = new CooldownManager(options.dbBasePath);
        this.configManager = new TriggerConfigManager(path.join(options.dbBasePath, 'configs'));
        this.aggregator = new EventAggregator(this.eventTracker);
        this.actions = new Map(options.actions.map(a => [a.name, a]));
        this.verbose = options.verbose || false;
        this.dryRun = options.dryRun || false;
        this.logPath = options.logPath;
        this.telemetryFn = options.telemetryFn;
        // Save initial config
        this.configManager.saveConfig('default', options.config);
    }
    /**
     * Process an event and potentially invoke actions
     */
    async processEvent(options) {
        const startTime = Date.now();
        const { event, context, metadata, force, dryRun } = options;
        try {
            // Create event record
            const eventRecord = {
                timestamp: Date.now(),
                event,
                context,
                metadata
            };
            // Record event to history
            this.eventTracker.recordEvent(eventRecord);
            this.log(`Event recorded: ${event} (context: ${context})`);
            // Check triggers (unless forced)
            let result;
            if (force) {
                result = {
                    shouldInvoke: true,
                    reason: 'Forced invocation'
                };
            }
            else {
                const config = this.configManager.getConfig(context);
                result = this.checkTriggers(event, context, config);
            }
            this.log(`Trigger check: ${result.reason}`);
            // Handle invocation
            if (result.shouldInvoke && !dryRun && !this.dryRun) {
                await this.invokeActions(context, eventRecord, result.reason);
            }
            else if (result.shouldInvoke && (dryRun || this.dryRun)) {
                this.log('Dry run: Would invoke actions');
            }
            // Send telemetry
            if (this.telemetryFn) {
                await this.telemetryFn({
                    operation: 'process_event',
                    context,
                    event,
                    outcome: result.shouldInvoke ? 'success' : 'skipped',
                    reason: result.reason,
                    durationMs: Date.now() - startTime,
                    metadata: {
                        eventCount: result.eventCount,
                        threshold: result.threshold,
                        forced: force,
                        dryRun: dryRun || this.dryRun
                    }
                });
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`Error processing event: ${errorMessage}`);
            if (this.telemetryFn) {
                await this.telemetryFn({
                    operation: 'process_event',
                    context,
                    event,
                    outcome: 'failure',
                    reason: errorMessage,
                    durationMs: Date.now() - startTime
                });
            }
            throw error;
        }
    }
    /**
     * Check if triggers are met
     */
    checkTriggers(event, context, config) {
        const now = Date.now();
        // Check critical events
        if (config.criticalEvents.includes(event)) {
            return { shouldInvoke: true, reason: `Critical event: ${event}` };
        }
        // Check cooldown period
        const cooldownStatus = this.cooldownManager.checkCooldown(context, config.cooldownPeriod);
        if (cooldownStatus.isActive) {
            return {
                shouldInvoke: false,
                reason: `Cooldown active (${cooldownStatus.remainingMin}m remaining)`,
                cooldownRemaining: cooldownStatus.remainingMs
            };
        }
        // Get threshold
        let threshold;
        if (config.customThresholdFn) {
            const eventHistory = this.eventTracker.getContextEvents(context, config.timeWindow);
            const customThreshold = config.customThresholdFn(event, context, eventHistory);
            threshold = customThreshold ?? config.eventThresholds[event] ?? 5;
        }
        else {
            threshold = config.eventThresholds[event] ?? 5;
        }
        // Count events of this type in the time window
        const count = this.eventTracker.countEventsByType(event, context, config.timeWindow);
        if (count >= threshold) {
            return {
                shouldInvoke: true,
                reason: `Threshold met: ${count}/${threshold} ${event} events`,
                eventCount: count,
                threshold
            };
        }
        return {
            shouldInvoke: false,
            reason: `Threshold not met: ${count}/${threshold} ${event} events (need ${threshold - count} more)`,
            eventCount: count,
            threshold
        };
    }
    /**
     * Invoke all registered actions
     */
    async invokeActions(context, eventRecord, reason) {
        const startTime = Date.now();
        for (const [actionName, action] of this.actions.entries()) {
            const actionStartTime = Date.now();
            try {
                this.log(`Invoking action: ${actionName}`);
                await action.handler(context, eventRecord, eventRecord.metadata);
                const durationMs = Date.now() - actionStartTime;
                // Record successful invocation
                this.cooldownManager.recordInvocation(context, eventRecord.event, actionName, reason, 'success', durationMs);
                this.log(`Action ${actionName} completed in ${durationMs}ms`);
            }
            catch (error) {
                const durationMs = Date.now() - actionStartTime;
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Record failed invocation
                this.cooldownManager.recordInvocation(context, eventRecord.event, actionName, reason, 'failure', durationMs, errorMessage);
                this.log(`Action ${actionName} failed: ${errorMessage}`);
                // Call error handler if provided
                if (action.onError) {
                    try {
                        await action.onError(error, context, eventRecord);
                    }
                    catch (handlerError) {
                        this.log(`Error handler for ${actionName} failed: ${handlerError}`);
                    }
                }
            }
        }
    }
    /**
     * Add a new action handler
     */
    addAction(action) {
        this.actions.set(action.name, action);
    }
    /**
     * Remove an action handler
     */
    removeAction(name) {
        return this.actions.delete(name);
    }
    /**
     * Get event statistics
     */
    getStats(context, timeWindowMs) {
        const config = this.configManager.getConfig(context || 'default');
        return this.eventTracker.getStats(timeWindowMs || config.timeWindow, context);
    }
    /**
     * Get invocation history
     */
    getHistory(context, limit) {
        return this.cooldownManager.getHistory(context, undefined, limit);
    }
    /**
     * Get top events
     */
    getTopEvents(context, timeWindowMs, limit) {
        return this.aggregator.getTopEvents(context, timeWindowMs, limit);
    }
    /**
     * Detect event spikes
     */
    detectSpike(eventType, context, shortWindowMs, longWindowMs, threshold) {
        return this.aggregator.detectSpike(eventType, context, shortWindowMs, longWindowMs, threshold);
    }
    /**
     * Update configuration
     */
    updateConfig(context, config) {
        const current = this.configManager.getConfig(context);
        const updated = { ...current, ...config };
        this.configManager.saveConfig(context, updated);
    }
    /**
     * Get configuration
     */
    getConfig(context) {
        return this.configManager.getConfig(context);
    }
    /**
     * Cleanup old data
     */
    cleanup(retentionMs) {
        return {
            events: this.eventTracker.cleanupOldEvents(retentionMs),
            invocations: this.cooldownManager.cleanupHistory(retentionMs)
        };
    }
    /**
     * Export data
     */
    exportData(context) {
        return {
            events: this.eventTracker.exportToJson(),
            history: this.cooldownManager.exportHistory(),
            config: this.configManager.exportConfig(context || 'default')
        };
    }
    /**
     * Log message
     */
    log(message) {
        if (this.verbose) {
            console.log(`[TriggerEngine] ${message}`);
        }
        if (this.logPath) {
            const timestamp = new Date().toISOString();
            const logMessage = `${timestamp} ${message}\n`;
            this.ensureDir(path.dirname(this.logPath));
            fs.appendFileSync(this.logPath, logMessage);
        }
    }
    /**
     * Ensure directory exists
     */
    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}
/**
 * Create a trigger engine with default configuration
 */
export function createTriggerEngine(dbBasePath, actions, preset = 'development', options) {
    const configManager = new TriggerConfigManager(path.join(dbBasePath, 'configs'));
    const config = configManager.getConfig('default', preset);
    return new TriggerEngine({
        config,
        dbBasePath,
        actions,
        ...options
    });
}
//# sourceMappingURL=auto-invoke.js.map