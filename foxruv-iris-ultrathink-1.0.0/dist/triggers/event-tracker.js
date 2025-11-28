/**
 * Event Tracker
 *
 * Records events to JSONL files and provides querying capabilities.
 * Optimized for fast writes and reads within time windows.
 */
import * as fs from 'fs';
import * as path from 'path';
export class EventTracker {
    dbBasePath;
    historyPath;
    constructor(dbBasePath) {
        this.dbBasePath = dbBasePath;
        this.ensureDir(dbBasePath);
        this.historyPath = path.join(dbBasePath, 'event-history.jsonl');
    }
    /**
     * Record an event (append-only, very fast)
     */
    recordEvent(event) {
        fs.appendFileSync(this.historyPath, JSON.stringify(event) + '\n');
    }
    /**
     * Record multiple events in batch
     */
    recordBatch(events) {
        const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
        fs.appendFileSync(this.historyPath, lines);
    }
    /**
     * Get events within a time window
     */
    getRecentEvents(timeWindowMs) {
        if (!fs.existsSync(this.historyPath)) {
            return [];
        }
        const cutoffTime = Date.now() - timeWindowMs;
        return this.readAndFilter(line => {
            try {
                const event = JSON.parse(line);
                return event.timestamp >= cutoffTime ? event : null;
            }
            catch {
                return null;
            }
        });
    }
    /**
     * Get events for a specific context
     */
    getContextEvents(context, timeWindowMs) {
        if (!fs.existsSync(this.historyPath)) {
            return [];
        }
        const cutoffTime = timeWindowMs ? Date.now() - timeWindowMs : 0;
        return this.readAndFilter(line => {
            try {
                const event = JSON.parse(line);
                if (event.context !== context)
                    return null;
                if (timeWindowMs && event.timestamp < cutoffTime)
                    return null;
                return event;
            }
            catch {
                return null;
            }
        });
    }
    /**
     * Get events by type
     */
    getEventsByType(eventType, timeWindowMs, context) {
        if (!fs.existsSync(this.historyPath)) {
            return [];
        }
        const cutoffTime = timeWindowMs ? Date.now() - timeWindowMs : 0;
        return this.readAndFilter(line => {
            try {
                const event = JSON.parse(line);
                if (event.event !== eventType)
                    return null;
                if (context && event.context !== context)
                    return null;
                if (timeWindowMs && event.timestamp < cutoffTime)
                    return null;
                return event;
            }
            catch {
                return null;
            }
        });
    }
    /**
     * Get event statistics
     */
    getStats(timeWindowMs, context) {
        const events = context
            ? this.getContextEvents(context, timeWindowMs)
            : this.getRecentEvents(timeWindowMs);
        const eventsByType = {};
        for (const event of events) {
            eventsByType[event.event] = (eventsByType[event.event] || 0) + 1;
        }
        return {
            totalEvents: events.length,
            eventsByType,
            lastEvent: events[events.length - 1] || null,
            oldestEvent: events[0] || null,
            timeWindowMs
        };
    }
    /**
     * Count events by type within time window
     */
    countEventsByType(eventType, context, timeWindowMs) {
        const events = this.getEventsByType(eventType, timeWindowMs, context);
        return events.length;
    }
    /**
     * Cleanup old events (run periodically to prevent unbounded growth)
     */
    cleanupOldEvents(retentionMs) {
        if (!fs.existsSync(this.historyPath)) {
            return 0;
        }
        const cutoffTime = Date.now() - retentionMs;
        const kept = [];
        this.readAndFilter(line => {
            try {
                const event = JSON.parse(line);
                if (event.timestamp >= cutoffTime) {
                    kept.push(event);
                }
                return null; // Don't accumulate in memory
            }
            catch {
                return null;
            }
        });
        // Rewrite file with only kept events
        const tempPath = this.historyPath + '.tmp';
        const lines = kept.map(e => JSON.stringify(e)).join('\n');
        fs.writeFileSync(tempPath, lines + (lines ? '\n' : ''));
        fs.renameSync(tempPath, this.historyPath);
        return kept.length;
    }
    /**
     * Get file size in bytes
     */
    getHistorySize() {
        if (!fs.existsSync(this.historyPath)) {
            return 0;
        }
        return fs.statSync(this.historyPath).size;
    }
    /**
     * Export events to JSON
     */
    exportToJson(timeWindowMs) {
        const events = timeWindowMs
            ? this.getRecentEvents(timeWindowMs)
            : this.readAndFilter(line => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            });
        return JSON.stringify(events, null, 2);
    }
    /**
     * Import events from JSON
     */
    importFromJson(json) {
        const events = JSON.parse(json);
        this.recordBatch(events);
        return events.length;
    }
    /**
     * Clear all events
     */
    clear() {
        if (fs.existsSync(this.historyPath)) {
            fs.unlinkSync(this.historyPath);
        }
    }
    /**
     * Get history file path
     */
    getHistoryPath() {
        return this.historyPath;
    }
    /**
     * Read and filter events from file
     */
    readAndFilter(filterFn) {
        const content = fs.readFileSync(this.historyPath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const results = [];
        for (const line of lines) {
            const result = filterFn(line);
            if (result !== null) {
                results.push(result);
            }
        }
        return results;
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
 * Event aggregator for analyzing patterns
 */
export class EventAggregator {
    tracker;
    constructor(tracker) {
        this.tracker = tracker;
    }
    /**
     * Get event rate (events per minute)
     */
    getEventRate(eventType, context, timeWindowMs) {
        const events = this.tracker.getEventsByType(eventType, timeWindowMs, context);
        const minutes = timeWindowMs / (60 * 1000);
        return events.length / minutes;
    }
    /**
     * Detect event spikes
     */
    detectSpike(eventType, context, shortWindowMs, longWindowMs, spikeThreshold = 2.0) {
        const shortRate = this.getEventRate(eventType, context, shortWindowMs);
        const longRate = this.getEventRate(eventType, context, longWindowMs);
        if (longRate === 0)
            return false;
        return shortRate / longRate >= spikeThreshold;
    }
    /**
     * Get event patterns (hourly distribution)
     */
    getHourlyDistribution(eventType, context, timeWindowMs) {
        const events = this.tracker.getEventsByType(eventType, timeWindowMs, context);
        const distribution = {};
        for (const event of events) {
            const hour = new Date(event.timestamp).getHours();
            distribution[hour] = (distribution[hour] || 0) + 1;
        }
        return distribution;
    }
    /**
     * Get most frequent events
     */
    getTopEvents(context, timeWindowMs, limit = 10) {
        const stats = this.tracker.getStats(timeWindowMs, context);
        return Object.entries(stats.eventsByType)
            .map(([event, count]) => ({ event, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }
}
//# sourceMappingURL=event-tracker.js.map