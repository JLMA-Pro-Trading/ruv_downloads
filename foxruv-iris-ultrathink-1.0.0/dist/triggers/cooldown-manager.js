/**
 * Cooldown Manager
 *
 * Manages cooldown periods between invocations to prevent spam.
 * Tracks last invocation timestamps per context and action.
 */
import * as fs from 'fs';
import * as path from 'path';
export class CooldownManager {
    dbBasePath;
    invocationPath;
    historyPath;
    cache = new Map();
    constructor(dbBasePath) {
        this.dbBasePath = dbBasePath;
        this.ensureDir(dbBasePath);
        this.invocationPath = path.join(dbBasePath, 'last-invocations.json');
        this.historyPath = path.join(dbBasePath, 'invocation-history.jsonl');
        this.loadCache();
    }
    /**
     * Check if cooldown is active
     */
    checkCooldown(context, cooldownPeriodMs, actionName = 'default') {
        const key = this.getKey(context, actionName);
        const lastInvocation = this.cache.get(key) || null;
        const now = Date.now();
        if (!lastInvocation) {
            return {
                isActive: false,
                lastInvocation: null,
                remainingMs: 0,
                remainingMin: 0
            };
        }
        const elapsed = now - lastInvocation;
        const remaining = Math.max(0, cooldownPeriodMs - elapsed);
        return {
            isActive: remaining > 0,
            lastInvocation,
            remainingMs: remaining,
            remainingMin: Math.ceil(remaining / 60000)
        };
    }
    /**
     * Record an invocation
     */
    recordInvocation(context, event, actionName, reason, outcome, durationMs, error) {
        const timestamp = Date.now();
        const key = this.getKey(context, actionName);
        // Update cache and persist
        this.cache.set(key, timestamp);
        this.persistCache();
        // Record to history
        const record = {
            timestamp,
            context,
            event,
            reason,
            actionName,
            outcome,
            durationMs,
            error
        };
        fs.appendFileSync(this.historyPath, JSON.stringify(record) + '\n');
    }
    /**
     * Get last invocation timestamp
     */
    getLastInvocation(context, actionName = 'default') {
        const key = this.getKey(context, actionName);
        return this.cache.get(key) || null;
    }
    /**
     * Get invocation history
     */
    getHistory(context, actionName, limit) {
        if (!fs.existsSync(this.historyPath)) {
            return [];
        }
        const content = fs.readFileSync(this.historyPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const records = [];
        for (const line of lines) {
            try {
                const record = JSON.parse(line);
                if (context && record.context !== context)
                    continue;
                if (actionName && record.actionName !== actionName)
                    continue;
                records.push(record);
            }
            catch {
                // Skip invalid lines
            }
        }
        // Sort by timestamp descending
        records.sort((a, b) => b.timestamp - a.timestamp);
        return limit ? records.slice(0, limit) : records;
    }
    /**
     * Get invocation count
     */
    getInvocationCount(context, timeWindowMs, actionName) {
        const cutoffTime = Date.now() - timeWindowMs;
        const history = this.getHistory(context, actionName);
        return history.filter(r => r.timestamp >= cutoffTime).length;
    }
    /**
     * Get success rate
     */
    getSuccessRate(context, timeWindowMs, actionName) {
        const cutoffTime = Date.now() - timeWindowMs;
        const history = this.getHistory(context, actionName).filter(r => r.timestamp >= cutoffTime);
        if (history.length === 0)
            return 1.0;
        const successful = history.filter(r => r.outcome === 'success').length;
        return successful / history.length;
    }
    /**
     * Get average duration
     */
    getAverageDuration(context, timeWindowMs, actionName) {
        const cutoffTime = Date.now() - timeWindowMs;
        const history = this.getHistory(context, actionName).filter(r => r.timestamp >= cutoffTime);
        if (history.length === 0)
            return 0;
        const totalDuration = history.reduce((sum, r) => sum + r.durationMs, 0);
        return totalDuration / history.length;
    }
    /**
     * Clear cooldown for a context
     */
    clearCooldown(context, actionName = 'default') {
        const key = this.getKey(context, actionName);
        this.cache.delete(key);
        this.persistCache();
    }
    /**
     * Clear all cooldowns
     */
    clearAll() {
        this.cache.clear();
        this.persistCache();
    }
    /**
     * Cleanup old history
     */
    cleanupHistory(retentionMs) {
        if (!fs.existsSync(this.historyPath)) {
            return 0;
        }
        const cutoffTime = Date.now() - retentionMs;
        const content = fs.readFileSync(this.historyPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const kept = [];
        for (const line of lines) {
            try {
                const record = JSON.parse(line);
                if (record.timestamp >= cutoffTime) {
                    kept.push(record);
                }
            }
            catch {
                // Skip invalid lines
            }
        }
        // Rewrite file
        const tempPath = this.historyPath + '.tmp';
        const newContent = kept.map(r => JSON.stringify(r)).join('\n');
        fs.writeFileSync(tempPath, newContent + (newContent ? '\n' : ''));
        fs.renameSync(tempPath, this.historyPath);
        return kept.length;
    }
    /**
     * Export history to JSON
     */
    exportHistory() {
        const history = this.getHistory();
        return JSON.stringify(history, null, 2);
    }
    /**
     * Get cache key
     */
    getKey(context, actionName) {
        return `${context}:${actionName}`;
    }
    /**
     * Load cache from file
     */
    loadCache() {
        if (!fs.existsSync(this.invocationPath)) {
            return;
        }
        try {
            const data = JSON.parse(fs.readFileSync(this.invocationPath, 'utf-8'));
            this.cache = new Map(Object.entries(data));
        }
        catch {
            // Start fresh if file is corrupted
            this.cache.clear();
        }
    }
    /**
     * Persist cache to file
     */
    persistCache() {
        const data = Object.fromEntries(this.cache.entries());
        fs.writeFileSync(this.invocationPath, JSON.stringify(data, null, 2));
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
 * Adaptive cooldown manager that adjusts based on success rate
 */
export class AdaptiveCooldownManager extends CooldownManager {
    /**
     * Get adaptive cooldown period based on recent success
     */
    getAdaptiveCooldown(context, baseCooldownMs, actionName = 'default') {
        const successRate = this.getSuccessRate(context, 24 * 60 * 60 * 1000, actionName);
        // Scale cooldown based on success rate
        // Higher success = shorter cooldown
        // Lower success = longer cooldown (back off)
        if (successRate >= 0.9) {
            return baseCooldownMs * 0.5; // 50% shorter
        }
        else if (successRate >= 0.7) {
            return baseCooldownMs; // Normal
        }
        else if (successRate >= 0.5) {
            return baseCooldownMs * 1.5; // 50% longer
        }
        else {
            return baseCooldownMs * 2.0; // 2x longer
        }
    }
    /**
     * Check adaptive cooldown
     */
    checkAdaptiveCooldown(context, baseCooldownMs, actionName = 'default') {
        const adaptiveCooldown = this.getAdaptiveCooldown(context, baseCooldownMs, actionName);
        return this.checkCooldown(context, adaptiveCooldown, actionName);
    }
}
//# sourceMappingURL=cooldown-manager.js.map