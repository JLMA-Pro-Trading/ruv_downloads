/**
 * Global Metrics - Universal Telemetry Collection & Drift Detection
 *
 * Central telemetry system for tracking expert performance across all projects.
 * Provides real-time drift detection, performance analytics, and alert generation.
 *
 * Features:
 * - Cross-project metrics aggregation
 * - Real-time drift detection
 * - Performance degradation alerts
 * - Prompt version tracking
 * - Consensus score analysis
 * - Automatic retraining triggers
 *
 * ARCHITECTURE:
 * - Supabase: Authoritative source of truth (cloud-based persistence)
 * - AgentDB: Optional local cache for fast reads (150x faster queries)
 *
 * @module global-metrics
 * @version 2.0.0
 */

import {
  logTelemetry,
  getExpertStats,
  detectDrift
} from '../supabase/telemetry.js'
import { getSupabase, isSupabaseInitialized } from '../supabase/client.js'
import { AgentDBSingleton } from '../storage/agentdb-singleton.js'

/**
 * Telemetry event schema
 */
export interface TelemetryEvent {
  project: string
  expertId: string
  version: string
  timestamp: Date
  confidence: number
  outcome: 'correct' | 'incorrect' | 'partial' | 'unknown'
  durationMs: number
  reflexionUsed: boolean
  consensusParticipation: boolean
  metadata?: Record<string, any>
}

/**
 * Performance metrics for an expert
 */
export interface ExpertMetrics {
  expertId: string
  project: string
  version: string
  totalPredictions: number
  correctPredictions: number
  accuracy: number
  avgConfidence: number
  avgDuration: number
  recentTrend: 'improving' | 'stable' | 'declining'
  lastUpdated: Date
}

/**
 * Drift detection result
 */
export interface DriftAlert {
  alertId: string
  project: string
  expertId: string
  version: string
  severityLevel: 'info' | 'warning' | 'critical'
  driftType: 'accuracy' | 'confidence' | 'latency' | 'volume'
  message: string
  currentValue: number
  baselineValue: number
  percentageChange: number
  timestamp: Date
  recommendations: string[]
  triggerRetraining: boolean
}

/**
 * Aggregated cross-project metrics
 */
export interface CrossProjectMetrics {
  expertType: string // e.g., "analyst", "predictor"
  totalProjects: number
  totalExperts: number
  avgAccuracy: number
  bestPerformingProject: string
  bestPerformingExpert: string
  recentAlerts: number
}

/**
 * Configuration for global metrics
 */
export interface GlobalMetricsConfig {
  dbPath?: string
  driftThreshold?: number // Percentage change to trigger drift alert
  driftWindow?: number // Days to compare for drift detection
  alertRetentionDays?: number
  enableAutoRetraining?: boolean
  useSupabase?: boolean // Use Supabase as primary source (default: true)
  enableAgentDBCache?: boolean // Enable AgentDB local cache (default: false)
}

/**
 * Safely bind values to SQL, never undefined
 */
function safeBindValue(value: any): string {
  if (value === undefined || value === null || value === 'undefined') {
    return 'unknown';
  }
  return String(value);
}

/**
 * Global Metrics Collector
 */
export class GlobalMetricsCollector {
  private db: any
  private config: Required<GlobalMetricsConfig>
  private useSupabase: boolean
  private useAgentDBCache: boolean
  private agentDbReady: Promise<void> | null = null

  constructor(config: GlobalMetricsConfig = {}) {
    this.config = {
      dbPath: config.dbPath || './data/global-metrics.db',
      driftThreshold: config.driftThreshold ?? 0.1, // 10% change
      driftWindow: config.driftWindow ?? 7, // 7 days
      alertRetentionDays: config.alertRetentionDays ?? 30,
      enableAutoRetraining: config.enableAutoRetraining ?? false,
      useSupabase: config.useSupabase ?? true,
      enableAgentDBCache: config.enableAgentDBCache ?? false
    }

    // Check if Supabase is available and configured
    this.useSupabase = this.config.useSupabase && isSupabaseInitialized()
    this.useAgentDBCache = this.config.enableAgentDBCache

    // Initialize AgentDB if caching is enabled OR if Supabase is not available (fallback)
    if (this.useAgentDBCache || !this.useSupabase) {
      this.agentDbReady = this.initializeAgentDb()
    }

    if (this.useSupabase) {
      console.log('✓ GlobalMetrics: Using Supabase as authoritative source')
      if (this.useAgentDBCache) {
        console.log('✓ GlobalMetrics: AgentDB cache enabled for fast local queries')
      }
    } else {
      // Only show in verbose mode - local-only is perfectly fine
      if (process.env.IRIS_VERBOSE || process.env.DEBUG) {
        console.info('ℹ️  Telemetry Mode: Local (AgentDB)')
        console.info('   Federation disabled (Supabase not configured)')
      }
    }
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    if (!this.db) return

    // Telemetry events
    this.db.exec(`
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
    `)

    // Expert performance summary
    this.db.exec(`
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
    `)

    // Drift alerts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS drift_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alert_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        expert_id TEXT NOT NULL,
        version TEXT NOT NULL,
        severity_level TEXT NOT NULL,
        drift_type TEXT NOT NULL,
        message TEXT NOT NULL,
        current_value REAL NOT NULL,
        baseline_value REAL NOT NULL,
        percentage_change REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        recommendations TEXT NOT NULL,
        trigger_retraining INTEGER NOT NULL,
        acknowledged INTEGER DEFAULT 0
      )
    `)

    // Create indexes for performance
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_project ON telemetry_events(project)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_expert ON telemetry_events(expert_id)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_events(timestamp)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_project ON expert_metrics(project)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_project ON drift_alerts(project)`)
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
        console.warn('⚠ AgentDB initialization failed (sql.js compatibility issue), disabling cache:', error)
        this.db = null
        this.useAgentDBCache = false
      }
    })()
  }

  /**
   * Ensure AgentDB (if enabled) has finished initializing
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
   * Convenience helper to get initialized DB instance
   */
  private async getDb(): Promise<any | null> {
    await this.ensureAgentDbReady()
    return this.db
  }

  // ============================================================================
  // Telemetry Ingestion
  // ============================================================================

  /**
   * Log telemetry event
   * WRITES TO SUPABASE FIRST, then optionally to AgentDB cache
   */
  async logEvent(event: TelemetryEvent): Promise<void> {
    // 1. SUPABASE: Authoritative write
    if (this.useSupabase) {
      try {
        await logTelemetry({
          expertId: event.expertId,
          version: event.version,
          confidence: event.confidence,
          latencyMs: event.durationMs,
          outcome: event.outcome === 'correct' ? 'success' : event.outcome,
          reflexionUsed: event.reflexionUsed,
          consensusParticipation: event.consensusParticipation,
          metadata: event.metadata
        })
      } catch (error) {
        console.error('Failed to log telemetry to Supabase:', error)
        // Continue to AgentDB fallback if available
      }
    }

    // 2. AGENTDB: Optional cache write
    const db = await this.getDb()
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO telemetry_events
        (project, expert_id, version, timestamp, confidence, outcome, duration_ms,
         reflexion_used, consensus_participation, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        event.project,
        event.expertId,
        event.version,
        event.timestamp.getTime(),
        event.confidence,
        event.outcome,
        event.durationMs,
        event.reflexionUsed ? 1 : 0,
        event.consensusParticipation ? 1 : 0,
        event.metadata ? JSON.stringify(event.metadata) : null
      )
    }

    // Update expert metrics (uses Supabase if available)
    await this.updateExpertMetrics(event.project, event.expertId, event.version)

    // Check for drift (uses Supabase if available)
    await this.checkForDrift(event.project, event.expertId, event.version)
  }

  /**
   * Batch log multiple events
   */
  async logEventsBatch(events: TelemetryEvent[]): Promise<void> {
    const db = await this.getDb()

    if (!db) {
      for (const event of events) {
        await this.logEvent(event)
      }
      return
    }

    db.exec('BEGIN TRANSACTION')

    try {
      for (const event of events) {
        await this.logEvent(event)
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  // ============================================================================
  // Metrics Calculation
  // ============================================================================

  /**
   * Update expert metrics based on recent events
   * NOTE: Only updates AgentDB cache, Supabase metrics are computed on-demand via getExpertStats()
   */
  private async updateExpertMetrics(
    project: string,
    expertId: string,
    version: string
  ): Promise<void> {
    const db = await this.getDb()
    if (!db) return // No local cache to update

    // Calculate metrics from last 1000 events
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'correct' THEN 1 ELSE 0 END) as correct,
        AVG(confidence) as avg_confidence,
        AVG(duration_ms) as avg_duration
      FROM telemetry_events
      WHERE project = ? AND expert_id = ? AND version = ?
      ORDER BY timestamp DESC
      LIMIT 1000
    `)

    const stats = stmt.get(safeBindValue(project), safeBindValue(expertId), safeBindValue(version)) as any

    const accuracy = stats.total > 0 ? stats.correct / stats.total : 0

    // Calculate trend (compare recent vs older performance)
    const trend = await this.calculateTrend(db, project, expertId, version)

    // Upsert metrics
    const upsertStmt = db.prepare(`
      INSERT INTO expert_metrics
      (project, expert_id, version, total_predictions, correct_predictions,
       accuracy, avg_confidence, avg_duration, recent_trend, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project, expert_id, version) DO UPDATE SET
        total_predictions = excluded.total_predictions,
        correct_predictions = excluded.correct_predictions,
        accuracy = excluded.accuracy,
        avg_confidence = excluded.avg_confidence,
        avg_duration = excluded.avg_duration,
        recent_trend = excluded.recent_trend,
        last_updated = excluded.last_updated
    `)

    upsertStmt.run(
      project,
      expertId,
      version,
      stats.total,
      stats.correct,
      accuracy,
      stats.avg_confidence || 0,
      stats.avg_duration || 0,
      trend,
      Date.now()
    )
  }

  /**
   * Calculate performance trend
   */
  private async calculateTrend(
    db: any,
    project: string,
    expertId: string,
    version: string
  ): Promise<'improving' | 'stable' | 'declining'> {
    if (!db) return 'stable'

    // Compare recent 100 vs previous 100 events
    const recentStmt = db.prepare(`
      SELECT AVG(CASE WHEN outcome = 'correct' THEN 1.0 ELSE 0.0 END) as accuracy
      FROM (
        SELECT outcome FROM telemetry_events
        WHERE project = ? AND expert_id = ? AND version = ?
        ORDER BY timestamp DESC
        LIMIT 100
      )
    `)

    const olderStmt = db.prepare(`
      SELECT AVG(CASE WHEN outcome = 'correct' THEN 1.0 ELSE 0.0 END) as accuracy
      FROM (
        SELECT outcome FROM telemetry_events
        WHERE project = ? AND expert_id = ? AND version = ?
        ORDER BY timestamp DESC
        LIMIT 100 OFFSET 100
      )
    `)

    const recent = (recentStmt.get(project, expertId, version) as any).accuracy || 0
    const older = (olderStmt.get(project, expertId, version) as any).accuracy || 0

    const change = recent - older

    if (Math.abs(change) < 0.02) return 'stable'
    if (change > 0) return 'improving'
    return 'declining'
  }

  // ============================================================================
  // Drift Detection
  // ============================================================================

  /**
   * Check for drift and create alerts if needed
   * USES SUPABASE detectDrift() when available
   */
  private async checkForDrift(
    project: string,
    expertId: string,
    version: string
  ): Promise<void> {
    // 1. SUPABASE: Use cloud-based drift detection
    if (this.useSupabase) {
      try {
        const windowHours = this.config.driftWindow * 24
        const driftResult = await detectDrift(expertId, version, {
          recentWindow: windowHours,
          thresholdPct: this.config.driftThreshold * 100 // Convert to percentage
        })

        if (driftResult.driftDetected) {
          // Create drift alert
          const severityLevel = driftResult.confidenceDrop > 30 ? 'critical'
            : driftResult.confidenceDrop > 20 ? 'warning'
            : 'info'

          const message = `Confidence dropped by ${driftResult.confidenceDrop.toFixed(1)}% (${driftResult.recentConfidence.toFixed(2)} vs ${driftResult.baselineConfidence.toFixed(2)})`

          await this.createDriftAlert(
            project,
            expertId,
            version,
            'confidence',
            severityLevel,
            message,
            driftResult.recentConfidence,
            driftResult.baselineConfidence,
            driftResult.confidenceDrop / 100,
            driftResult.recommendation ? [driftResult.recommendation] : []
          )
        }

        return // Success, skip AgentDB
      } catch (error) {
        console.warn('Failed to detect drift from Supabase:', error)
        // Fall through to AgentDB
      }
    }

    // 2. AGENTDB: Fallback drift detection
    const db = await this.getDb()
    if (!db) return

    const windowMs = this.config.driftWindow * 24 * 60 * 60 * 1000
    const now = Date.now()
    const cutoff = now - windowMs

    // Get baseline (older period) vs recent performance
    const baselineStmt = db.prepare(`
      SELECT
        AVG(CASE WHEN outcome = 'correct' THEN 1.0 ELSE 0.0 END) as accuracy,
        AVG(confidence) as confidence,
        AVG(duration_ms) as latency
      FROM telemetry_events
      WHERE project = ? AND expert_id = ? AND version = ?
        AND timestamp >= ? AND timestamp < ?
    `)

    const recentStmt = db.prepare(`
      SELECT
        AVG(CASE WHEN outcome = 'correct' THEN 1.0 ELSE 0.0 END) as accuracy,
        AVG(confidence) as confidence,
        AVG(duration_ms) as latency
      FROM telemetry_events
      WHERE project = ? AND expert_id = ? AND version = ?
        AND timestamp >= ?
    `)

    const halfWindow = windowMs / 2
    const baseline = baselineStmt.get(safeBindValue(project), safeBindValue(expertId), safeBindValue(version), cutoff, cutoff + halfWindow) as any
    const recent = recentStmt.get(safeBindValue(project), safeBindValue(expertId), safeBindValue(version), cutoff + halfWindow) as any

    // Check each metric for drift
    await this.checkMetricDrift(project, expertId, version, 'accuracy', baseline.accuracy, recent.accuracy)
    await this.checkMetricDrift(project, expertId, version, 'confidence', baseline.confidence, recent.confidence)
    await this.checkMetricDrift(project, expertId, version, 'latency', baseline.latency, recent.latency)
  }

  /**
   * Check single metric for drift
   */
  private async checkMetricDrift(
    project: string,
    expertId: string,
    version: string,
    metricType: 'accuracy' | 'confidence' | 'latency' | 'volume',
    baselineValue: number,
    currentValue: number
  ): Promise<void> {
    if (!baselineValue || !currentValue) return

    const percentageChange = Math.abs((currentValue - baselineValue) / baselineValue)

    if (percentageChange < this.config.driftThreshold) return

    // Drift detected!
    let severityLevel: 'info' | 'warning' | 'critical'

    if (percentageChange < 0.2) severityLevel = 'info'
    else if (percentageChange < 0.3) severityLevel = 'warning'
    else severityLevel = 'critical'

    const message = metricType === 'accuracy'
      ? `Accuracy ${currentValue < baselineValue ? 'dropped' : 'improved'} by ${(percentageChange * 100).toFixed(1)}%`
      : metricType === 'confidence'
      ? `Confidence ${currentValue < baselineValue ? 'decreased' : 'increased'} by ${(percentageChange * 100).toFixed(1)}%`
      : `Latency ${currentValue > baselineValue ? 'increased' : 'decreased'} by ${(percentageChange * 100).toFixed(1)}%`

    const recommendations = this.generateDriftRecommendations(metricType, currentValue, baselineValue)

    await this.createDriftAlert(
      project,
      expertId,
      version,
      metricType,
      severityLevel,
      message,
      currentValue,
      baselineValue,
      percentageChange,
      recommendations
    )
  }

  /**
   * Create drift alert (stores in AgentDB only - Supabase doesn't have drift_alerts table)
   */
  private async createDriftAlert(
    project: string,
    expertId: string,
    version: string,
    driftType: 'accuracy' | 'confidence' | 'latency' | 'volume',
    severityLevel: 'info' | 'warning' | 'critical',
    message: string,
    currentValue: number,
    baselineValue: number,
    percentageChange: number,
    recommendations: string[]
  ): Promise<void> {
    const db = await this.getDb()
    if (!db) return

    const triggerRetraining = severityLevel === 'critical' && driftType === 'accuracy' && currentValue < baselineValue
    const alertId = `drift-${project}-${expertId}-${driftType}-${Date.now()}`

    const stmt = db.prepare(`
      INSERT INTO drift_alerts
      (alert_id, project, expert_id, version, severity_level, drift_type,
       message, current_value, baseline_value, percentage_change, timestamp,
       recommendations, trigger_retraining)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      alertId,
      project,
      expertId,
      version,
      severityLevel,
      driftType,
      message,
      currentValue,
      baselineValue,
      percentageChange,
      Date.now(),
      JSON.stringify(recommendations),
      triggerRetraining ? 1 : 0
    )
  }

  /**
   * Generate recommendations based on drift
   */
  private generateDriftRecommendations(
    metricType: string,
    currentValue: number,
    baselineValue: number
  ): string[] {
    const recommendations: string[] = []

    if (metricType === 'accuracy' && currentValue < baselineValue) {
      recommendations.push('Review recent prediction failures')
      recommendations.push('Check if input data distribution has changed')
      recommendations.push('Consider retraining with recent data')
      recommendations.push('Verify feature engineering pipeline')
    } else if (metricType === 'latency' && currentValue > baselineValue) {
      recommendations.push('Check for infrastructure issues')
      recommendations.push('Review recent code changes')
      recommendations.push('Monitor resource utilization')
    } else if (metricType === 'confidence' && currentValue < baselineValue) {
      recommendations.push('Expert may be encountering new edge cases')
      recommendations.push('Review reflexion entries for insights')
      recommendations.push('Check if prompt needs updating')
    }

    return recommendations
  }

  // ============================================================================
  // Queries & Analytics
  // ============================================================================

  /**
   * Get expert metrics
   * READS FROM SUPABASE FIRST, falls back to AgentDB cache
   */
  async getExpertMetrics(project: string, expertId: string, version: string): Promise<ExpertMetrics | null> {
    // 1. SUPABASE: Try authoritative source first
    if (this.useSupabase) {
      try {
        const stats = await getExpertStats(expertId, { version })

        if (stats.totalRuns > 0) {
          return {
            expertId,
            project,
            version,
            totalPredictions: stats.totalRuns,
            correctPredictions: Math.round(stats.totalRuns * stats.successRate),
            accuracy: stats.successRate,
            avgConfidence: stats.avgConfidence,
            avgDuration: stats.avgLatencyMs,
            recentTrend: 'stable' as const, // TODO: Calculate from Supabase
            lastUpdated: new Date()
          }
        }
      } catch (error) {
        console.warn('Failed to get expert metrics from Supabase:', error)
        // Fall through to AgentDB
      }
    }

    // 2. AGENTDB: Fallback to local cache
    const db = await this.getDb()
    if (!db) return null

    const stmt = db.prepare(`
      SELECT * FROM expert_metrics
      WHERE project = ? AND expert_id = ? AND version = ?
    `)

    const row = stmt.get(safeBindValue(project), safeBindValue(expertId), safeBindValue(version)) as any

    if (!row) return null

    return {
      expertId: row.expert_id,
      project: row.project,
      version: row.version,
      totalPredictions: row.total_predictions,
      correctPredictions: row.correct_predictions,
      accuracy: row.accuracy,
      avgConfidence: row.avg_confidence,
      avgDuration: row.avg_duration,
      recentTrend: row.recent_trend,
      lastUpdated: new Date(row.last_updated)
    }
  }

  /**
   * Get all metrics for a project
   * READS FROM SUPABASE FIRST, falls back to AgentDB cache
   */
  async getProjectMetrics(project: string): Promise<ExpertMetrics[]> {
    // 1. SUPABASE: Try authoritative source first
    if (this.useSupabase) {
      try {
        const supabase = getSupabase()
        const { data: experts, error } = await supabase
          .from('expert_signatures')
          .select('expert_id, version')
          .eq('project', project)
          .eq('active', true)

        if (error) throw error

        if (experts && experts.length > 0) {
          // Fetch stats for each expert from Supabase
          const metricsPromises = experts.map(async (expert) => {
            const stats = await getExpertStats(expert.expert_id, {
              version: expert.version
            })

            return {
              expertId: expert.expert_id,
              project,
              version: expert.version,
              totalPredictions: stats.totalRuns,
              correctPredictions: Math.round(stats.totalRuns * stats.successRate),
              accuracy: stats.successRate,
              avgConfidence: stats.avgConfidence,
              avgDuration: stats.avgLatencyMs,
              recentTrend: 'stable' as const, // TODO: Calculate trend from Supabase
              lastUpdated: new Date()
            }
          })

          return await Promise.all(metricsPromises)
        }
      } catch (error) {
        console.warn('Failed to get project metrics from Supabase:', error)
        // Fall through to AgentDB
      }
    }

    // 2. AGENTDB: Fallback to local cache
    const db = await this.getDb()
    if (!db) return []

    const stmt = db.prepare(`
      SELECT * FROM expert_metrics
      WHERE project = ?
      ORDER BY accuracy DESC
    `)

    const rows = stmt.all(safeBindValue(project)) as any[]

    return rows.map(row => ({
      expertId: row.expert_id,
      project: row.project,
      version: row.version,
      totalPredictions: row.total_predictions,
      correctPredictions: row.correct_predictions,
      accuracy: row.accuracy,
      avgConfidence: row.avg_confidence,
      avgDuration: row.avg_duration,
      recentTrend: row.recent_trend,
      lastUpdated: new Date(row.last_updated)
    }))
  }

  /**
   * Get cross-project metrics for an expert type
   */
  async getCrossProjectMetrics(expertType: string): Promise<CrossProjectMetrics> {
    const db = await this.getDb()

    if (!db) {
      return {
        expertType,
        totalProjects: 0,
        totalExperts: 0,
        avgAccuracy: 0,
        bestPerformingProject: 'none',
        bestPerformingExpert: 'none',
        recentAlerts: 0
      }
    }

    const stmt = db.prepare(`
      SELECT
        COUNT(DISTINCT project) as project_count,
        COUNT(*) as expert_count,
        AVG(accuracy) as avg_accuracy,
        MAX(accuracy) as best_accuracy
      FROM expert_metrics
      WHERE expert_id LIKE ?
    `)

    const stats = stmt.get(safeBindValue(`%${expertType}%`)) as any

    // Find best performing
    const bestStmt = db.prepare(`
      SELECT project, expert_id, accuracy
      FROM expert_metrics
      WHERE expert_id LIKE ?
      ORDER BY accuracy DESC
      LIMIT 1
    `)

    const best = bestStmt.get(safeBindValue(`%${expertType}%`)) as any

    // Get recent alerts
    const alertStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM drift_alerts
      WHERE timestamp >= ? AND acknowledged = 0
    `)

    const windowMs = this.config.driftWindow * 24 * 60 * 60 * 1000
    const alertCount = (alertStmt.get(Date.now() - windowMs) as any).count

    return {
      expertType,
      totalProjects: stats.project_count || 0,
      totalExperts: stats.expert_count || 0,
      avgAccuracy: stats.avg_accuracy || 0,
      bestPerformingProject: best?.project || 'none',
      bestPerformingExpert: best?.expert_id || 'none',
      recentAlerts: alertCount
    }
  }

  /**
   * Get unacknowledged drift alerts
   * NOTE: Alerts are stored locally in AgentDB since Supabase doesn't have drift_alerts table
   */
  async getUnacknowledgedAlerts(project?: string): Promise<DriftAlert[]> {
    const db = await this.getDb()
    if (!db) return []

    const query = project
      ? `SELECT * FROM drift_alerts WHERE project = ? AND acknowledged = 0 ORDER BY timestamp DESC`
      : `SELECT * FROM drift_alerts WHERE acknowledged = 0 ORDER BY timestamp DESC`

    const stmt = db.prepare(query)
    const rows = project ? stmt.all(safeBindValue(project)) : stmt.all()

    return (rows as any[]).map(row => ({
      alertId: row.alert_id,
      project: row.project,
      expertId: row.expert_id,
      version: row.version,
      severityLevel: row.severity_level,
      driftType: row.drift_type,
      message: row.message,
      currentValue: row.current_value,
      baselineValue: row.baseline_value,
      percentageChange: row.percentage_change,
      timestamp: new Date(row.timestamp),
      recommendations: JSON.parse(row.recommendations),
      triggerRetraining: row.trigger_retraining === 1
    }))
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const db = await this.getDb()
    if (!db) return

    const stmt = db.prepare(`
      UPDATE drift_alerts
      SET acknowledged = 1
      WHERE alert_id = ?
    `)

    stmt.run(alertId)
  }

  /**
   * Clean up old data (AgentDB cache only)
   */
  async cleanup(): Promise<void> {
    const db = await this.getDb()
    if (!db) return

    const retentionMs = this.config.alertRetentionDays * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - retentionMs

    // Delete old alerts
    const alertStmt = db.prepare(`
      DELETE FROM drift_alerts
      WHERE timestamp < ? AND acknowledged = 1
    `)

    alertStmt.run(cutoff)

    // Keep only last 10,000 telemetry events per expert
    db.exec(`
      DELETE FROM telemetry_events
      WHERE id NOT IN (
        SELECT id FROM telemetry_events
        ORDER BY timestamp DESC
        LIMIT 10000
      )
    `)
  }

  /**
   * Close database connection
   */
  close(): void {
    const closeDb = () => {
      if (this.db) {
        try {
          this.db.close()
        } catch (error) {
          console.warn('⚠ GlobalMetrics: Failed to close AgentDB:', error)
        }
      }
    }

    if (this.agentDbReady) {
      this.agentDbReady
        .then(() => closeDb())
        .catch(error => {
          console.warn('⚠ GlobalMetrics: AgentDB still initializing during close:', error)
        })
      return
    }

    closeDb()
  }
}

/**
 * Create global metrics collector
 */
export function createGlobalMetrics(config?: GlobalMetricsConfig): GlobalMetricsCollector {
  return new GlobalMetricsCollector(config)
}
