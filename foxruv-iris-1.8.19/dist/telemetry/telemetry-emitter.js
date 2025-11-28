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
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { AgentDBManager } from '../storage/agentdb-integration.js';
import { TelemetrySink } from './telemetry-sink.js';
export class TelemetryEmitter {
    agentdb;
    sink;
    flushIntervalMs;
    batchSize;
    summaryPath;
    maxQueue;
    maxRetries;
    backoffMs;
    queue = [];
    flushing = false;
    timer;
    stats = {
        queued: 0,
        sent: 0,
        failed: 0,
        lastFlush: null
    };
    constructor(config = {}) {
        this.agentdb = new AgentDBManager({
            dbPath: path.join(process.cwd(), 'data', 'telemetry.db')
        });
        this.sink = new TelemetrySink(config);
        this.flushIntervalMs = config.flushIntervalMs ?? 60_000;
        this.batchSize = config.batchSize ?? 50;
        this.maxQueue = config.maxQueue ?? 2000;
        this.maxRetries = config.maxRetries ?? 3;
        this.backoffMs = config.backoffMs ?? 500;
        const summaryDir = config.summaryDir || path.join(process.cwd(), '.iris');
        this.summaryPath = path.join(summaryDir, 'telemetry-summary.json');
        this.startTimer();
    }
    /**
     * Record a telemetry event. Non-blocking.
     */
    async record(event) {
        // Protect against unbounded growth
        if (this.queue.length >= this.maxQueue) {
            this.queue.shift();
        }
        const key = `telemetry_queue.${Date.now()}.${Math.random().toString(16).slice(2)}`;
        this.queue.push({ key, event });
        this.stats.queued += 1;
        // Persist locally for durability
        await this.agentdb.setKeyValue(key, event);
        if (this.queue.length >= this.batchSize) {
            this.flush().catch(() => undefined);
        }
    }
    /**
     * Flush the current queue upstream in batches.
     */
    async flush() {
        if (this.flushing || this.queue.length === 0)
            return;
        this.flushing = true;
        try {
            await this.loadPendingFromStore();
            while (this.queue.length > 0) {
                const batch = this.queue.splice(0, this.batchSize);
                for (const { key, event } of batch) {
                    const success = await this.sendWithRetry(event);
                    if (success) {
                        await this.agentdb.deleteKey(key);
                        this.stats.sent += 1;
                    }
                    else {
                        this.stats.failed += 1;
                    }
                }
            }
            this.stats.lastFlush = new Date().toISOString();
            await this.writeSummary();
        }
        finally {
            this.flushing = false;
        }
    }
    /**
     * Stop periodic flushing (for shutdown).
     */
    stop() {
        if (this.timer)
            clearInterval(this.timer);
    }
    /**
     * Replay pending AgentDB entries (maintenance/task use).
     */
    async replayPending() {
        await this.loadPendingFromStore();
        await this.flush();
    }
    async loadPendingFromStore() {
        const pending = await this.agentdb.listKeyPrefix('telemetry_queue.');
        for (const entry of pending) {
            // If already in queue, skip
            if (this.queue.find(q => q.key === entry.key))
                continue;
            this.queue.push({ key: entry.key, event: entry.value });
        }
    }
    async sendWithRetry(event) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const ok = await this.sink.send(event);
            if (ok)
                return true;
            await new Promise(res => setTimeout(res, this.backoffMs * attempt));
        }
        return false;
    }
    startTimer() {
        this.timer = setInterval(() => {
            this.flush().catch(() => undefined);
        }, this.flushIntervalMs);
    }
    async writeSummary() {
        try {
            await mkdir(path.dirname(this.summaryPath), { recursive: true });
            await writeFile(this.summaryPath, JSON.stringify(this.stats, null, 2), 'utf8');
        }
        catch {
            // Best-effort summary write
        }
    }
}
