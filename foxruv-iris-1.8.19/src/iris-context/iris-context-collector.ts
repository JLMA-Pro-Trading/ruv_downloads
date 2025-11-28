/**
 * Iris Context Collector
 *
 * Collects and stores context events from various sources for automatic
 * Iris invocation. Integrates with AgentDB for fast vector search
 * and Supabase for cloud persistence.
 *
 * @module iris-context-collector
 * @version 1.0.0
 */

import { AgentDBSingleton } from '../storage/agentdb-singleton.js'
import { AgentDBManager } from '../storage/agentdb-integration.js'
import {
  getSupabase,
  isSupabaseInitialized,
  getTenantId
} from '../supabase/client.js'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Context event for Iris invocation
 */
export interface IrisContextEvent {
  id: string
  eventType: 'task_completion' | 'error' | 'deployment' | 'drift_detected' |
             'consensus_failure' | 'pattern_match' | 'threshold_breach'
  project: string
  expertId?: string
  timestamp: Date
  severity: 'info' | 'warning' | 'critical'

  // Event payload
  eventData: Record<string, any>

  // Context metadata
  contextType: 'performance' | 'error' | 'deployment' | 'consensus'
  tags?: string[]

  // Vector embedding for semantic search
  embedding?: number[]

  // Aggregation support
  aggregationKey?: string
  windowStart?: Date
  windowEnd?: Date
}

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetricsSnapshot {
  project: string
  expertId: string
  version: string
  timestamp: Date
  windowSize: number  // seconds

  // Core metrics
  successRate: number
  avgConfidence: number
  avgLatencyMs: number
  totalPredictions: number

  // Derived metrics
  driftScore: number
  qualityScore: number

  // Baseline comparison
  baselineSuccessRate?: number
  baselineConfidence?: number
  percentageChange?: number

  // Token usage
  totalTokensUsed: number
  avgTokensPerPrediction: number

  metadata?: Record<string, any>
}

/**
 * Trigger condition definition
 */
export interface TriggerCondition {
  triggerId: string
  name: string
  description?: string
  enabled: boolean
  priority: number  // 1-10

  // Condition
  conditionType: 'threshold' | 'pattern' | 'anomaly' | 'schedule'
  conditionSpec: ThresholdCondition | PatternCondition | AnomalyCondition | ScheduleCondition

  // Scope
  projectFilter?: string
  expertFilter?: string

  // Actions
  actionType: 'evaluate' | 'retrain' | 'notify' | 'full_analysis'
  actionConfig?: Record<string, any>

  // Rate limiting
  cooldownSeconds: number
  lastTriggered?: Date
  triggerCount: number
}

/**
 * Threshold-based condition
 */
export interface ThresholdCondition {
  metric: 'success_rate' | 'confidence' | 'latency' | 'drift_score'
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'eq'
  value: number
  windowSize: number  // seconds
  minSamples?: number  // minimum events needed
}

/**
 * Pattern-based condition
 */
export interface PatternCondition {
  patternId: string
  minConfidence: number
  minOccurrences?: number
}

/**
 * Anomaly-based condition
 */
export interface AnomalyCondition {
  metric: string
  stdDevThreshold: number  // e.g., 2.0 for 2σ
  windowSize: number
  baselineWindow: number  // historical window for baseline
}

/**
 * Schedule-based condition
 */
export interface ScheduleCondition {
  cronExpression: string
  timezone?: string
}

/**
 * Expert behavior pattern
 */
export interface ExpertBehaviorPattern {
  patternId: string
  project: string
  expertId?: string  // null for cross-expert patterns
  patternType: 'success_sequence' | 'failure_chain' | 'drift_precursor' |
               'recovery_pattern' | 'degradation_pattern'

  // Pattern definition
  patternSignature: string  // hash
  patternData: {
    events: Array<{
      type: string
      minOccurrences: number
      maxTimeGap?: number
    }>
    sequence: 'ordered' | 'unordered'
    timeWindow: number
  }
  embedding?: number[]

  // Metrics
  occurrenceCount: number
  confidence: number
  predictivePower: number  // 0-1

  // Temporal
  avgDurationSeconds?: number
  firstObserved: Date
  lastObserved: Date

  // Associations
  associatedTriggers?: string[]

  metadata?: Record<string, any>
}

/**
 * Temporal aggregation
 */
export interface TemporalAggregation {
  aggregationType: 'hourly' | 'daily' | 'weekly'
  project: string
  expertId?: string
  windowStart: Date
  windowEnd: Date

  // Event counts
  totalEvents: number
  criticalEvents: number
  warningEvents: number

  // Performance metrics
  avgSuccessRate?: number
  avgConfidence?: number
  avgLatencyMs?: number

  // Alert counts
  driftAlerts: number
  consensusFailures: number
  retrainingTriggers: number

  // Trend
  trendDirection: 'improving' | 'stable' | 'declining'
  trendMagnitude: number

  // Full stats
  summaryStats: Record<string, any>
}

/**
 * Configuration for context collector
 */
export interface IrisContextCollectorConfig {
  dbPath?: string
  agentDBPath?: string
  enableVectorSearch?: boolean
  useSupabase?: boolean
  cacheTTL?: number  // seconds
}

// ============================================================================
// Main Class
// ============================================================================

/**
 * Iris Context Collector
 *
 * Collects and stores context events from various sources for automatic
 * Iris invocation.
 */
export class IrisContextCollector {
  private db: any
  private agentDB?: AgentDBManager
  private config: Required<IrisContextCollectorConfig>
  private agentDbReady: Promise<void> | null = null
  private metricsCache = new Map<string, PerformanceMetricsSnapshot>()

  constructor(config: IrisContextCollectorConfig = {}) {
    this.config = {
      dbPath: config.dbPath || './data/iris-context.db',
      agentDBPath: config.agentDBPath || './data/iris-agentdb.db',
      enableVectorSearch: config.enableVectorSearch ?? true,
      useSupabase: config.useSupabase ?? true,
      cacheTTL: config.cacheTTL ?? 300  // 5 minutes
    }

    // Initialize local SQLite DB
    this.agentDbReady = this.initializeAgentDb()

    // Initialize AgentDB for vector search if enabled
    if (this.config.enableVectorSearch) {
      this.agentDB = new AgentDBManager({
        dbPath: this.config.agentDBPath,
        enableCausalReasoning: false,
        enableReflexion: false,
        enableSkillLibrary: false
      })
    }
  }

  /**
   * Initialize AgentDB (handles async sql.js loader)
   */
  private initializeAgentDb(): Promise<void> {
    return (async () => {
      try {
        this.db = await AgentDBSingleton.getInstance(this.config.dbPath)
        this.initializeTables()
      } catch (error) {
        console.warn('⚠ IrisContextCollector: AgentDB initialization failed:', error)
        this.db = null
      }
    })()
  }

  /**
   * Ensure AgentDB is ready
   */
  private async ensureAgentDbReady(): Promise<void> {
    const ready = this.agentDbReady
    if (ready) {
      try {
        await ready
      } finally {
        if (this.agentDbReady === ready) {
          this.agentDbReady = null
        }
      }
    }
  }

  /**
   * Get initialized DB instance
   */
  private async getDb(): Promise<any | null> {
    await this.ensureAgentDbReady()
    return this.db
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    if (!this.db) return

    try {
      // Context events table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS iris_context_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          project TEXT NOT NULL,
          expert_id TEXT,
          timestamp INTEGER NOT NULL,
          severity TEXT NOT NULL,
          event_data TEXT NOT NULL,
          context_type TEXT NOT NULL,
          tags TEXT,
          aggregation_key TEXT,
          window_start INTEGER,
          window_end INTEGER,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `)

      // Performance metrics table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS iris_performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project TEXT NOT NULL,
          expert_id TEXT NOT NULL,
          version TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          window_size INTEGER NOT NULL,
          success_rate REAL NOT NULL,
          avg_confidence REAL NOT NULL,
          avg_latency_ms REAL NOT NULL,
          total_predictions INTEGER NOT NULL,
          drift_score REAL DEFAULT 0.0,
          quality_score REAL DEFAULT 1.0,
          baseline_success_rate REAL,
          baseline_confidence REAL,
          percentage_change REAL,
          total_tokens_used INTEGER DEFAULT 0,
          avg_tokens_per_prediction REAL DEFAULT 0.0,
          metadata TEXT,
          UNIQUE(project, expert_id, version, timestamp, window_size)
        )
      `)

      // Trigger conditions table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS iris_trigger_conditions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trigger_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 5,
          condition_type TEXT NOT NULL,
          condition_spec TEXT NOT NULL,
          project_filter TEXT,
          expert_filter TEXT,
          action_type TEXT NOT NULL,
          action_config TEXT,
          cooldown_seconds INTEGER DEFAULT 3600,
          last_triggered INTEGER,
          trigger_count INTEGER DEFAULT 0,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `)

      // Expert patterns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS iris_expert_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_id TEXT UNIQUE NOT NULL,
          project TEXT NOT NULL,
          expert_id TEXT,
          pattern_type TEXT NOT NULL,
          pattern_signature TEXT NOT NULL,
          pattern_data TEXT NOT NULL,
          occurrence_count INTEGER DEFAULT 1,
          confidence REAL DEFAULT 0.5,
          predictive_power REAL DEFAULT 0.0,
          avg_duration_seconds REAL,
          first_observed INTEGER,
          last_observed INTEGER,
          associated_triggers TEXT,
          metadata TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `)

      // Temporal aggregations table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS iris_temporal_aggregations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          aggregation_type TEXT NOT NULL,
          project TEXT NOT NULL,
          expert_id TEXT,
          window_start INTEGER NOT NULL,
          window_end INTEGER NOT NULL,
          total_events INTEGER DEFAULT 0,
          critical_events INTEGER DEFAULT 0,
          warning_events INTEGER DEFAULT 0,
          avg_success_rate REAL,
          avg_confidence REAL,
          avg_latency_ms REAL,
          drift_alerts INTEGER DEFAULT 0,
          consensus_failures INTEGER DEFAULT 0,
          retraining_triggers INTEGER DEFAULT 0,
          trend_direction TEXT,
          trend_magnitude REAL,
          summary_stats TEXT,
          UNIQUE(aggregation_type, project, expert_id, window_start)
        )
      `)

      // Create indexes
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_context_events_project ON iris_context_events(project)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_context_events_type ON iris_context_events(event_type)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_context_events_timestamp ON iris_context_events(timestamp)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_context_events_severity ON iris_context_events(severity)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_perf_metrics_project_expert ON iris_performance_metrics(project, expert_id)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_perf_metrics_timestamp ON iris_performance_metrics(timestamp)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_trigger_conditions_enabled ON iris_trigger_conditions(enabled)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_temporal_agg_project ON iris_temporal_aggregations(project)`)
    } catch (error) {
      console.warn('⚠ IrisContextCollector: Table initialization failed:', error)
      this.db = null
    }
  }

  // ============================================================================
  // Event Collection
  // ============================================================================

  /**
   * Record a context event
   */
  async recordEvent(event: Omit<IrisContextEvent, 'id' | 'embedding'>): Promise<string> {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Generate aggregation key
    const aggKey = this.generateAggregationKey(event)

    // Write to local DB
    const db = await this.getDb()
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO iris_context_events
        (id, event_type, project, expert_id, timestamp, severity, event_data,
         context_type, tags, aggregation_key, window_start, window_end)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        eventId,
        event.eventType,
        event.project,
        event.expertId || null,
        event.timestamp.getTime(),
        event.severity,
        JSON.stringify(event.eventData),
        event.contextType,
        event.tags ? JSON.stringify(event.tags) : null,
        aggKey,
        event.windowStart?.getTime() || null,
        event.windowEnd?.getTime() || null
      )
    }

    // Write to Supabase if enabled
    if (this.config.useSupabase && isSupabaseInitialized()) {
      try {
        const supabase = getSupabase()
        const tenantId = getTenantId()

        await supabase.from('iris_context_events').insert({
          tenant_id: tenantId,
          id: eventId,
          event_type: event.eventType,
          project: event.project,
          expert_id: event.expertId,
          timestamp: event.timestamp.toISOString(),
          severity: event.severity,
          event_data: event.eventData,
          context_type: event.contextType,
          tags: event.tags,
          aggregation_key: aggKey
        })
      } catch (error) {
        console.warn('Failed to write event to Supabase:', error)
      }
    }

    return eventId
  }

  /**
   * Record a batch of events
   */
  async recordEventsBatch(events: Omit<IrisContextEvent, 'id' | 'embedding'>[]): Promise<string[]> {
    const ids: string[] = []

    const db = await this.getDb()
    if (!db) {
      // Fallback to individual inserts if DB not available
      for (const event of events) {
        ids.push(await this.recordEvent(event))
      }
      return ids
    }

    // Use transaction for batch insert
    db.exec('BEGIN TRANSACTION')

    try {
      for (const event of events) {
        ids.push(await this.recordEvent(event))
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }

    return ids
  }

  /**
   * Record performance metrics snapshot
   */
  async recordPerformanceMetrics(metrics: PerformanceMetricsSnapshot): Promise<void> {
    const db = await this.getDb()
    if (!db) return

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO iris_performance_metrics
      (project, expert_id, version, timestamp, window_size, success_rate,
       avg_confidence, avg_latency_ms, total_predictions, drift_score,
       quality_score, baseline_success_rate, baseline_confidence,
       percentage_change, total_tokens_used, avg_tokens_per_prediction, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      metrics.project,
      metrics.expertId,
      metrics.version,
      metrics.timestamp.getTime(),
      metrics.windowSize,
      metrics.successRate,
      metrics.avgConfidence,
      metrics.avgLatencyMs,
      metrics.totalPredictions,
      metrics.driftScore,
      metrics.qualityScore,
      metrics.baselineSuccessRate || null,
      metrics.baselineConfidence || null,
      metrics.percentageChange || null,
      metrics.totalTokensUsed,
      metrics.avgTokensPerPrediction,
      metrics.metadata ? JSON.stringify(metrics.metadata) : null
    )

    // Update cache
    const cacheKey = `${metrics.project}:${metrics.expertId}:${metrics.version}`
    this.metricsCache.set(cacheKey, metrics)
  }

  // ============================================================================
  // Trigger Management
  // ============================================================================

  /**
   * Register a trigger condition
   */
  async registerTrigger(
    trigger: Omit<TriggerCondition, 'triggerCount' | 'lastTriggered'>
  ): Promise<string> {
    const db = await this.getDb()
    if (!db) throw new Error('Database not initialized')

    const stmt = db.prepare(`
      INSERT INTO iris_trigger_conditions
      (trigger_id, name, description, enabled, priority, condition_type,
       condition_spec, project_filter, expert_filter, action_type,
       action_config, cooldown_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      trigger.triggerId,
      trigger.name,
      trigger.description || null,
      trigger.enabled ? 1 : 0,
      trigger.priority,
      trigger.conditionType,
      JSON.stringify(trigger.conditionSpec),
      trigger.projectFilter || null,
      trigger.expertFilter || null,
      trigger.actionType,
      trigger.actionConfig ? JSON.stringify(trigger.actionConfig) : null,
      trigger.cooldownSeconds
    )

    return trigger.triggerId
  }

  /**
   * Update trigger condition
   */
  async updateTrigger(triggerId: string, updates: Partial<TriggerCondition>): Promise<void> {
    const db = await this.getDb()
    if (!db) throw new Error('Database not initialized')

    const setClauses: string[] = []
    const values: any[] = []

    if (updates.name !== undefined) {
      setClauses.push('name = ?')
      values.push(updates.name)
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?')
      values.push(updates.description)
    }
    if (updates.enabled !== undefined) {
      setClauses.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }
    if (updates.priority !== undefined) {
      setClauses.push('priority = ?')
      values.push(updates.priority)
    }

    if (setClauses.length === 0) return

    setClauses.push('updated_at = strftime("%s", "now")')
    values.push(triggerId)

    const stmt = db.prepare(`
      UPDATE iris_trigger_conditions
      SET ${setClauses.join(', ')}
      WHERE trigger_id = ?
    `)

    stmt.run(...values)
  }

  /**
   * Get all active triggers
   */
  async getActiveTriggers(project?: string): Promise<TriggerCondition[]> {
    const db = await this.getDb()
    if (!db) return []

    const query = project
      ? `SELECT * FROM iris_trigger_conditions WHERE enabled = 1 AND (project_filter IS NULL OR project_filter = ?) ORDER BY priority DESC`
      : `SELECT * FROM iris_trigger_conditions WHERE enabled = 1 ORDER BY priority DESC`

    const stmt = db.prepare(query)
    const rows = project ? stmt.all(project) : stmt.all()

    return (rows as any[]).map(row => ({
      triggerId: row.trigger_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      priority: row.priority,
      conditionType: row.condition_type,
      conditionSpec: JSON.parse(row.condition_spec),
      projectFilter: row.project_filter,
      expertFilter: row.expert_filter,
      actionType: row.action_type,
      actionConfig: row.action_config ? JSON.parse(row.action_config) : undefined,
      cooldownSeconds: row.cooldown_seconds,
      lastTriggered: row.last_triggered ? new Date(row.last_triggered) : undefined,
      triggerCount: row.trigger_count
    }))
  }

  // ============================================================================
  // Context Retrieval
  // ============================================================================

  /**
   * Get recent events by type
   */
  async getRecentEvents(
    eventType: string,
    project?: string,
    expertId?: string,
    limit: number = 100
  ): Promise<IrisContextEvent[]> {
    const db = await this.getDb()
    if (!db) return []

    let query = `SELECT * FROM iris_context_events WHERE event_type = ?`
    const params: any[] = [eventType]

    if (project) {
      query += ` AND project = ?`
      params.push(project)
    }

    if (expertId) {
      query += ` AND expert_id = ?`
      params.push(expertId)
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`
    params.push(limit)

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as any[]

    return rows.map(this.rowToContextEvent)
  }

  /**
   * Get events in time window
   */
  async getEventsInWindow(
    project: string,
    windowStart: Date,
    windowEnd: Date,
    filters?: {
      eventType?: string
      expertId?: string
      severity?: string
    }
  ): Promise<IrisContextEvent[]> {
    const db = await this.getDb()
    if (!db) return []

    let query = `SELECT * FROM iris_context_events WHERE project = ? AND timestamp >= ? AND timestamp <= ?`
    const params: any[] = [project, windowStart.getTime(), windowEnd.getTime()]

    if (filters?.eventType) {
      query += ` AND event_type = ?`
      params.push(filters.eventType)
    }

    if (filters?.expertId) {
      query += ` AND expert_id = ?`
      params.push(filters.expertId)
    }

    if (filters?.severity) {
      query += ` AND severity = ?`
      params.push(filters.severity)
    }

    query += ` ORDER BY timestamp DESC`

    const stmt = db.prepare(query)
    const rows = stmt.all(...params) as any[]

    return rows.map(this.rowToContextEvent)
  }

  /**
   * Get latest metrics for expert
   */
  async getLatestMetrics(
    project: string,
    expertId: string,
    version: string
  ): Promise<PerformanceMetricsSnapshot | null> {
    // Check cache first
    const cacheKey = `${project}:${expertId}:${version}`
    const cached = this.metricsCache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp.getTime() < this.config.cacheTTL * 1000) {
      return cached
    }

    // Fetch from DB
    const db = await this.getDb()
    if (!db) return null

    const stmt = db.prepare(`
      SELECT * FROM iris_performance_metrics
      WHERE project = ? AND expert_id = ? AND version = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `)

    const row = stmt.get(project, expertId, version) as any

    if (!row) return null

    const metrics = this.rowToMetricsSnapshot(row)

    // Update cache
    this.metricsCache.set(cacheKey, metrics)

    return metrics
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Generate aggregation key
   */
  private generateAggregationKey(event: Omit<IrisContextEvent, 'id' | 'embedding'>): string {
    const date = new Date(event.timestamp)
    const day = date.toISOString().split('T')[0]
    return `${event.project}:${event.expertId || 'all'}:${day}`
  }

  /**
   * Convert DB row to context event
   */
  private rowToContextEvent(row: any): IrisContextEvent {
    return {
      id: row.id,
      eventType: row.event_type,
      project: row.project,
      expertId: row.expert_id,
      timestamp: new Date(row.timestamp),
      severity: row.severity,
      eventData: JSON.parse(row.event_data),
      contextType: row.context_type,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      aggregationKey: row.aggregation_key,
      windowStart: row.window_start ? new Date(row.window_start) : undefined,
      windowEnd: row.window_end ? new Date(row.window_end) : undefined
    }
  }

  /**
   * Convert DB row to metrics snapshot
   */
  private rowToMetricsSnapshot(row: any): PerformanceMetricsSnapshot {
    return {
      project: row.project,
      expertId: row.expert_id,
      version: row.version,
      timestamp: new Date(row.timestamp),
      windowSize: row.window_size,
      successRate: row.success_rate,
      avgConfidence: row.avg_confidence,
      avgLatencyMs: row.avg_latency_ms,
      totalPredictions: row.total_predictions,
      driftScore: row.drift_score,
      qualityScore: row.quality_score,
      baselineSuccessRate: row.baseline_success_rate,
      baselineConfidence: row.baseline_confidence,
      percentageChange: row.percentage_change,
      totalTokensUsed: row.total_tokens_used,
      avgTokensPerPrediction: row.avg_tokens_per_prediction,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }
  }

  /**
   * Close database connections
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close()
      } catch (error) {
        console.warn('Failed to close database:', error)
      }
    }

    if (this.agentDB) {
      try {
        this.agentDB.close()
      } catch (error) {
        console.warn('Failed to close AgentDB:', error)
      }
    }
  }
}

/**
 * Factory function to create collector instance
 */
export function createIrisContextCollector(
  config?: IrisContextCollectorConfig
): IrisContextCollector {
  return new IrisContextCollector(config)
}
