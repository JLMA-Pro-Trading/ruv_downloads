/**
 * TelemetryEmitter
 * ----------------
 * Dual-lane telemetry:
 * 1) Persist locally (AgentDB for durability).
 * 2) Batch and send upstream via TelemetrySink (API-first, Supabase fallback).
 *
 * Includes simple backpressure (batch size + interval) and writes a summary file
 * under .iris to aid local observability.
 */
import { type TelemetrySinkConfig } from './telemetry-sink.js';
export interface TelemetryEmitterConfig extends TelemetrySinkConfig {
    flushIntervalMs?: number;
    batchSize?: number;
    summaryDir?: string;
    maxQueue?: number;
    maxRetries?: number;
    backoffMs?: number;
}
export declare class TelemetryEmitter {
    private readonly agentdb;
    private readonly sink;
    private readonly flushIntervalMs;
    private readonly batchSize;
    private readonly summaryPath;
    private readonly maxQueue;
    private readonly maxRetries;
    private readonly backoffMs;
    private queue;
    private flushing;
    private timer?;
    private stats;
    constructor(config?: TelemetryEmitterConfig);
    /**
     * Record a telemetry event. Non-blocking.
     */
    record(event: Record<string, any>): Promise<void>;
    /**
     * Flush the current queue upstream in batches.
     */
    flush(): Promise<void>;
    /**
     * Stop periodic flushing (for shutdown).
     */
    stop(): void;
    /**
     * Replay pending AgentDB entries (maintenance/task use).
     */
    replayPending(): Promise<void>;
    private loadPendingFromStore;
    private sendWithRetry;
    private startTimer;
    private writeSummary;
}
//# sourceMappingURL=telemetry-emitter.d.ts.map