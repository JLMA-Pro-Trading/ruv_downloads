/**
 * ReasoningBank Learning Integration
 *
 * Implements trajectory-based learning for self-improving agents using AgentDB's
 * ReasoningBank. Stores learning trajectories, performs pattern recognition,
 * and enables agents to learn from past experiences.
 *
 * @module reasoning-bank
 * @version 1.0.0
 */

import type { OptimizationResult } from '../clients/python-optimizer-client.js'
import { AgentDBManager } from './agentdb-integration.js'
import { AgentDBSingleton } from './agentdb-singleton.js'

// ============================================================================
// Types
// ============================================================================

export interface LearningTrajectory {
  id: string
  timestamp: string
  expert_role: string
  context: Record<string, any>
  action: string
  outcome: Record<string, any>
  verdict: 'success' | 'partial' | 'failure'
  confidence: number
  metadata?: Record<string, any>
}

export interface TrajectoryPattern {
  pattern_id: string
  pattern_type: 'success' | 'failure' | 'optimization'
  frequency: number
  avg_confidence: number
  contexts: Array<Record<string, any>>
  actions: string[]
  outcomes: Array<Record<string, any>>
}

export interface LearningInsights {
  expert_role: string
  total_trajectories: number
  success_rate: number
  avg_confidence: number
  top_patterns: TrajectoryPattern[]
  recent_improvements: Array<{
    timestamp: string
    improvement: number
    context: string
  }>
}

// ============================================================================
// ReasoningBank Manager
// ============================================================================

export class ReasoningBankManager {
  private db: any | null = null
  private dbReady: Promise<void> | null = null
  private agentDB: AgentDBManager

  constructor(dbPath: string = './data/reasoning-bank.db') {
    this.dbReady = this.initializeDatabase(dbPath)

    this.agentDB = new AgentDBManager({
      dbPath,
      enableCausalReasoning: true,
      enableReflexion: true,
      enableSkillLibrary: true
    })
  }

  /**
   * Initialize database asynchronously using singleton
   */
  private initializeDatabase(dbPath: string): Promise<void> {
    return (async () => {
      try {
        this.db = await AgentDBSingleton.getInstance(dbPath)
        this.initializeTables()
      } catch (error) {
        console.warn('⚠ ReasoningBankManager: Database initialization failed (sql.js compatibility issue):', error)
        this.db = null
      }
    })()
  }

  /**
   * Ensure database is ready before use
   */
  private async ensureDbReady(): Promise<void> {
    const ready = this.dbReady
    if (ready) {
      try {
        await ready
      } finally {
        if (this.dbReady === ready) {
          this.dbReady = null
        }
      }
    }
  }

  /**
   * Get database instance after ensuring it's ready
   */
  private async getDb(): Promise<any | null> {
    await this.ensureDbReady()
    return this.db
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    if (!this.db) return

    try {
      // Create trajectories table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS learning_trajectories (
          id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          expert_role TEXT NOT NULL,
          context TEXT NOT NULL,
          action TEXT NOT NULL,
          outcome TEXT NOT NULL,
          verdict TEXT NOT NULL,
          confidence REAL NOT NULL,
          metadata TEXT,

          created_at TEXT DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT valid_verdict CHECK (verdict IN ('success', 'partial', 'failure'))
        )
      `)

      // Create patterns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS trajectory_patterns (
          pattern_id TEXT PRIMARY KEY,
          expert_role TEXT NOT NULL,
          pattern_type TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          avg_confidence REAL NOT NULL,
          contexts TEXT NOT NULL,
          actions TEXT NOT NULL,
          outcomes TEXT NOT NULL,

          first_seen TEXT DEFAULT CURRENT_TIMESTAMP,
          last_seen TEXT DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT valid_pattern_type CHECK (pattern_type IN ('success', 'failure', 'optimization'))
        )
      `)

      // Create indexes
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_trajectories_expert ON learning_trajectories(expert_role);
        CREATE INDEX IF NOT EXISTS idx_trajectories_verdict ON learning_trajectories(verdict);
        CREATE INDEX IF NOT EXISTS idx_trajectories_timestamp ON learning_trajectories(timestamp);
        CREATE INDEX IF NOT EXISTS idx_patterns_expert ON trajectory_patterns(expert_role);
        CREATE INDEX IF NOT EXISTS idx_patterns_type ON trajectory_patterns(pattern_type);
      `)
    } catch (error) {
      console.warn('⚠ ReasoningBankManager: Table initialization failed (sql.js compatibility issue):', error)
      this.db = null
    }

    console.log('✅ ReasoningBank tables initialized')
  }

  /**
   * Store a learning trajectory
   */
  async storeTrajectory(trajectory: LearningTrajectory): Promise<void> {
    const db = await this.getDb()
    if (!db) return

    const stmt = db.prepare(`
      INSERT INTO learning_trajectories (
        id, timestamp, expert_role, context, action, outcome, verdict, confidence, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      trajectory.id,
      trajectory.timestamp,
      trajectory.expert_role,
      JSON.stringify(trajectory.context),
      trajectory.action,
      JSON.stringify(trajectory.outcome),
      trajectory.verdict,
      trajectory.confidence,
      trajectory.metadata ? JSON.stringify(trajectory.metadata) : null
    )

    console.log(`📈 Stored learning trajectory: ${trajectory.id}`)
  }

  /**
   * Store optimization result as learning trajectory
   */
  async storeOptimizationTrajectory(
    expertRole: string,
    optimization: OptimizationResult
  ): Promise<void> {
    const trajectory: LearningTrajectory = {
      id: `opt-${expertRole}-${Date.now()}`,
      timestamp: optimization.timestamp,
      expert_role: expertRole,
      context: {
        version: optimization.version,
        num_examples: optimization.performance_metrics.num_examples,
        trials: optimization.trials_completed
      },
      action: 'mipro_optimization',
      outcome: {
        quality_before: optimization.quality_before,
        quality_after: optimization.quality_after,
        improvement: optimization.improvement,
        num_demos: optimization.few_shot_examples.length
      },
      verdict: optimization.improvement > 0.10 ? 'success' : 'partial',
      confidence: optimization.quality_after,
      metadata: {
        optimization_result: true
      }
    }

    await this.storeTrajectory(trajectory)
  }

  /**
   * Get all trajectories for an expert
   */
  async getTrajectories(
    expertRole: string,
    options?: {
      limit?: number
      verdict?: 'success' | 'partial' | 'failure'
      since?: string
    }
  ): Promise<LearningTrajectory[]> {
    const db = await this.getDb()
    if (!db) return []

    let query = `
      SELECT * FROM learning_trajectories
      WHERE expert_role = ?
    `

    const params: any[] = [expertRole]

    if (options?.verdict) {
      query += ` AND verdict = ?`
      params.push(options.verdict)
    }

    if (options?.since) {
      query += ` AND timestamp >= ?`
      params.push(options.since)
    }

    query += ` ORDER BY timestamp DESC`

    if (options?.limit) {
      query += ` LIMIT ?`
      params.push(options.limit)
    }

    const rows = db.prepare(query).all(...params)

    return rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      expert_role: row.expert_role,
      context: JSON.parse(row.context),
      action: row.action,
      outcome: JSON.parse(row.outcome),
      verdict: row.verdict,
      confidence: row.confidence,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }))
  }

  /**
   * Analyze patterns in trajectories
   */
  async analyzePatterns(expertRole: string): Promise<TrajectoryPattern[]> {
    const trajectories = await this.getTrajectories(expertRole)

    // Group by action + verdict
    const patternMap = new Map<string, {
      contexts: any[]
      outcomes: any[]
      confidences: number[]
      count: number
    }>()

    trajectories.forEach(traj => {
      const key = `${traj.action}-${traj.verdict}`

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          contexts: [],
          outcomes: [],
          confidences: [],
          count: 0
        })
      }

      const pattern = patternMap.get(key)!
      pattern.contexts.push(traj.context)
      pattern.outcomes.push(traj.outcome)
      pattern.confidences.push(traj.confidence)
      pattern.count++
    })

    // Convert to TrajectoryPattern objects
    const patterns: TrajectoryPattern[] = []

    patternMap.forEach((data, key) => {
      const [action, verdict] = key.split('-')

      patterns.push({
        pattern_id: `${expertRole}-${key}`,
        pattern_type: verdict as 'success' | 'failure' | 'optimization',
        frequency: data.count,
        avg_confidence: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length,
        contexts: data.contexts,
        actions: [action],
        outcomes: data.outcomes
      })
    })

    // Sort by frequency
    patterns.sort((a, b) => b.frequency - a.frequency)

    return patterns
  }

  /**
   * Get learning insights for an expert
   */
  async getInsights(expertRole: string): Promise<LearningInsights> {
    const trajectories = await this.getTrajectories(expertRole)

    if (trajectories.length === 0) {
      return {
        expert_role: expertRole,
        total_trajectories: 0,
        success_rate: 0,
        avg_confidence: 0,
        top_patterns: [],
        recent_improvements: []
      }
    }

    const successes = trajectories.filter(t => t.verdict === 'success').length
    const successRate = successes / trajectories.length

    const avgConfidence = trajectories.reduce((sum, t) => sum + t.confidence, 0) / trajectories.length

    const patterns = await this.analyzePatterns(expertRole)
    const topPatterns = patterns.slice(0, 5)

    // Find recent improvements (optimization trajectories)
    const recentImprovements = trajectories
      .filter(t => t.action === 'mipro_optimization' && t.verdict === 'success')
      .slice(0, 5)
      .map(t => ({
        timestamp: t.timestamp,
        improvement: (t.outcome as any).improvement || 0,
        context: (t.context as any).version || 'unknown'
      }))

    return {
      expert_role: expertRole,
      total_trajectories: trajectories.length,
      success_rate: successRate,
      avg_confidence: avgConfidence,
      top_patterns: topPatterns,
      recent_improvements: recentImprovements
    }
  }

  /**
   * Get success patterns that can inform future optimizations
   */
  async getSuccessPatterns(expertRole: string): Promise<{
    high_confidence_contexts: Array<Record<string, any>>
    successful_actions: string[]
    avg_improvement: number
  }> {
    const successTrajectories = await this.getTrajectories(expertRole, {
      verdict: 'success'
    })

    const highConfidenceContexts = successTrajectories
      .filter(t => t.confidence > 0.7)
      .map(t => t.context)

    const successfulActions = [...new Set(successTrajectories.map(t => t.action))]

    const improvements = successTrajectories
      .filter(t => t.outcome && (t.outcome as any).improvement)
      .map(t => (t.outcome as any).improvement)

    const avgImprovement = improvements.length > 0
      ? improvements.reduce((a, b) => a + b, 0) / improvements.length
      : 0

    return {
      high_confidence_contexts: highConfidenceContexts,
      successful_actions: successfulActions,
      avg_improvement: avgImprovement
    }
  }

  /**
   * Record a causal decision using AgentDB
   */
  async recordCausalDecision(
    expertRole: string,
    input: Record<string, any>,
    output: any,
    reasoning: string[],
    causality: { causes: string[]; effects: string[]; confidence: number }
  ): Promise<string> {
    const decisionId = `decision-${Date.now()}-${Math.random().toString(36).slice(2)}`

    await this.agentDB.recordCausalDecision({
      id: decisionId,
      timestamp: new Date(),
      expertId: expertRole,
      input,
      output,
      reasoning,
      causality
    })

    return decisionId
  }

  /**
   * Get causal chain for understanding decision dependencies
   */
  async getCausalChain(decisionId: string, depth: number = 3) {
    return this.agentDB.getCausalChain(decisionId, depth)
  }

  /**
   * Add reflexion entry for self-improvement
   */
  async addReflexion(
    expertRole: string,
    experience: string,
    reflection: string,
    insights: string[],
    actionItems: string[]
  ): Promise<void> {
    const reflexionId = `reflexion-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Get related decisions from recent trajectories
    const recentTrajectories = await this.getTrajectories(expertRole, { limit: 10 })
    const relatedDecisions = recentTrajectories.map(t => t.id)

    await this.agentDB.addReflexion({
      id: reflexionId,
      timestamp: new Date(),
      experience,
      reflection,
      insights,
      actionItems,
      relatedDecisions
    })
  }

  /**
   * Get recent reflexions for learning
   */
  async getRecentReflexions(limit: number = 10) {
    return this.agentDB.getRecentReflexions(limit)
  }

  /**
   * Add learned skill to library
   */
  async addLearnedSkill(
    name: string,
    description: string,
    implementation: string,
    prerequisites: string[] = []
  ): Promise<void> {
    const skillId = `skill-${Date.now()}-${Math.random().toString(36).slice(2)}`

    await this.agentDB.addSkill({
      id: skillId,
      name,
      description,
      implementation,
      prerequisites,
      performance: {
        successRate: 0,
        avgLatency: 0,
        usageCount: 0
      },
      examples: []
    })
  }

  /**
   * Get learned skill by name
   */
  async getLearnedSkill(name: string) {
    return this.agentDB.getSkill(name)
  }

  /**
   * List all learned skills
   */
  async listLearnedSkills() {
    return this.agentDB.listSkills()
  }

  /**
   * Get comprehensive statistics including AgentDB features
   */
  async getComprehensiveStats() {
    const db = await this.getDb()
    if (!db) {
      const basicStats = await this.agentDB.getStats()
      return {
        ...basicStats,
        trajectoryCount: 0
      }
    }

    const basicStats = await this.agentDB.getStats()

    // Add trajectory-specific stats
    const allTrajectories = db.prepare(
      'SELECT COUNT(*) as count FROM learning_trajectories'
    ).get() as any

    return {
      ...basicStats,
      trajectoryCount: allTrajectories.count
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
        console.warn('⚠ ReasoningBankManager: Failed to close database:', error)
      }
    }
    this.agentDB.close()
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create ReasoningBank manager instance
 */
export function createReasoningBank(dbPath?: string): ReasoningBankManager {
  return new ReasoningBankManager(dbPath)
}
