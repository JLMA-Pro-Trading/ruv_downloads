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

import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { AgentDBManager } from '../storage/agentdb-integration.js'
import { TelemetrySink, type TelemetrySinkConfig } from './telemetry-sink.js'

export interface TelemetryEmitterConfig extends TelemetrySinkConfig {
  flushIntervalMs?: number
  batchSize?: number
  summaryDir?: string
  maxQueue?: number
  maxRetries?: number
  backoffMs?: number
}

interface QueuedEvent {
  key: string
  event: Record<string, any>
}

export class TelemetryEmitter {
  private readonly agentdb: AgentDBManager
  private readonly sink: TelemetrySink
  private readonly flushIntervalMs: number
  private readonly batchSize: number
  private readonly summaryPath: string
  private readonly maxQueue: number
  private readonly maxRetries: number
  private readonly backoffMs: number

  private queue: QueuedEvent[] = []
  private flushing = false
  private timer?: NodeJS.Timeout
  private stats = {
    queued: 0,
    sent: 0,
    failed: 0,
    lastFlush: null as string | null
  }

  constructor(config: TelemetryEmitterConfig = {}) {
    this.agentdb = new AgentDBManager({
      dbPath: path.join(process.cwd(), 'data', 'telemetry.db')
    })
    this.sink = new TelemetrySink(config)
    this.flushIntervalMs = config.flushIntervalMs ?? 60_000
    this.batchSize = config.batchSize ?? 50
    this.maxQueue = config.maxQueue ?? 2000
    this.maxRetries = config.maxRetries ?? 3
    this.backoffMs = config.backoffMs ?? 500
    const summaryDir = config.summaryDir || path.join(process.cwd(), '.iris')
    this.summaryPath = path.join(summaryDir, 'telemetry-summary.json')
    this.startTimer()
  }

  /**
   * Record a telemetry event. Non-blocking.
   */
  async record(event: Record<string, any>): Promise<void> {
    // Protect against unbounded growth
    if (this.queue.length >= this.maxQueue) {
      this.queue.shift()
    }

    const key = `telemetry_queue.${Date.now()}.${Math.random().toString(16).slice(2)}`
    this.queue.push({ key, event })
    this.stats.queued += 1

    // Persist locally for durability
    await this.agentdb.setKeyValue(key, event)

    if (this.queue.length >= this.batchSize) {
      this.flush().catch(() => undefined)
    }
  }

  /**
   * Flush the current queue upstream in batches.
   */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return
    this.flushing = true

    try {
      await this.loadPendingFromStore()
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize)
        for (const { key, event } of batch) {
          const success = await this.sendWithRetry(event)
          if (success) {
            await this.agentdb.deleteKey(key)
            this.stats.sent += 1
          } else {
            this.stats.failed += 1
          }
        }
      }
      this.stats.lastFlush = new Date().toISOString()
      await this.writeSummary()
    } finally {
      this.flushing = false
    }
  }

  /**
   * Stop periodic flushing (for shutdown).
   */
  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  /**
   * Replay pending AgentDB entries (maintenance/task use).
   */
  async replayPending(): Promise<void> {
    await this.loadPendingFromStore()
    await this.flush()
  }

  private async loadPendingFromStore(): Promise<void> {
    const pending = await this.agentdb.listKeyPrefix('telemetry_queue.')
    for (const entry of pending) {
      // If already in queue, skip
      if (this.queue.find(q => q.key === entry.key)) continue
      this.queue.push({ key: entry.key, event: entry.value })
    }
  }

  private async sendWithRetry(event: Record<string, any>): Promise<boolean> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const ok = await this.sink.send(event)
      if (ok) return true
      await new Promise(res => setTimeout(res, this.backoffMs * attempt))
    }
    return false
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.flush().catch(() => undefined)
    }, this.flushIntervalMs)
  }

  private async writeSummary(): Promise<void> {
    try {
      await mkdir(path.dirname(this.summaryPath), { recursive: true })
      await writeFile(this.summaryPath, JSON.stringify(this.stats, null, 2), 'utf8')
    } catch {
      // Best-effort summary write
    }
  }
}
