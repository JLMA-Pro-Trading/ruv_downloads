/**
 * Prompt Registry - Expert Signature Version Management
 *
 * Centralized registry for tracking expert signatures, prompt versions,
 * and their performance across projects. Enables prompt discovery and reuse.
 *
 * Features:
 * - Expert signature versioning
 * - Performance tracking per version
 * - Cross-project prompt discovery
 * - Signature comparison and diff
 * - Best-in-class prompt retrieval
 *
 * @module prompt-registry
 * @version 2.0.0
 * @note Now uses Supabase as primary store, AgentDB as optional local cache
 */

import { AgentDBSingleton } from '../storage/agentdb-singleton.js'
import {
  storeExpertSignature,
  loadActiveExpertSignature,
  getSignatureHistory,
  recordSignatureUpgrade,
  getSupabase,
  getProjectId,
  isSupabaseInitialized,
} from '../supabase/index.js'

/**
 * Expert signature with version tracking
 */
export interface ExpertSignature {
  signatureId: string
  expertId: string
  expertRole: string
  project: string
  version: string
  prompt: string
  inputFields: string[]
  outputFields: string[]
  deployedAt: Date
  deprecatedAt?: Date
  eval: {
    accuracy: number
    confidence: number
    avgLatency: number
    totalEvaluations: number
    lastUpdated: Date
  }
  metadata?: Record<string, any>
}

/**
 * Signature comparison result
 */
export interface SignatureComparison {
  signatureId1: string
  signatureId2: string
  similarity: number
  differences: Array<{
    field: string
    value1: string
    value2: string
  }>
  performanceComparison: {
    accuracyDiff: number
    confidenceDiff: number
    latencyDiff: number
  }
  recommendation: 'keep_first' | 'keep_second' | 'merge' | 'both_viable'
}

/**
 * Best signature for a role across projects
 */
export interface BestSignature {
  expertRole: string
  signatureId: string
  project: string
  version: string
  accuracy: number
  confidence: number
  evaluations: number
  deployedAt: Date
}

/**
 * Prompt evolution history
 */
export interface PromptEvolution {
  expertId: string
  role: string
  versions: Array<{
    version: string
    prompt: string
    accuracy: number
    deployedAt: Date
    deprecatedAt?: Date
  }>
  performanceTrend: 'improving' | 'stable' | 'declining'
  bestVersion: string
}

/**
 * Configuration for prompt registry
 */
export interface PromptRegistryConfig {
  dbPath?: string
  enableEmbeddings?: boolean
  minEvaluationsForValidity?: number
  useSupabase?: boolean // Default: true if Supabase is initialized
  enableLocalCache?: boolean // Default: false, enables AgentDB as cache
}

/**
 * Prompt Registry
 */
export class PromptRegistry {
  private db: any | null
  private dbReady: Promise<void> | null = null
  private config: Required<PromptRegistryConfig>
  private useSupabase: boolean

  constructor(config: PromptRegistryConfig = {}) {
    this.useSupabase = config.useSupabase ?? isSupabaseInitialized()

    this.config = {
      dbPath: config.dbPath || './data/prompt-registry.db',
      enableEmbeddings: config.enableEmbeddings ?? false,
      minEvaluationsForValidity: config.minEvaluationsForValidity ?? 10,
      useSupabase: this.useSupabase,
      enableLocalCache: config.enableLocalCache ?? false,
    }

    // Initialize AgentDB asynchronously if local cache is enabled
    if (this.config.enableLocalCache) {
      this.dbReady = this.initializeAgentDb()
    } else {
      this.db = null
    }
  }

  /**
   * Initialize AgentDB (async sql.js loader with singleton)
   */
  private initializeAgentDb(): Promise<void> {
    return (async () => {
      try {
        this.db = await AgentDBSingleton.getInstance(this.config.dbPath)
        this.initializeTables()
      } catch (error) {
        console.warn('⚠ PromptRegistry: AgentDB initialization failed (sql.js compatibility issue), disabling cache:', error)
        this.db = null
        this.config.enableLocalCache = false
      }
    })()
  }

  /**
   * Ensure AgentDB is ready for operations
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
      // Expert signatures
      this.db.exec(`
      CREATE TABLE IF NOT EXISTS expert_signatures (
        signature_id TEXT PRIMARY KEY,
        expert_id TEXT NOT NULL,
        expert_role TEXT NOT NULL,
        project TEXT NOT NULL,
        version TEXT NOT NULL,
        prompt TEXT NOT NULL,
        input_fields TEXT NOT NULL,
        output_fields TEXT NOT NULL,
        deployed_at INTEGER NOT NULL,
        deprecated_at INTEGER,
        accuracy REAL DEFAULT 0.0,
        confidence REAL DEFAULT 0.0,
        avg_latency REAL DEFAULT 0.0,
        total_evaluations INTEGER DEFAULT 0,
        last_updated INTEGER NOT NULL,
        metadata TEXT,
        UNIQUE(expert_id, project, version)
      )
    `)

    // Signature evaluation history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signature_evaluations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        confidence REAL NOT NULL,
        latency_ms INTEGER NOT NULL,
        context TEXT,
        FOREIGN KEY (signature_id) REFERENCES expert_signatures(signature_id)
      )
    `)

    // Signature relationships (for tracking forks, merges, etc.)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS signature_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_signature_id TEXT NOT NULL,
        target_signature_id TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (source_signature_id) REFERENCES expert_signatures(signature_id),
        FOREIGN KEY (target_signature_id) REFERENCES expert_signatures(signature_id)
      )
    `)

      // Create indexes
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_signatures_role ON expert_signatures(expert_role)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_signatures_project ON expert_signatures(project)`)
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_signatures_accuracy ON expert_signatures(accuracy DESC)`)
    } catch (error) {
      console.warn('⚠ PromptRegistry: Table initialization failed (sql.js compatibility issue):', error)
      this.db = null
    }
  }

  // ============================================================================
  // Signature Management
  // ============================================================================

  /**
   * Register a new expert signature
   */
  async registerSignature(
    signature: Omit<ExpertSignature, 'signatureId' | 'eval'>,
    options?: {
      changelog?: string
      improvementMetrics?: Record<string, any>
    }
  ): Promise<string> {
    const signatureId = `sig-${signature.expertId}-${signature.version}-${Date.now()}`

    // Check for previous version to track upgrade
    let previousVersion: string | null = null
    if (this.useSupabase) {
      try {
        const history = await getSignatureHistory(signature.expertId)
        if (history.length > 0) {
          previousVersion = history[0].version
        }
      } catch (error) {
        console.error('Failed to check signature history:', error)
      }
    }

    // Primary: Store in Supabase
    if (this.useSupabase) {
      try {
        const supabaseSignature = {
          input_schema: signature.inputFields,
          output_schema: signature.outputFields,
        }

        await storeExpertSignature(
          signature.expertId,
          signature.version,
          signature.prompt,
          supabaseSignature,
          {
            metadata: {
              ...signature.metadata,
              expertRole: signature.expertRole,
              deployedAt: signature.deployedAt.toISOString(),
            },
            setActive: true,
          }
        )

        // Record version upgrade if this is a new version
        if (previousVersion && previousVersion !== signature.version) {
          await recordSignatureUpgrade(
            signature.expertId,
            previousVersion,
            signature.version,
            options?.changelog || `Upgraded from ${previousVersion} to ${signature.version}`,
            options?.improvementMetrics
          )
        }
      } catch (error) {
        console.error('Failed to store signature in Supabase:', error)
        // Continue to local cache if enabled
      }
    }

    // Optional: Store in local AgentDB cache
    const db = await this.getDb()
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO expert_signatures
        (signature_id, expert_id, expert_role, project, version, prompt,
         input_fields, output_fields, deployed_at, last_updated, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        signatureId,
        signature.expertId,
        signature.expertRole,
        signature.project,
        signature.version,
        signature.prompt,
        JSON.stringify(signature.inputFields),
        JSON.stringify(signature.outputFields),
        signature.deployedAt.getTime(),
        Date.now(),
        signature.metadata ? JSON.stringify(signature.metadata) : null
      )
    }

    return signatureId
  }

  /**
   * Update signature evaluation metrics
   */
  async recordEvaluation(
    signatureId: string,
    accuracy: number,
    confidence: number,
    latencyMs: number,
    context?: Record<string, any>
  ): Promise<void> {
    // Update Supabase performance metrics
    if (this.useSupabase) {
      try {
        // Extract expertId from signatureId (format: sig-{expertId}-{version}-{timestamp})
        const parts = signatureId.split('-')
        const expertId = parts.slice(1, -2).join('-')

        const supabase = getSupabase()
        const project = getProjectId()

        // Update performance metrics in Supabase
        const { error } = await supabase
          .from('expert_signatures')
          .update({
            performance_metrics: {
              accuracy,
              confidence,
              latency_ms: latencyMs,
              last_updated: new Date().toISOString(),
              context,
            },
          })
          .eq('project', project)
          .eq('expert_id', expertId)
          .eq('active', true)

        if (error) {
          console.error('Failed to update Supabase metrics:', error)
        }
      } catch (error) {
        console.error('Failed to update signature metrics in Supabase:', error)
      }
    }

    // Record in local cache if enabled
    const db = await this.getDb()
    if (db) {
      const evalStmt = db.prepare(`
        INSERT INTO signature_evaluations
        (signature_id, timestamp, accuracy, confidence, latency_ms, context)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      evalStmt.run(
        signatureId,
        Date.now(),
        accuracy,
        confidence,
        latencyMs,
        context ? JSON.stringify(context) : null
      )

      // Recalculate aggregate metrics
      await this.updateSignatureMetrics(signatureId)
    }
  }

  /**
   * Update signature aggregate metrics (local cache only)
   */
  private async updateSignatureMetrics(signatureId: string): Promise<void> {
    if (!this.db) return

    const stmt = this.db.prepare(`
      SELECT
        AVG(accuracy) as avg_accuracy,
        AVG(confidence) as avg_confidence,
        AVG(latency_ms) as avg_latency,
        COUNT(*) as total
      FROM signature_evaluations
      WHERE signature_id = ?
    `)

    const metrics = stmt.get(signatureId) as any

    const updateStmt = this.db.prepare(`
      UPDATE expert_signatures
      SET accuracy = ?,
          confidence = ?,
          avg_latency = ?,
          total_evaluations = ?,
          last_updated = ?
      WHERE signature_id = ?
    `)

    updateStmt.run(
      metrics.avg_accuracy || 0,
      metrics.avg_confidence || 0,
      metrics.avg_latency || 0,
      metrics.total || 0,
      Date.now(),
      signatureId
    )
  }

  /**
   * Deprecate a signature
   */
  async deprecateSignature(signatureId: string): Promise<void> {
    // Deprecate in Supabase by setting active=false
    if (this.useSupabase) {
      try {
        const parts = signatureId.split('-')
        const expertId = parts.slice(1, -2).join('-')

        const supabase = getSupabase()
        const project = getProjectId()

        const { error } = await supabase
          .from('expert_signatures')
          .update({ active: false })
          .eq('project', project)
          .eq('expert_id', expertId)

        if (error) {
          console.error('Failed to deprecate signature in Supabase:', error)
        }
      } catch (error) {
        console.error('Failed to deprecate signature:', error)
      }
    }

    // Deprecate in local cache
    const db = await this.getDb()
    if (db) {
      const stmt = db.prepare(`
        UPDATE expert_signatures
        SET deprecated_at = ?
        WHERE signature_id = ?
      `)

      stmt.run(Date.now(), signatureId)
    }
  }

  // ============================================================================
  // Signature Discovery
  // ============================================================================

  /**
   * Get latest signature for an expert
   */
  async getLatestSignature(expertId: string, project?: string): Promise<ExpertSignature | null> {
    // Primary: Get from Supabase
    if (this.useSupabase) {
      try {
        const supabaseSignature = await loadActiveExpertSignature(expertId)

        if (supabaseSignature) {
          return {
            signatureId: supabaseSignature.id,
            expertId: supabaseSignature.expert_id,
            expertRole: supabaseSignature.metadata?.expertRole || 'unknown',
            project: supabaseSignature.project,
            version: supabaseSignature.version,
            prompt: supabaseSignature.prompt,
            inputFields: supabaseSignature.signature?.input_schema || [],
            outputFields: supabaseSignature.signature?.output_schema || [],
            deployedAt: new Date(supabaseSignature.created_at || Date.now()),
            eval: {
              accuracy: supabaseSignature.performance_metrics?.accuracy || 0,
              confidence: supabaseSignature.performance_metrics?.confidence || 0,
              avgLatency: supabaseSignature.performance_metrics?.latency_ms || 0,
              totalEvaluations: 1,
              lastUpdated: new Date(supabaseSignature.updated_at || Date.now()),
            },
            metadata: supabaseSignature.metadata,
          }
        }
      } catch (error) {
        console.error('Failed to get latest signature from Supabase:', error)
      }
    }

    // Fallback: Get from local cache
    const db = await this.getDb()
    if (db) {
      const query = project
        ? `SELECT * FROM expert_signatures
           WHERE expert_id = ? AND project = ? AND deprecated_at IS NULL
           ORDER BY deployed_at DESC LIMIT 1`
        : `SELECT * FROM expert_signatures
           WHERE expert_id = ? AND deprecated_at IS NULL
           ORDER BY deployed_at DESC LIMIT 1`

      const stmt = db.prepare(query)
      const row = project ? stmt.get(expertId, project) : stmt.get(expertId)

      return row ? this.mapRowToSignature(row as any) : null
    }

    return null
  }

  /**
   * Get best performing signature for a role across all projects
   */
  async getBestAcrossProjects(expertRole: string): Promise<BestSignature | null> {
    // Primary: Query Supabase for highest-accuracy signatures
    if (this.useSupabase) {
      try {
        const supabase = getSupabase()

        const { data, error } = await supabase
          .from('expert_signatures')
          .select('*')
          .eq('active', true)
          .not('performance_metrics', 'is', null)
          .order('performance_metrics->accuracy', { ascending: false })
          .limit(100) // Get top 100 to filter by role

        if (error) {
          console.error('Failed to query best signatures from Supabase:', error)
        } else if (data) {
          // Filter by role from metadata
          const filtered = data.filter(sig => sig.metadata?.expertRole === expertRole)

          if (filtered.length > 0) {
            const best = filtered[0]
            return {
              expertRole,
              signatureId: best.id,
              project: best.project,
              version: best.version,
              accuracy: best.performance_metrics?.accuracy || 0,
              confidence: best.performance_metrics?.confidence || 0,
              evaluations: 1,
              deployedAt: new Date(best.created_at),
            }
          }
        }
      } catch (error) {
        console.error('Failed to get best signature from Supabase:', error)
      }
    }

    // Fallback: Query local cache
    const db = await this.getDb()
    if (db) {
      const stmt = db.prepare(`
        SELECT * FROM expert_signatures
        WHERE expert_role = ?
          AND deprecated_at IS NULL
          AND total_evaluations >= ?
        ORDER BY accuracy DESC, confidence DESC
        LIMIT 1
      `)

      const row = stmt.get(expertRole, this.config.minEvaluationsForValidity) as any

      if (!row) return null

      return {
        expertRole: row.expert_role,
        signatureId: row.signature_id,
        project: row.project,
        version: row.version,
        accuracy: row.accuracy,
        confidence: row.confidence,
        evaluations: row.total_evaluations,
        deployedAt: new Date(row.deployed_at)
      }
    }

    return null
  }

  /**
   * Find similar signatures across projects
   */
  async findSimilarSignatures(
    signatureId: string,
    threshold: number = 0.7
  ): Promise<ExpertSignature[]> {
    if (!this.db) {
      console.warn('⚠ AgentDB cache not available for similarity search')
      return []
    }

    const source = await this.getSignature(signatureId)

    if (!source) return []

    // Get signatures with same role
    const stmt = this.db.prepare(`
      SELECT * FROM expert_signatures
      WHERE expert_role = ?
        AND signature_id != ?
        AND deprecated_at IS NULL
      ORDER BY accuracy DESC
    `)

    const candidates = stmt.all(source.expertRole, signatureId) as any[]

    // Calculate similarity (simple token overlap for now)
    // In production, use embeddings
    const results = candidates
      .map(candidate => {
        const similarity = this.calculatePromptSimilarity(source.prompt, candidate.prompt)
        return { candidate, similarity }
      })
      .filter(({ similarity }) => similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .map(({ candidate }) => this.mapRowToSignature(candidate))

    return results
  }

  /**
   * Calculate simple prompt similarity
   */
  private calculatePromptSimilarity(prompt1: string, prompt2: string): number {
    const tokens1 = new Set(prompt1.toLowerCase().split(/\s+/))
    const tokens2 = new Set(prompt2.toLowerCase().split(/\s+/))

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)))
    const union = new Set([...tokens1, ...tokens2])

    return intersection.size / union.size
  }

  // ============================================================================
  // Signature Comparison
  // ============================================================================

  /**
   * Compare two signatures
   */
  async compareSignatures(signatureId1: string, signatureId2: string): Promise<SignatureComparison> {
    const sig1 = await this.getSignature(signatureId1)
    const sig2 = await this.getSignature(signatureId2)

    if (!sig1 || !sig2) {
      throw new Error('One or both signatures not found')
    }

    const similarity = this.calculatePromptSimilarity(sig1.prompt, sig2.prompt)

    // Find differences
    const differences: Array<{ field: string; value1: string; value2: string }> = []

    if (sig1.prompt !== sig2.prompt) {
      differences.push({
        field: 'prompt',
        value1: sig1.prompt.substring(0, 100) + '...',
        value2: sig2.prompt.substring(0, 100) + '...'
      })
    }

    if (JSON.stringify(sig1.inputFields) !== JSON.stringify(sig2.inputFields)) {
      differences.push({
        field: 'inputFields',
        value1: sig1.inputFields.join(', '),
        value2: sig2.inputFields.join(', ')
      })
    }

    // Performance comparison
    const performanceComparison = {
      accuracyDiff: sig1.eval.accuracy - sig2.eval.accuracy,
      confidenceDiff: sig1.eval.confidence - sig2.eval.confidence,
      latencyDiff: sig1.eval.avgLatency - sig2.eval.avgLatency
    }

    // Recommendation
    let recommendation: 'keep_first' | 'keep_second' | 'merge' | 'both_viable'

    if (sig1.eval.accuracy > sig2.eval.accuracy + 0.1) {
      recommendation = 'keep_first'
    } else if (sig2.eval.accuracy > sig1.eval.accuracy + 0.1) {
      recommendation = 'keep_second'
    } else if (similarity > 0.8) {
      recommendation = 'merge'
    } else {
      recommendation = 'both_viable'
    }

    return {
      signatureId1,
      signatureId2,
      similarity,
      differences,
      performanceComparison,
      recommendation
    }
  }

  // ============================================================================
  // Prompt Evolution
  // ============================================================================

  /**
   * Get prompt evolution history
   */
  async getPromptEvolution(expertId: string, project?: string): Promise<PromptEvolution> {
    let signatures: ExpertSignature[] = []

    // Primary: Get from Supabase
    if (this.useSupabase) {
      try {
        const supabaseSignatures = await getSignatureHistory(expertId)

        signatures = supabaseSignatures.map(sig => ({
          signatureId: sig.id,
          expertId: sig.expert_id,
          expertRole: sig.metadata?.expertRole || 'unknown',
          project: sig.project,
          version: sig.version,
          prompt: sig.prompt,
          inputFields: sig.signature?.input_schema || [],
          outputFields: sig.signature?.output_schema || [],
          deployedAt: new Date(sig.created_at || Date.now()),
          deprecatedAt: !sig.active ? new Date(sig.updated_at || Date.now()) : undefined,
          eval: {
            accuracy: sig.performance_metrics?.accuracy || 0,
            confidence: sig.performance_metrics?.confidence || 0,
            avgLatency: sig.performance_metrics?.latency_ms || 0,
            totalEvaluations: 1,
            lastUpdated: new Date(sig.updated_at || Date.now()),
          },
          metadata: sig.metadata,
        }))
      } catch (error) {
        console.error('Failed to get signature history from Supabase:', error)
        // Fall back to local cache
      }
    }

    // Fallback: Get from local cache
    if (signatures.length === 0 && this.db) {
      const query = project
        ? `SELECT * FROM expert_signatures
           WHERE expert_id = ? AND project = ?
           ORDER BY deployed_at ASC`
        : `SELECT * FROM expert_signatures
           WHERE expert_id = ?
           ORDER BY deployed_at ASC`

      const stmt = this.db.prepare(query)
      const rows = project ? stmt.all(expertId, project) : stmt.all(expertId)

      signatures = (rows as any[]).map(row => this.mapRowToSignature(row))
    }

    if (signatures.length === 0) {
      throw new Error(`No signatures found for expert ${expertId}`)
    }

    const versions = signatures.map(sig => ({
      version: sig.version,
      prompt: sig.prompt,
      accuracy: sig.eval.accuracy,
      deployedAt: sig.deployedAt,
      deprecatedAt: sig.deprecatedAt
    }))

    // Calculate performance trend
    const recentVersions = versions.slice(-3)
    let performanceTrend: 'improving' | 'stable' | 'declining'

    if (recentVersions.length < 2) {
      performanceTrend = 'stable'
    } else {
      const firstAccuracy = recentVersions[0].accuracy
      const lastAccuracy = recentVersions[recentVersions.length - 1].accuracy
      const change = lastAccuracy - firstAccuracy

      if (change > 0.05) performanceTrend = 'improving'
      else if (change < -0.05) performanceTrend = 'declining'
      else performanceTrend = 'stable'
    }

    // Find best version
    const bestVersion = versions.reduce((best, v) =>
      v.accuracy > best.accuracy ? v : best
    ).version

    return {
      expertId,
      role: signatures[0].expertRole,
      versions,
      performanceTrend,
      bestVersion
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get signature by ID
   */
  async getSignature(signatureId: string): Promise<ExpertSignature | null> {
    // Primary: Get from Supabase by ID
    if (this.useSupabase) {
      try {
        const supabase = getSupabase()

        const { data, error } = await supabase
          .from('expert_signatures')
          .select('*')
          .eq('id', signatureId)
          .single()

        if (!error && data) {
          return {
            signatureId: data.id,
            expertId: data.expert_id,
            expertRole: data.metadata?.expertRole || 'unknown',
            project: data.project,
            version: data.version,
            prompt: data.prompt,
            inputFields: data.signature.input_schema || [],
            outputFields: data.signature.output_schema || [],
            deployedAt: new Date(data.created_at),
            deprecatedAt: !data.active ? new Date(data.updated_at) : undefined,
            eval: {
              accuracy: data.performance_metrics?.accuracy || 0,
              confidence: data.performance_metrics?.confidence || 0,
              avgLatency: data.performance_metrics?.latency_ms || 0,
              totalEvaluations: 1,
              lastUpdated: new Date(data.updated_at),
            },
            metadata: data.metadata,
          }
        }
      } catch (error) {
        console.error('Failed to get signature from Supabase:', error)
      }
    }

    // Fallback: Get from local cache
    const db = await this.getDb()
    if (db) {
      const stmt = db.prepare(`
        SELECT * FROM expert_signatures WHERE signature_id = ?
      `)

      const row = stmt.get(signatureId) as any

      return row ? this.mapRowToSignature(row) : null
    }

    return null
  }

  /**
   * Map database row to ExpertSignature
   */
  private mapRowToSignature(row: any): ExpertSignature {
    return {
      signatureId: row.signature_id,
      expertId: row.expert_id,
      expertRole: row.expert_role,
      project: row.project,
      version: row.version,
      prompt: row.prompt,
      inputFields: JSON.parse(row.input_fields),
      outputFields: JSON.parse(row.output_fields),
      deployedAt: new Date(row.deployed_at),
      deprecatedAt: row.deprecated_at ? new Date(row.deprecated_at) : undefined,
      eval: {
        accuracy: row.accuracy,
        confidence: row.confidence,
        avgLatency: row.avg_latency,
        totalEvaluations: row.total_evaluations,
        lastUpdated: new Date(row.last_updated)
      },
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }
  }

  /**
   * Get all signatures for a project
   */
  async getProjectSignatures(project: string, includeDeprecated: boolean = false): Promise<ExpertSignature[]> {
    // Primary: Get from Supabase
    if (this.useSupabase) {
      try {
        const supabase = getSupabase()

        let query = supabase
          .from('expert_signatures')
          .select('*')
          .eq('project', project)
          .order('created_at', { ascending: false })

        if (!includeDeprecated) {
          query = query.eq('active', true)
        }

        const { data, error } = await query

        if (!error && data) {
          return data.map(sig => ({
            signatureId: sig.id,
            expertId: sig.expert_id,
            expertRole: sig.metadata?.expertRole || 'unknown',
            project: sig.project,
            version: sig.version,
            prompt: sig.prompt,
            inputFields: sig.signature.input_schema || [],
            outputFields: sig.signature.output_schema || [],
            deployedAt: new Date(sig.created_at),
            deprecatedAt: !sig.active ? new Date(sig.updated_at) : undefined,
            eval: {
              accuracy: sig.performance_metrics?.accuracy || 0,
              confidence: sig.performance_metrics?.confidence || 0,
              avgLatency: sig.performance_metrics?.latency_ms || 0,
              totalEvaluations: 1,
              lastUpdated: new Date(sig.updated_at),
            },
            metadata: sig.metadata,
          }))
        }
      } catch (error) {
        console.error('Failed to get project signatures from Supabase:', error)
      }
    }

    // Fallback: Get from local cache
    const db = await this.getDb()
    if (db) {
      const query = includeDeprecated
        ? `SELECT * FROM expert_signatures WHERE project = ? ORDER BY deployed_at DESC`
        : `SELECT * FROM expert_signatures WHERE project = ? AND deprecated_at IS NULL ORDER BY deployed_at DESC`

      const stmt = db.prepare(query)
      const rows = stmt.all(project) as any[]

      return rows.map(row => this.mapRowToSignature(row))
    }

    return []
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    const db = await this.getDb()
    if (db) {
      db.close()
    }
  }
}

/**
 * Create prompt registry
 */
export function createPromptRegistry(config?: PromptRegistryConfig): PromptRegistry {
  return new PromptRegistry(config)
}
