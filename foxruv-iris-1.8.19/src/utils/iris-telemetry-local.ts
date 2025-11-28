/**
 * LOCAL TELEMETRY - Direct AgentDB Writer
 * Bypasses import issues, writes directly to AgentDB
 * WORKS WITH LOCAL-ONLY MODE (No Supabase required)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as os from 'os';
import { telemetryEmitter } from '../telemetry/emitter-singleton.js';

const DB_PATH = path.join(
  os.homedir(),
  '.nvm/versions/node/v22.16.0/lib/node_modules/@foxruv/iris/data/iris/global-metrics.db'
);

interface TelemetryEvent {
  expertId: string;
  version?: string;
  runId?: string;
  confidence?: number;
  latencyMs?: number;
  outcome?: 'success' | 'failure';
  metadata?: Record<string, any>;
}

/**
 * Log telemetry directly to AgentDB (bypasses all imports)
 */
export async function logTelemetryLocal(event: TelemetryEvent): Promise<void> {
  const db = new Database(DB_PATH);

  try {
    // Ensure tables exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        expert_id TEXT NOT NULL,
        version TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        confidence REAL NOT NULL,
        outcome TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        reflexion_used INTEGER NOT NULL,
        consensus_participation INTEGER NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS expert_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        expert_id TEXT NOT NULL,
        version TEXT NOT NULL,
        total_predictions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        accuracy REAL DEFAULT 0.0,
        avg_confidence REAL DEFAULT 0.0,
        avg_duration REAL DEFAULT 0.0,
        recent_trend TEXT DEFAULT 'stable',
        last_updated INTEGER NOT NULL,
        UNIQUE(project, expert_id, version)
      )
    `);

    // Insert telemetry event
    const stmt = db.prepare(`
      INSERT INTO telemetry_events
      (project, expert_id, version, timestamp, confidence, outcome, duration_ms, reflexion_used, consensus_participation, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      'nfl-predictor',
      event.expertId,
      event.version || '1.0.0',
      Math.floor(Date.now() / 1000),
      event.confidence || 0.0,
      event.outcome || 'success',
      event.latencyMs || 0,
      0, // reflexion_used
      0, // consensus_participation
      event.metadata ? JSON.stringify(event.metadata) : null
    );

    // Update expert metrics
    db.exec(`
      INSERT OR REPLACE INTO expert_metrics (
        project, expert_id, version, total_predictions, correct_predictions,
        accuracy, avg_confidence, avg_duration, recent_trend, last_updated
      )
      SELECT
        '${  'nfl-predictor'}',
        '${event.expertId}',
        '${event.version || '1.0.0'}',
        COUNT(*),
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END),
        CAST(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS REAL) / COUNT(*),
        AVG(confidence),
        AVG(duration_ms),
        'stable',
        strftime('%s', 'now')
      FROM telemetry_events
      WHERE project = 'nfl-predictor' AND expert_id = '${event.expertId}' AND version = '${event.version || '1.0.0'}'
    `);

  } finally {
    db.close();
  }

  // Also enqueue for upstream sink (API-first, Supabase fallback) when available
  telemetryEmitter.record({
    project: 'local',
    expert_id: event.expertId,
    version: event.version,
    run_id: event.runId,
    confidence: event.confidence,
    latency_ms: event.latencyMs,
    outcome: event.outcome,
    metadata: event.metadata,
    timestamp: new Date().toISOString()
  }).catch(() => undefined);
}

/**
 * Decorator to automatically log telemetry for async functions
 */
export function withTelemetry(expertId: string, version: string = '1.0.0') {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const runId = randomUUID();

      try {
        const result = await originalMethod.apply(this, args);

        // Log success
        await logTelemetryLocal({
          expertId,
          version,
          runId,
          confidence: result?.confidence || 0.9,
          latencyMs: Date.now() - startTime,
          outcome: 'success',
          metadata: {
            method: propertyKey,
            args: args.length,
          }
        });

        return result;
      } catch (error) {
        // Log failure
        await logTelemetryLocal({
          expertId,
          version,
          runId,
          confidence: 0.0,
          latencyMs: Date.now() - startTime,
          outcome: 'failure',
          metadata: {
            method: propertyKey,
            error: error instanceof Error ? error.message : String(error),
          }
        });

        throw error;
      }
    };

    return descriptor;
  };
}
