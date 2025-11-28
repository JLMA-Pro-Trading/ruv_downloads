/**
 * Consensus Lineage Tracker
 *
 * Tracks expert version contributions to consensus decisions and their outcomes.
 * Enables understanding of which expert combinations and versions produce best results.
 *
 * Features:
 * - Expert version tracking in consensus
 * - Outcome attribution per expert
 * - Consensus pattern analysis
 * - Version diff and impact analysis
 * - Rotation recommendations
 *
 * @module lineage-tracker
 * @version 1.0.0
 */

import { AgentDBSingleton } from '../storage/agentdb-singleton.js'
import {
  recordConsensusLineage,
  getConsensusHistory,
  getExpertParticipationStats,
  isSupabaseInitialized,
  type ExpertContribution,
} from '../supabase/index.js'

/**
 * Expert participation in consensus
 */
export interface ExpertParticipation {
  expertId: string
  version: string
  project: string
  confidence: number
  prediction: any
  reasoning: string[]
  weight: number // Weight in final consensus
}

/**
 * Consensus decision record
 */
export interface ConsensusDecision {
  decisionId: string
  project: string
  timestamp: Date
  participants: ExpertParticipation[]
  finalDecision: any
  consensusScore: number // Agreement level (0-1)
  outcome?: 'correct' | 'incorrect' | 'partial' | 'pending'
  metadata?: Record<string, any>
}

/**
 * Expert version lineage
 */
export interface VersionLineage {
  expertId: string
  version: string
  project: string
  deployedAt: Date
  consensusParticipations: number
  successfulContributions: number
  contributionRate: number // Success rate when participating
  avgWeight: number // Average weight in consensus
  replacedBy?: string // Next version
  retiredAt?: Date
}

/**
 * Consensus pattern
 */
export interface ConsensusPattern {
  patternId: string
  expertCombination: string[] // Sorted expert IDs
  versionCombination: string[] // Corresponding versions
  occurrences: number
  successRate: number
  avgConsensusScore: number
  projects: string[]
}

/**
 * Version impact analysis
 */
export interface VersionImpact {
  expertId: string
  oldVersion: string
  newVersion: string
  changeDate: Date
  impactMetrics: {
    accuracyChange: number
    confidenceChange: number
    consensusScoreChange: number
    participationChange: number
  }
  significance: 'minor' | 'moderate' | 'major'
}

/**
 * Rotation recommendation
 */
export interface RotationRecommendation {
  expertId: string
  currentVersion: string
  recommendedAction: 'keep' | 'update' | 'replace' | 'add_to_ensemble'
  reason: string
  alternativeVersions: Array<{
    version: string
    expectedImprovement: number
    confidence: number
  }>
  priority: 'low' | 'medium' | 'high'
}

/**
 * Configuration for lineage tracker
 */
export interface LineageTrackerConfig {
  dbPath?: string
  minOccurrencesForPattern?: number
  versionComparisonWindow?: number // Days
}

/**
 * Consensus Lineage Tracker
 */
export class ConsensusLineageTracker {
  private db: any
  private config: Required<LineageTrackerConfig>
  private agentDbReady: Promise<void> | null = null

  constructor(config: LineageTrackerConfig = {}) {
    this.config = {
      dbPath: config.dbPath || './data/consensus-lineage.db',
      minOccurrencesForPattern: config.minOccurrencesForPattern ?? 10,
      versionComparisonWindow: config.versionComparisonWindow ?? 14
    }

    this.agentDbReady = this.initializeAgentDb()
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
        console.warn('⚠ ConsensusLineageTracker: AgentDB initialization failed (sql.js compatibility issue):', error)
        this.db = null
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

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    if (!this.db) return
    // Consensus decisions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS consensus_decisions (
        decision_id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        final_decision TEXT NOT NULL,
        consensus_score REAL NOT NULL,
        outcome TEXT,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)

    // Expert participations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS expert_participations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        decision_id TEXT NOT NULL,
        expert_id TEXT NOT NULL,
        version TEXT NOT NULL,
        project TEXT NOT NULL,
        confidence REAL NOT NULL,
        prediction TEXT NOT NULL,
        reasoning TEXT NOT NULL,
        weight REAL NOT NULL,
        FOREIGN KEY (decision_id) REFERENCES consensus_decisions(decision_id)
      )
    `)

    // Version lineage
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS version_lineage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expert_id TEXT NOT NULL,
        version TEXT NOT NULL,
        project TEXT NOT NULL,
        deployed_at INTEGER NOT NULL,
        consensus_participations INTEGER DEFAULT 0,
        successful_contributions INTEGER DEFAULT 0,
        contribution_rate REAL DEFAULT 0.0,
        avg_weight REAL DEFAULT 0.0,
        replaced_by TEXT,
        retired_at INTEGER,
        UNIQUE(expert_id, version, project)
      )
    `)

    // Consensus patterns
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS consensus_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_id TEXT UNIQUE NOT NULL,
        expert_combination TEXT NOT NULL,
        version_combination TEXT NOT NULL,
        occurrences INTEGER DEFAULT 1,
        success_rate REAL DEFAULT 0.0,
        avg_consensus_score REAL DEFAULT 0.0,
        projects TEXT NOT NULL,
        last_seen INTEGER NOT NULL
      )
    `)

    // Create indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_decisions_project ON consensus_decisions(project)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_decisions_timestamp ON consensus_decisions(timestamp)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_participations_expert ON expert_participations(expert_id)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_lineage_expert ON version_lineage(expert_id)`)
  }

  // ============================================================================
  // Consensus Recording
  // ============================================================================

  /**
   * Record a consensus decision
   * DUAL-WRITE: Saves to BOTH Supabase and AgentDB
   */
  async recordConsensus(decision: ConsensusDecision): Promise<void> {
    const contributingExperts: ExpertContribution[] = decision.participants.map(p => ({
      expertId: p.expertId,
      version: p.version,
      vote: p.prediction,
      confidence: p.confidence,
      reasoning: p.reasoning.join(' | '),
    }))

    // Find winning version (highest weight)
    const winningParticipant = decision.participants.reduce((prev, current) =>
      current.weight > prev.weight ? current : prev
    )

    // Write to BOTH stores concurrently
    const results = await Promise.allSettled([
      // Write to local AgentDB (fast, reliable)
      (async () => {
        const db = await this.getDb()
        if (!db) return
        const decisionStmt = db.prepare(`
          INSERT OR REPLACE INTO consensus_decisions
          (decision_id, project, timestamp, final_decision, consensus_score, outcome, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)

        decisionStmt.run(
          decision.decisionId,
          decision.project,
          decision.timestamp.getTime(),
          JSON.stringify(decision.finalDecision),
          decision.consensusScore,
          decision.outcome || 'pending',
          decision.metadata ? JSON.stringify(decision.metadata) : null
        )

        const participationStmt = db.prepare(`
          INSERT INTO expert_participations
          (decision_id, expert_id, version, project, confidence, prediction, reasoning, weight)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)

        for (const participant of decision.participants) {
          participationStmt.run(
            decision.decisionId,
            participant.expertId,
            participant.version,
            participant.project,
            participant.confidence,
            JSON.stringify(participant.prediction),
            JSON.stringify(participant.reasoning),
            participant.weight
          )

          await this.updateVersionLineage(
            participant.expertId,
            participant.version,
            participant.project,
            decision.outcome === 'correct'
          )
        }

        await this.updateConsensusPattern(decision)
      })(),

      // Write to Supabase (cloud, cross-project)
      recordConsensusLineage(
        decision.decisionId,
        contributingExperts,
        decision.finalDecision,
        decision.consensusScore,
        {
          taskId: decision.decisionId,
          winningVersion: winningParticipant.version,
          disagreementScore: 1 - decision.consensusScore,
          reasoningChains: decision.participants.reduce((acc, p) => {
            acc[p.expertId] = { reasoning: p.reasoning, weight: p.weight }
            return acc
          }, {} as Record<string, any>),
          metadata: {
            ...decision.metadata,
            outcome: decision.outcome || 'pending',
            timestamp: decision.timestamp.toISOString(),
          },
        }
      ).catch(err => {
        console.warn('Supabase consensus write failed (non-blocking):', err)
        return null
      })
    ])

    // Log results but don't fail if cloud is down
    const [agentdbResult, supabaseResult] = results
    if (agentdbResult.status === 'rejected') {
      console.error('AgentDB consensus write failed:', agentdbResult.reason)
      throw new Error('Failed to write consensus to local cache')
    }
    if (supabaseResult.status === 'rejected') {
      console.warn('Supabase consensus write failed (continuing):', supabaseResult.reason)
    }
  }

  /**
   * Update consensus outcome
   */
  async updateOutcome(decisionId: string, outcome: 'correct' | 'incorrect' | 'partial'): Promise<void> {
    const db = await this.getDb()
    if (!db) return
    const stmt = db.prepare(`
      UPDATE consensus_decisions
      SET outcome = ?
      WHERE decision_id = ?
    `)

    stmt.run(outcome, decisionId)

    // Update version lineages for participants
    const participants = await this.getDecisionParticipants(decisionId)

    for (const participant of participants) {
      await this.updateVersionLineage(
        participant.expertId,
        participant.version,
        participant.project,
        outcome === 'correct'
      )
    }

    // Update pattern success rate
    await this.recalculatePatternMetrics(decisionId)
  }

  // ============================================================================
  // Version Lineage
  // ============================================================================

  /**
   * Update version lineage tracking
   */
  private async updateVersionLineage(
    expertId: string,
    version: string,
    project: string,
    wasSuccessful: boolean
  ): Promise<void> {
    const db = await this.getDb()
    if (!db) return
    // Check if version exists
    const checkStmt = db.prepare(`
      SELECT * FROM version_lineage
      WHERE expert_id = ? AND version = ? AND project = ?
    `)

    const existing = checkStmt.get(expertId, version, project)

    if (existing) {
      // Update existing
      const updateStmt = db.prepare(`
        UPDATE version_lineage
        SET consensus_participations = consensus_participations + 1,
            successful_contributions = successful_contributions + ?,
            contribution_rate = CAST(successful_contributions AS REAL) / consensus_participations
        WHERE expert_id = ? AND version = ? AND project = ?
      `)

      updateStmt.run(wasSuccessful ? 1 : 0, expertId, version, project)
    } else {
      // Insert new
      const insertStmt = db.prepare(`
        INSERT INTO version_lineage
        (expert_id, version, project, deployed_at, consensus_participations,
         successful_contributions, contribution_rate)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `)

      insertStmt.run(
        expertId,
        version,
        project,
        Date.now(),
        wasSuccessful ? 1 : 0,
        wasSuccessful ? 1.0 : 0.0
      )
    }
  }

  /**
   * Get version lineage for an expert
   * DUAL-READ: Queries BOTH Supabase and AgentDB, merges results
   */
  async getVersionLineage(expertId: string, project?: string): Promise<VersionLineage[]> {
    // Query BOTH sources concurrently
    const [supabaseResults, localResults] = await Promise.allSettled([
      // Query Supabase for cross-project lineage
      (async () => {
        const consensusHistory = await getConsensusHistory(
          project || 'default',
          1000
        )

        const versionMap = new Map<string, VersionLineage>()

        for (const consensus of consensusHistory) {
          const expertContribution = consensus.contributing_experts.find(
            (e: any) => (e.expertId || e.expert_id) === expertId
          )

          if (!expertContribution) continue

          const version = expertContribution.version
          const key = `${expertId}-${version}-${project || consensus.project}`

          if (!versionMap.has(key)) {
            versionMap.set(key, {
              expertId,
              version,
              project: project || consensus.project,
              deployedAt: new Date(consensus.created_at || Date.now()),
              consensusParticipations: 0,
              successfulContributions: 0,
              contributionRate: 0,
              avgWeight: 0,
            })
          }

          const lineage = versionMap.get(key)!
          lineage.consensusParticipations++

          const wasSuccessful =
            JSON.stringify(expertContribution.vote) === JSON.stringify(consensus.final_decision) ||
            consensus.metadata?.outcome === 'correct'

          if (wasSuccessful) {
            lineage.successfulContributions++
          }

          lineage.contributionRate = lineage.successfulContributions / lineage.consensusParticipations
        }

        return Array.from(versionMap.values())
      })().catch(err => {
        console.warn('Supabase lineage query failed:', err)
        return []
      }),

      // Query local AgentDB
      (async () => {
        const query = project
          ? `SELECT * FROM version_lineage WHERE expert_id = ? AND project = ? ORDER BY deployed_at DESC`
          : `SELECT * FROM version_lineage WHERE expert_id = ? ORDER BY deployed_at DESC`

        const db = await this.getDb()
        if (!db) return []
        const stmt = db.prepare(query)
        const rows = project ? stmt.all(expertId, project) : stmt.all(expertId)

        return (rows as any[]).map(row => ({
          expertId: row.expert_id,
          version: row.version,
          project: row.project,
          deployedAt: new Date(row.deployed_at),
          consensusParticipations: row.consensus_participations,
          successfulContributions: row.successful_contributions,
          contributionRate: row.contribution_rate,
          avgWeight: row.avg_weight,
          replacedBy: row.replaced_by,
          retiredAt: row.retired_at ? new Date(row.retired_at) : undefined
        }))
      })()
    ])

    // Merge and deduplicate results, preferring Supabase (more recent cross-project data)
    const cloudLineage = supabaseResults.status === 'fulfilled' ? supabaseResults.value : []
    const localLineage = localResults.status === 'fulfilled' ? localResults.value : []

    // Deduplicate by version key
    const seenKeys = new Set<string>()
    const mergedLineage = [...cloudLineage, ...localLineage].filter(l => {
      const key = `${l.expertId}-${l.version}-${l.project}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })

    // Sort by deployed date
    return mergedLineage.sort(
      (a, b) => b.deployedAt.getTime() - a.deployedAt.getTime()
    )
  }

  /**
   * Mark version as retired
   */
  async retireVersion(
    expertId: string,
    version: string,
    project: string,
    replacedBy: string
  ): Promise<void> {
    const db = await this.getDb()
    if (!db) return
    const stmt = db.prepare(`
      UPDATE version_lineage
      SET retired_at = ?, replaced_by = ?
      WHERE expert_id = ? AND version = ? AND project = ?
    `)

    stmt.run(Date.now(), replacedBy, expertId, version, project)
  }

  // ============================================================================
  // Consensus Patterns
  // ============================================================================

  /**
   * Update or create consensus pattern
   */
  private async updateConsensusPattern(decision: ConsensusDecision): Promise<void> {
    // Create pattern signature
    const expertIds = decision.participants.map(p => p.expertId).sort()
    const versions = decision.participants.map(p => p.version).sort()
    const patternId = `${expertIds.join('-')}_${versions.join('-')}`

    const db = await this.getDb()
    if (!db) return
    // Check if pattern exists
    const checkStmt = db.prepare(`
      SELECT * FROM consensus_patterns WHERE pattern_id = ?
    `)

    const existing = checkStmt.get(patternId)

    if (existing) {
      // Update existing pattern
      const updateStmt = db.prepare(`
        UPDATE consensus_patterns
        SET occurrences = occurrences + 1,
            last_seen = ?
        WHERE pattern_id = ?
      `)

      updateStmt.run(Date.now(), patternId)
    } else {
      // Create new pattern
      const insertStmt = db.prepare(`
        INSERT INTO consensus_patterns
        (pattern_id, expert_combination, version_combination, projects, last_seen)
        VALUES (?, ?, ?, ?, ?)
      `)

      insertStmt.run(
        patternId,
        JSON.stringify(expertIds),
        JSON.stringify(versions),
        JSON.stringify([decision.project]),
        Date.now()
      )
    }

    // Recalculate metrics
    await this.recalculatePatternMetrics(decision.decisionId)
  }

  /**
   * Recalculate pattern metrics
   */
  private async recalculatePatternMetrics(decisionId: string): Promise<void> {
    // Get decision
    const decision = await this.getDecision(decisionId)

    if (!decision) return

    // Calculate pattern ID
    const expertIds = decision.participants.map(p => p.expertId).sort()
    const versions = decision.participants.map(p => p.version).sort()
    const patternId = `${expertIds.join('-')}_${versions.join('-')}`

    // Get all decisions for this pattern
    const patternDecisions = await this.getPatternDecisions(patternId)

    const totalDecisions = patternDecisions.length
    const successfulDecisions = patternDecisions.filter(d => d.outcome === 'correct').length
    const successRate = totalDecisions > 0 ? successfulDecisions / totalDecisions : 0

    const avgConsensusScore =
      patternDecisions.reduce((sum, d) => sum + d.consensusScore, 0) / totalDecisions

    const db = await this.getDb()
    if (!db) return
    // Update pattern
    const updateStmt = db.prepare(`
      UPDATE consensus_patterns
      SET success_rate = ?, avg_consensus_score = ?
      WHERE pattern_id = ?
    `)

    updateStmt.run(successRate, avgConsensusScore, patternId)
  }

  /**
   * Get consensus patterns
   */
  async getConsensusPatterns(minOccurrences?: number): Promise<ConsensusPattern[]> {
    const db = await this.getDb()
    if (!db) return []
    const threshold = minOccurrences ?? this.config.minOccurrencesForPattern

    const stmt = db.prepare(`
      SELECT * FROM consensus_patterns
      WHERE occurrences >= ?
      ORDER BY success_rate DESC, occurrences DESC
    `)

    const rows = stmt.all(threshold) as any[]

    return rows.map(row => ({
      patternId: row.pattern_id,
      expertCombination: JSON.parse(row.expert_combination),
      versionCombination: JSON.parse(row.version_combination),
      occurrences: row.occurrences,
      successRate: row.success_rate,
      avgConsensusScore: row.avg_consensus_score,
      projects: JSON.parse(row.projects)
    }))
  }

  // ============================================================================
  // Version Impact Analysis
  // ============================================================================

  /**
   * Analyze version impact when expert is updated
   */
  async analyzeVersionImpact(
    expertId: string,
    oldVersion: string,
    newVersion: string,
    project: string
  ): Promise<VersionImpact> {
    const windowMs = this.config.versionComparisonWindow * 24 * 60 * 60 * 1000

    // Get metrics for old version (last N days)
    const oldMetrics = await this.getVersionMetrics(expertId, oldVersion, project, windowMs)

    // Get metrics for new version (first N days)
    const newMetrics = await this.getVersionMetrics(expertId, newVersion, project, windowMs)

    const accuracyChange = newMetrics.accuracy - oldMetrics.accuracy
    const confidenceChange = newMetrics.avgConfidence - oldMetrics.avgConfidence
    const consensusScoreChange = newMetrics.avgConsensusScore - oldMetrics.avgConsensusScore
    const participationChange = newMetrics.participations - oldMetrics.participations

    let significance: 'minor' | 'moderate' | 'major'

    if (Math.abs(accuracyChange) > 0.1) significance = 'major'
    else if (Math.abs(accuracyChange) > 0.05) significance = 'moderate'
    else significance = 'minor'

    return {
      expertId,
      oldVersion,
      newVersion,
      changeDate: new Date(),
      impactMetrics: {
        accuracyChange,
        confidenceChange,
        consensusScoreChange,
        participationChange
      },
      significance
    }
  }

  /**
   * Get version metrics
   */
  private async getVersionMetrics(
    expertId: string,
    version: string,
    project: string,
    windowMs: number
  ): Promise<{
    accuracy: number
    avgConfidence: number
    avgConsensusScore: number
    participations: number
  }> {
    const db = await this.getDb()
    if (!db) {
      return {
        accuracy: 0,
        avgConfidence: 0,
        avgConsensusScore: 0,
        participations: 0
      }
    }
    const cutoff = Date.now() - windowMs

    const stmt = db.prepare(`
      SELECT
        p.confidence,
        d.consensus_score,
        d.outcome
      FROM expert_participations p
      JOIN consensus_decisions d ON p.decision_id = d.decision_id
      WHERE p.expert_id = ? AND p.version = ? AND p.project = ?
        AND d.timestamp >= ?
    `)

    const rows = stmt.all(expertId, version, project, cutoff) as any[]

    if (rows.length === 0) {
      return { accuracy: 0, avgConfidence: 0, avgConsensusScore: 0, participations: 0 }
    }

    const correctCount = rows.filter(r => r.outcome === 'correct').length
    const accuracy = correctCount / rows.length

    const avgConfidence = rows.reduce((sum, r) => sum + r.confidence, 0) / rows.length
    const avgConsensusScore = rows.reduce((sum, r) => sum + r.consensus_score, 0) / rows.length

    return {
      accuracy,
      avgConfidence,
      avgConsensusScore,
      participations: rows.length
    }
  }

  // ============================================================================
  // Rotation Recommendations
  // ============================================================================

  /**
   * Generate rotation recommendations
   */
  async generateRotationRecommendations(project: string): Promise<RotationRecommendation[]> {
    const recommendations: RotationRecommendation[] = []

    // Try Supabase if available, otherwise use AgentDB fallback
    if (!isSupabaseInitialized()) {
      console.warn('Supabase unavailable, using AgentDB fallback for rotation recommendations');
      // Return empty recommendations in local-only mode
      return recommendations;
    }

    // Get all active versions for project - try Supabase first
    let activeExperts: Set<string> = new Set()

    try {
      const consensusHistory = await getConsensusHistory(project, 1000)

      // Extract unique experts from recent consensus
      for (const consensus of consensusHistory) {
        for (const expert of consensus.contributing_experts) {
          activeExperts.add((expert as any).expertId || (expert as any).expert_id)
        }
      }

      // Generate recommendations for each expert using Supabase stats
      for (const expertId of Array.from(activeExperts)) {
        try {
          const stats = await getExpertParticipationStats(expertId)
          const lineage = await this.getVersionLineage(expertId, project)

          if (lineage.length === 0) continue

          const currentVersion = lineage[0] // Most recent version

          // Check performance
          if (stats.winRate < 0.7 && stats.totalConsensus > 10) {
            // Poor performance, recommend update
            const alternatives = lineage
              .slice(1)
              .filter(v => v.contributionRate > currentVersion.contributionRate)
              .map(v => ({
                version: v.version,
                expectedImprovement: v.contributionRate - currentVersion.contributionRate,
                confidence: v.consensusParticipations >= 10 ? 0.9 : 0.6
              }))

            recommendations.push({
              expertId,
              currentVersion: currentVersion.version,
              recommendedAction: alternatives.length > 0 ? 'update' : 'replace',
              reason: `Low win rate: ${(stats.winRate * 100).toFixed(1)}% (${stats.timesWon}/${stats.totalConsensus})`,
              alternativeVersions: alternatives,
              priority: stats.winRate < 0.5 ? 'high' : 'medium'
            })
          } else if (stats.winRate > 0.85) {
            // Good performance, keep
            recommendations.push({
              expertId,
              currentVersion: currentVersion.version,
              recommendedAction: 'keep',
              reason: `Strong win rate: ${(stats.winRate * 100).toFixed(1)}% (${stats.timesWon}/${stats.totalConsensus})`,
              alternativeVersions: [],
              priority: 'low'
            })
          }
        } catch (error) {
          console.warn(`Failed to get stats for expert ${expertId}, skipping:`, error)
        }
      }

      if (recommendations.length > 0) {
        return recommendations
      }
    } catch (error) {
      console.warn('Failed to generate recommendations from Supabase, using local cache:', error)
    }

    // Fallback to local database
    const db = await this.getDb()
    if (!db) return []
    const stmt = db.prepare(`
      SELECT DISTINCT expert_id, version
      FROM version_lineage
      WHERE project = ? AND retired_at IS NULL
    `)

    const activeVersions = stmt.all(project) as any[]

    for (const { expert_id, version } of activeVersions) {
      const lineage = await this.getVersionLineage(expert_id, project)
      const currentVersion = lineage.find(v => v.version === version)

      if (!currentVersion) continue

      // Check performance
      if (currentVersion.contributionRate < 0.7 && currentVersion.consensusParticipations > 10) {
        // Poor performance, recommend update
        const alternatives = lineage
          .filter(v => v.version !== version && v.contributionRate > currentVersion.contributionRate)
          .map(v => ({
            version: v.version,
            expectedImprovement: v.contributionRate - currentVersion.contributionRate,
            confidence: v.consensusParticipations >= 10 ? 0.9 : 0.6
          }))

        recommendations.push({
          expertId: expert_id,
          currentVersion: version,
          recommendedAction: alternatives.length > 0 ? 'update' : 'replace',
          reason: `Low contribution rate: ${(currentVersion.contributionRate * 100).toFixed(1)}%`,
          alternativeVersions: alternatives,
          priority: currentVersion.contributionRate < 0.5 ? 'high' : 'medium'
        })
      } else if (currentVersion.contributionRate > 0.85) {
        // Good performance, keep
        recommendations.push({
          expertId: expert_id,
          currentVersion: version,
          recommendedAction: 'keep',
          reason: `Strong contribution rate: ${(currentVersion.contributionRate * 100).toFixed(1)}%`,
          alternativeVersions: [],
          priority: 'low'
        })
      }
    }

    return recommendations
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get decision by ID
   */
  private async getDecision(decisionId: string): Promise<ConsensusDecision | null> {
    const db = await this.getDb()
    if (!db) return null
    const stmt = db.prepare(`
      SELECT * FROM consensus_decisions WHERE decision_id = ?
    `)

    const row = stmt.get(decisionId) as any

    if (!row) return null

    const participants = await this.getDecisionParticipants(decisionId)

    return {
      decisionId: row.decision_id,
      project: row.project,
      timestamp: new Date(row.timestamp),
      participants,
      finalDecision: JSON.parse(row.final_decision),
      consensusScore: row.consensus_score,
      outcome: row.outcome,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }
  }

  /**
   * Get decision participants
   */
  private async getDecisionParticipants(decisionId: string): Promise<ExpertParticipation[]> {
    const db = await this.getDb()
    if (!db) return []
    const stmt = db.prepare(`
      SELECT * FROM expert_participations WHERE decision_id = ?
    `)

    const rows = stmt.all(decisionId) as any[]

    return rows.map(row => ({
      expertId: row.expert_id,
      version: row.version,
      project: row.project,
      confidence: row.confidence,
      prediction: JSON.parse(row.prediction),
      reasoning: JSON.parse(row.reasoning),
      weight: row.weight
    }))
  }

  /**
   * Get all decisions for a pattern
   */
  private async getPatternDecisions(patternId: string): Promise<ConsensusDecision[]> {
    // This is a simplified implementation
    // In production, you'd need to match expert combinations more sophisticated
    const db = await this.getDb()
    if (!db) return []
    const decisions: ConsensusDecision[] = []

    const stmt = db.prepare(`
      SELECT decision_id FROM consensus_decisions
      ORDER BY timestamp DESC
      LIMIT 1000
    `)

    const decisionIds = (stmt.all() as any[]).map(r => r.decision_id)

    for (const id of decisionIds) {
      const decision = await this.getDecision(id)

      if (!decision) continue

      const expertIds = decision.participants.map(p => p.expertId).sort()
      const versions = decision.participants.map(p => p.version).sort()
      const decidedPatternId = `${expertIds.join('-')}_${versions.join('-')}`

      if (decidedPatternId === patternId) {
        decisions.push(decision)
      }
    }

    return decisions
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
          console.warn('⚠ ConsensusLineageTracker: Failed to close AgentDB:', error)
        }
      }
    }

    if (this.agentDbReady) {
      this.agentDbReady
        .then(() => closeDb())
        .catch(error => {
          console.warn('⚠ ConsensusLineageTracker: AgentDB still initializing during close:', error)
        })
      return
    }

    closeDb()
  }
}

/**
 * Create consensus lineage tracker
 */
export function createConsensusLineageTracker(
  config?: LineageTrackerConfig
): ConsensusLineageTracker {
  return new ConsensusLineageTracker(config)
}
