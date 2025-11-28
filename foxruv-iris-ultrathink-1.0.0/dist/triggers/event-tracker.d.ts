/**
 * Event Tracker
 *
 * Records events to JSONL files and provides querying capabilities.
 * Optimized for fast writes and reads within time windows.
 */
import type { EventRecord, EventStats } from './types.js';
export declare class EventTracker {
    private readonly dbBasePath;
    private historyPath;
    constructor(dbBasePath: string);
    /**
     * Record an event (append-only, very fast)
     */
    recordEvent(event: EventRecord): void;
    /**
     * Record multiple events in batch
     */
    recordBatch(events: EventRecord[]): void;
    /**
     * Get events within a time window
     */
    getRecentEvents(timeWindowMs: number): EventRecord[];
    /**
     * Get events for a specific context
     */
    getContextEvents(context: string, timeWindowMs?: number): EventRecord[];
    /**
     * Get events by type
     */
    getEventsByType(eventType: string, timeWindowMs?: number, context?: string): EventRecord[];
    /**
     * Get event statistics
     */
    getStats(timeWindowMs: number, context?: string): EventStats;
    /**
     * Count events by type within time window
     */
    countEventsByType(eventType: string, context: string, timeWindowMs: number): number;
    /**
     * Cleanup old events (run periodically to prevent unbounded growth)
     */
    cleanupOldEvents(retentionMs: number): number;
    /**
     * Get file size in bytes
     */
    getHistorySize(): number;
    /**
     * Export events to JSON
     */
    exportToJson(timeWindowMs?: number): string;
    /**
     * Import events from JSON
     */
    importFromJson(json: string): number;
    /**
     * Clear all events
     */
    clear(): void;
    /**
     * Get history file path
     */
    getHistoryPath(): string;
    /**
     * Read and filter events from file
     */
    private readAndFilter;
    /**
     * Ensure directory exists
     */
    private ensureDir;
}
/**
 * Event aggregator for analyzing patterns
 */
export declare class EventAggregator {
    private readonly tracker;
    constructor(tracker: EventTracker);
    /**
     * Get event rate (events per minute)
     */
    getEventRate(eventType: string, context: string, timeWindowMs: number): number;
    /**
     * Detect event spikes
     */
    detectSpike(eventType: string, context: string, shortWindowMs: number, longWindowMs: number, spikeThreshold?: number): boolean;
    /**
     * Get event patterns (hourly distribution)
     */
    getHourlyDistribution(eventType: string, context: string, timeWindowMs: number): Record<number, number>;
    /**
     * Get most frequent events
     */
    getTopEvents(context: string, timeWindowMs: number, limit?: number): Array<{
        event: string;
        count: number;
    }>;
}
//# sourceMappingURL=event-tracker.d.ts.map