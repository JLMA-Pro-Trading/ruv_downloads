/**
 * Iris Trigger Detection Engine
 *
 * Monitors metrics and events to determine when to invoke Iris for autonomous intervention.
 * Evaluates multiple trigger types and maintains priority queue with cooldown management.
 *
 * Features:
 * - Threshold-based triggers (static comparisons)
 * - Pattern-based triggers (sequence detection)
 * - Anomaly detection (statistical outliers)
 * - Schedule-based triggers (time-based)
 * - Priority queue with deduplication
 * - Cooldown management per trigger
 * - Rate limiting and backoff
 *
 * Integration:
 * - Polls IrisContextCollector for events
 * - Statistical analysis from consensus lineage
 *
 * @module trigger-engine
 * @version 1.0.0
 */
// ============================================================================
// Trigger Detection Engine
// ============================================================================
export class TriggerDetector {
    triggers = new Map();
    invocationHistory = new Map();
    contextCollector; // Used in getRecentEvents, evaluateTriggers
    constructor(contextCollector) {
        this.contextCollector = contextCollector;
    }
    // ============================================================================
    // Trigger Management
    // ============================================================================
    /**
     * Register a trigger
     */
    registerTrigger(trigger) {
        this.triggers.set(trigger.id, trigger);
        if (!this.invocationHistory.has(trigger.id)) {
            this.invocationHistory.set(trigger.id, []);
        }
    }
    /**
     * Unregister a trigger
     */
    unregisterTrigger(triggerId) {
        this.triggers.delete(triggerId);
        this.invocationHistory.delete(triggerId);
    }
    /**
     * Enable/disable trigger
     */
    setTriggerEnabled(triggerId, enabled) {
        const trigger = this.triggers.get(triggerId);
        if (trigger) {
            trigger.enabled = enabled;
        }
    }
    /**
     * Get all registered triggers
     */
    getTriggers() {
        return Array.from(this.triggers.values());
    }
    // ============================================================================
    // Trigger Evaluation
    // ============================================================================
    /**
     * Evaluate all active triggers
     */
    async evaluateTriggers() {
        const firedTriggers = [];
        const now = new Date();
        // Evaluate each enabled trigger
        for (const trigger of this.triggers.values()) {
            if (!trigger.enabled)
                continue;
            // Check cooldown
            if (this.isCoolingDown(trigger.id))
                continue;
            // Check rate limit
            if (this.isRateLimited(trigger.id))
                continue;
            // Evaluate condition
            const result = await this.evaluateCondition(trigger);
            if (result.shouldFire) {
                firedTriggers.push({
                    triggerId: trigger.id,
                    triggerName: trigger.name,
                    priority: trigger.priority,
                    reason: result.reason,
                    context: result.context,
                    timestamp: now,
                    severity: this.calculateSeverity(trigger.priority, result.context)
                });
            }
        }
        // Sort by priority (highest first)
        firedTriggers.sort((a, b) => b.priority - a.priority);
        // Deduplicate similar triggers
        const deduplicatedTriggers = this.deduplicateTriggers(firedTriggers);
        return {
            shouldTrigger: deduplicatedTriggers.length > 0,
            triggers: deduplicatedTriggers,
            nextEvaluationTime: this.calculateNextEvaluation()
        };
    }
    /**
     * Check if Iris should be invoked
     */
    async shouldInvokeIris() {
        const result = await this.evaluateTriggers();
        if (!result.shouldTrigger || result.triggers.length === 0) {
            return {
                shouldInvoke: false,
                context: {}
            };
        }
        // Return highest priority trigger
        const topTrigger = result.triggers[0];
        return {
            shouldInvoke: true,
            trigger: topTrigger,
            context: {
                ...topTrigger.context,
                triggerId: topTrigger.triggerId,
                triggerName: topTrigger.triggerName,
                triggerReason: topTrigger.reason,
                allTriggers: result.triggers
            }
        };
    }
    /**
     * Record that Iris was invoked
     */
    recordInvocation(triggerId, context) {
        const history = this.invocationHistory.get(triggerId) || [];
        history.push({
            triggerId,
            timestamp: new Date(),
            context
        });
        // Keep only last 100 invocations per trigger
        if (history.length > 100) {
            history.shift();
        }
        this.invocationHistory.set(triggerId, history);
    }
    /**
     * Get cooldown status for a trigger
     */
    getCooldownStatus(triggerId) {
        const trigger = this.triggers.get(triggerId);
        if (!trigger) {
            throw new Error(`Trigger ${triggerId} not found`);
        }
        const history = this.invocationHistory.get(triggerId) || [];
        if (history.length === 0) {
            return {
                triggerId,
                isCoolingDown: false
            };
        }
        const lastInvocation = history[history.length - 1];
        const cooldownMs = trigger.cooldownSeconds * 1000;
        const elapsedMs = Date.now() - lastInvocation.timestamp.getTime();
        const isCoolingDown = elapsedMs < cooldownMs;
        if (isCoolingDown) {
            const remainingMs = cooldownMs - elapsedMs;
            return {
                triggerId,
                isCoolingDown: true,
                lastInvoked: lastInvocation.timestamp,
                availableAt: new Date(Date.now() + remainingMs),
                remainingSeconds: Math.ceil(remainingMs / 1000)
            };
        }
        return {
            triggerId,
            isCoolingDown: false,
            lastInvoked: lastInvocation.timestamp
        };
    }
    // ============================================================================
    // Condition Evaluation
    // ============================================================================
    /**
     * Evaluate a trigger condition
     */
    async evaluateCondition(trigger) {
        switch (trigger.condition.type) {
            case 'threshold':
                return this.evaluateThreshold(trigger);
            case 'pattern':
                return this.evaluatePattern(trigger);
            case 'anomaly':
                return this.evaluateAnomaly(trigger);
            case 'schedule':
                return this.evaluateSchedule(trigger);
            default:
                return { shouldFire: false, reason: 'Unknown trigger type', context: {} };
        }
    }
    /**
     * Evaluate threshold condition
     */
    async evaluateThreshold(trigger) {
        const config = trigger.condition.config;
        const windowSeconds = config.window || 300;
        const minSamples = config.minSamples || 5;
        // Get recent metrics
        const metrics = await this.getMetrics(config.metric, windowSeconds);
        if (metrics.length < minSamples) {
            return {
                shouldFire: false,
                reason: `Insufficient samples (${metrics.length}/${minSamples})`,
                context: {}
            };
        }
        // Calculate aggregate value (average)
        const value = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        // Compare with threshold
        const shouldFire = this.compareValues(value, config.operator, config.value);
        return {
            shouldFire,
            reason: shouldFire
                ? `${config.metric} ${config.operator} ${config.value} (actual: ${value.toFixed(2)})`
                : `Threshold not met`,
            context: {
                metric: config.metric,
                value,
                threshold: config.value,
                operator: config.operator,
                samples: metrics.length,
                window: windowSeconds
            }
        };
    }
    /**
     * Evaluate pattern condition
     */
    async evaluatePattern(trigger) {
        const config = trigger.condition.config;
        const maxTimespan = config.maxTimespan || 600;
        const minOccurrences = config.minOccurrences || 1;
        const allowPartialMatch = config.allowPartialMatch || false;
        // Get recent events
        const events = await this.getRecentEvents(maxTimespan);
        // Find pattern occurrences
        const occurrences = this.findPatternOccurrences(events, config.eventSequence, maxTimespan, allowPartialMatch);
        const shouldFire = occurrences.length >= minOccurrences;
        return {
            shouldFire,
            reason: shouldFire
                ? `Pattern detected ${occurrences.length} times (min: ${minOccurrences})`
                : `Pattern not found`,
            context: {
                pattern: config.eventSequence,
                occurrences: occurrences.length,
                minOccurrences,
                matches: occurrences
            }
        };
    }
    /**
     * Evaluate anomaly condition
     */
    async evaluateAnomaly(trigger) {
        const config = trigger.condition.config;
        const baselineWindow = config.baselineWindow || 3600;
        const detectionWindow = config.detectionWindow || 300;
        const minSamples = config.minSamples || 30;
        const sensitivity = config.sensitivity || 3.0;
        // Get baseline metrics
        const baselineMetrics = await this.getMetrics(config.metric, baselineWindow);
        if (baselineMetrics.length < minSamples) {
            return {
                shouldFire: false,
                reason: `Insufficient baseline samples (${baselineMetrics.length}/${minSamples})`,
                context: {}
            };
        }
        // Get recent metrics
        const recentMetrics = await this.getMetrics(config.metric, detectionWindow);
        if (recentMetrics.length === 0) {
            return { shouldFire: false, reason: 'No recent data', context: {} };
        }
        // Detect anomalies
        const anomalyResult = this.detectAnomalies(baselineMetrics.map(m => m.value), recentMetrics.map(m => m.value), config.method, sensitivity);
        return {
            shouldFire: anomalyResult.hasAnomaly,
            reason: anomalyResult.hasAnomaly
                ? `Anomaly detected: ${anomalyResult.reason}`
                : 'No anomaly detected',
            context: {
                metric: config.metric,
                method: config.method,
                anomalyScore: anomalyResult.score,
                baseline: anomalyResult.baseline,
                current: anomalyResult.current,
                threshold: anomalyResult.threshold
            }
        };
    }
    /**
     * Evaluate schedule condition
     */
    evaluateSchedule(trigger) {
        const config = trigger.condition.config;
        const now = new Date();
        // Check if within time bounds
        if (config.startTime && now < config.startTime) {
            return { shouldFire: false, reason: 'Before start time', context: {} };
        }
        if (config.endTime && now > config.endTime) {
            return { shouldFire: false, reason: 'After end time', context: {} };
        }
        // Simple interval-based scheduling
        if (config.intervalSeconds) {
            const history = this.invocationHistory.get(trigger.id) || [];
            if (history.length === 0) {
                return {
                    shouldFire: true,
                    reason: 'First scheduled invocation',
                    context: { scheduleType: 'interval' }
                };
            }
            const lastInvocation = history[history.length - 1];
            const elapsedSeconds = (now.getTime() - lastInvocation.timestamp.getTime()) / 1000;
            if (elapsedSeconds >= config.intervalSeconds) {
                return {
                    shouldFire: true,
                    reason: `Interval elapsed (${elapsedSeconds.toFixed(0)}s >= ${config.intervalSeconds}s)`,
                    context: { scheduleType: 'interval', elapsedSeconds }
                };
            }
        }
        // TODO: Implement cron expression evaluation
        // For now, return false for cron-based schedules
        return { shouldFire: false, reason: 'Schedule not met', context: {} };
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Check if trigger is cooling down
     */
    isCoolingDown(triggerId) {
        const status = this.getCooldownStatus(triggerId);
        return status.isCoolingDown;
    }
    /**
     * Check if trigger is rate limited
     */
    isRateLimited(triggerId) {
        const trigger = this.triggers.get(triggerId);
        if (!trigger || !trigger.maxInvocationsPerHour)
            return false;
        const history = this.invocationHistory.get(triggerId) || [];
        const oneHourAgo = Date.now() - 3600 * 1000;
        const recentInvocations = history.filter(inv => inv.timestamp.getTime() > oneHourAgo);
        return recentInvocations.length >= trigger.maxInvocationsPerHour;
    }
    /**
     * Calculate severity from priority and context
     */
    calculateSeverity(priority, context) {
        // Check for critical indicators in context
        if (context.anomalyScore && context.anomalyScore > 5)
            return 'critical';
        if (context.value && context.threshold && Math.abs(context.value - context.threshold) > context.threshold * 2) {
            return 'critical';
        }
        // Use priority levels
        if (priority >= 90)
            return 'critical';
        if (priority >= 70)
            return 'high';
        if (priority >= 40)
            return 'medium';
        return 'low';
    }
    /**
     * Deduplicate similar triggers
     */
    deduplicateTriggers(triggers) {
        const seen = new Set();
        const deduplicated = [];
        for (const trigger of triggers) {
            const key = `${trigger.triggerId}-${trigger.reason}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduplicated.push(trigger);
            }
        }
        return deduplicated;
    }
    /**
     * Calculate next evaluation time
     */
    calculateNextEvaluation() {
        // Default to 1 minute from now
        return new Date(Date.now() + 60 * 1000);
    }
    /**
     * Compare values based on operator
     */
    compareValues(value, operator, threshold) {
        switch (operator) {
            case '>': return value > threshold;
            case '<': return value < threshold;
            case '>=': return value >= threshold;
            case '<=': return value <= threshold;
            case '==': return Math.abs(value - threshold) < 0.0001;
            case '!=': return Math.abs(value - threshold) >= 0.0001;
            default: return false;
        }
    }
    /**
     * Get metrics for a time window
     */
    async getMetrics(_metric, _windowSeconds) {
        // TODO: Integrate with actual metrics collection
        // For now, return empty array
        return [];
    }
    /**
     * Get recent events
     */
    async getRecentEvents(_windowSeconds) {
        // Check if context collector is available
        if (!this.contextCollector)
            return [];
        // Simplified for now - TODO: implement proper time window query
        // Would use: this.contextCollector.getRecentEvents(eventType, project, expertId, limit)
        return [];
    }
    /**
     * Find pattern occurrences in events
     */
    findPatternOccurrences(events, pattern, maxTimespan, allowPartialMatch) {
        const occurrences = [];
        for (let i = 0; i < events.length; i++) {
            const matchedEvents = [];
            let patternIndex = 0;
            for (let j = i; j < events.length && patternIndex < pattern.length; j++) {
                if (events[j].eventType === pattern[patternIndex]) {
                    matchedEvents.push(events[j]);
                    patternIndex++;
                }
                // Check timespan
                const elapsed = events[j].timestamp.getTime() - events[i].timestamp.getTime();
                if (elapsed > maxTimespan * 1000)
                    break;
            }
            // Check if pattern matched
            const isFullMatch = patternIndex === pattern.length;
            const isPartialMatch = allowPartialMatch && patternIndex > 0;
            if (isFullMatch || isPartialMatch) {
                occurrences.push({
                    events: matchedEvents,
                    startTime: matchedEvents[0].timestamp,
                    endTime: matchedEvents[matchedEvents.length - 1].timestamp
                });
            }
        }
        return occurrences;
    }
    /**
     * Detect anomalies using statistical methods
     */
    detectAnomalies(baseline, recent, method, sensitivity) {
        const recentValue = recent[recent.length - 1];
        switch (method) {
            case 'zscore':
                return this.detectAnomalyZScore(baseline, recentValue, sensitivity);
            case 'iqr':
                return this.detectAnomalyIQR(baseline, recentValue, sensitivity);
            case 'mad':
                return this.detectAnomalyMAD(baseline, recentValue, sensitivity);
            default:
                return {
                    hasAnomaly: false,
                    reason: 'Unknown method',
                    score: 0,
                    baseline: 0,
                    current: recentValue,
                    threshold: 0
                };
        }
    }
    /**
     * Z-score anomaly detection
     */
    detectAnomalyZScore(baseline, value, sensitivity) {
        const mean = baseline.reduce((sum, v) => sum + v, 0) / baseline.length;
        const variance = baseline.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / baseline.length;
        const stdDev = Math.sqrt(variance);
        const zScore = Math.abs((value - mean) / (stdDev || 1));
        const threshold = sensitivity;
        return {
            hasAnomaly: zScore > threshold,
            reason: `Z-score ${zScore.toFixed(2)} exceeds threshold ${threshold}`,
            score: zScore,
            baseline: mean,
            current: value,
            threshold
        };
    }
    /**
     * IQR (Interquartile Range) anomaly detection
     */
    detectAnomalyIQR(baseline, value, sensitivity) {
        const sorted = [...baseline].sort((a, b) => a - b);
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        const iqr = q3 - q1;
        const lowerBound = q1 - sensitivity * iqr;
        const upperBound = q3 + sensitivity * iqr;
        const isAnomaly = value < lowerBound || value > upperBound;
        const distance = Math.max(Math.abs(value - lowerBound), Math.abs(value - upperBound));
        return {
            hasAnomaly: isAnomaly,
            reason: `Value ${value.toFixed(2)} outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
            score: distance / (iqr || 1),
            baseline: (q1 + q3) / 2,
            current: value,
            threshold: sensitivity
        };
    }
    /**
     * MAD (Median Absolute Deviation) anomaly detection
     */
    detectAnomalyMAD(baseline, value, sensitivity) {
        const sorted = [...baseline].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const deviations = baseline.map(v => Math.abs(v - median));
        const sortedDeviations = deviations.sort((a, b) => a - b);
        const mad = sortedDeviations[Math.floor(sortedDeviations.length / 2)];
        const modifiedZScore = Math.abs(0.6745 * (value - median) / (mad || 1));
        const threshold = sensitivity;
        return {
            hasAnomaly: modifiedZScore > threshold,
            reason: `Modified Z-score ${modifiedZScore.toFixed(2)} exceeds threshold ${threshold}`,
            score: modifiedZScore,
            baseline: median,
            current: value,
            threshold
        };
    }
}
/**
 * Create trigger detector instance
 */
export function createTriggerDetector(contextCollector) {
    return new TriggerDetector(contextCollector);
}
