/**
 * Reflexion Monitor - Drift-Aware Self-Correction System
 *
 * Tracks whether reflexions remain valid over time based on recent outcomes.
 * Flags outdated reasoning chains and triggers self-correction when needed.
 *
 * Features:
 * - Reflexion drift detection
 * - Validity scoring based on recent outcomes
 * - Automatic staleness marking
 * - Advisory generation for developers
 * - Cross-project reflexion comparison
 *
 * Integrates with Supabase reflexion_bank for persistence and vector search
 * while maintaining AgentDB as a fallback cache.
 *
 * @module reflexion-monitor
 * @version 2.0.0
 */
import { AgentDBSingleton } from '../storage/agentdb-singleton.js';
import { saveReflexion, findSimilarReflexions as findSimilarReflexionsSupabase, markReflexionReused, getReflexionStats as getReflexionStatsSupabase, isSupabaseInitialized, } from '../supabase/index.js';
/**
 * Reflexion Monitor - Track and manage reflexion validity
 */
export class ReflexionMonitor {
    db;
    config;
    dbReady = null;
    constructor(config = {}) {
        this.config = {
            dbPath: config.dbPath || './data/reflexion-monitor.db',
            validityThreshold: config.validityThreshold ?? 0.6,
            driftWindow: config.driftWindow ?? 30,
            minUsageForValidity: config.minUsageForValidity ?? 5,
            crossProjectEnabled: config.crossProjectEnabled ?? true
        };
        this.dbReady = this.initializeDatabase();
    }
    /**
     * Initialize database tables
     */
    initializeTables() {
        if (!this.db)
            return;
        // Tracked reflexions table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS tracked_reflexions (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        expert_role TEXT NOT NULL,
        experience TEXT NOT NULL,
        reflection TEXT NOT NULL,
        insights TEXT NOT NULL,
        action_items TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        validity_score REAL DEFAULT 1.0,
        usage_count INTEGER DEFAULT 0,
        successful_uses INTEGER DEFAULT 0,
        last_used INTEGER,
        marked_stale INTEGER DEFAULT 0,
        stale_reason TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
        // Reflexion usage history
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS reflexion_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reflexion_id TEXT NOT NULL,
        project TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        success INTEGER NOT NULL,
        context TEXT,
        outcome TEXT,
        FOREIGN KEY (reflexion_id) REFERENCES tracked_reflexions(id)
      )
    `);
        // Drift detection events
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS drift_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reflexion_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        severity TEXT NOT NULL,
        reason TEXT NOT NULL,
        validity_change REAL NOT NULL,
        recommendations TEXT NOT NULL,
        FOREIGN KEY (reflexion_id) REFERENCES tracked_reflexions(id)
      )
    `);
        // Advisory log
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS reflexion_advisories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        reflexion_id TEXT NOT NULL,
        recommendations TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        acknowledged INTEGER DEFAULT 0
      )
    `);
        // Create indexes
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_project ON tracked_reflexions(project)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_validity ON tracked_reflexions(validity_score)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_stale ON tracked_reflexions(marked_stale)`);
    }
    /**
     * Initialize AgentDB (async sql.js loader)
     */
    initializeDatabase() {
        return (async () => {
            try {
                this.db = await AgentDBSingleton.getInstance(this.config.dbPath);
                this.initializeTables();
            }
            catch (error) {
                console.warn('⚠ ReflexionMonitor: AgentDB initialization failed (sql.js compatibility issue), disabling local cache:', error);
                this.db = null;
            }
        })();
    }
    /**
     * Ensure AgentDB is ready for operations
     */
    async ensureDbReady() {
        const ready = this.dbReady;
        if (ready) {
            try {
                await ready;
            }
            finally {
                if (this.dbReady === ready) {
                    this.dbReady = null;
                }
            }
        }
    }
    /**
     * Helper to return initialized AgentDB instance
     */
    async getDb() {
        await this.ensureDbReady();
        return this.db;
    }
    // ============================================================================
    // Reflexion Tracking
    // ============================================================================
    /**
     * Track a new reflexion
     * DUAL-WRITE: Saves to BOTH Supabase and AgentDB
     */
    async trackReflexion(id, project, expertRole, experience, reflection, insights, actionItems) {
        // Write to BOTH stores concurrently
        const results = await Promise.allSettled([
            // Store in AgentDB (local cache, fast)
            this.cacheReflexionLocally(id, project, expertRole, experience, reflection, insights, actionItems),
            // Store in Supabase (cloud, cross-project)
            isSupabaseInitialized()
                ? saveReflexion('tracked_reflexion', {
                    id,
                    project,
                    expert_role: expertRole,
                    experience,
                    insights,
                    action_items: actionItems,
                }, {
                    reflection,
                    timestamp: new Date().toISOString(),
                }, true, // Default to success until proven otherwise
                {
                    expertId: expertRole,
                    confidence: 1.0,
                    impactScore: 0.8,
                }).catch(err => {
                    console.warn('Supabase write failed (non-blocking):', err);
                    return null;
                })
                : Promise.resolve(null)
        ]);
        // Log results but don't fail if cloud is down
        const [agentdbResult, supabaseResult] = results;
        if (agentdbResult.status === 'rejected') {
            console.error('AgentDB write failed:', agentdbResult.reason);
            throw new Error('Failed to write to local cache');
        }
        if (supabaseResult.status === 'rejected') {
            console.warn('Supabase write failed (continuing):', supabaseResult.reason);
        }
    }
    /**
     * Cache reflexion in local AgentDB
     */
    async cacheReflexionLocally(id, project, expertRole, experience, reflection, insights, actionItems) {
        const db = await this.getDb();
        if (!db)
            return;
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO tracked_reflexions
      (id, project, expert_role, experience, reflection, insights, action_items, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, project, expertRole, experience, reflection, JSON.stringify(insights), JSON.stringify(actionItems), Date.now());
    }
    /**
     * Record reflexion usage and outcome
     */
    async recordUsage(reflexionId, project, success, context, outcome) {
        const db = await this.getDb();
        if (!db)
            return;
        // Record usage
        const usageStmt = db.prepare(`
      INSERT INTO reflexion_usage
      (reflexion_id, project, timestamp, success, context, outcome)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        usageStmt.run(reflexionId, project, Date.now(), success ? 1 : 0, context ? JSON.stringify(context) : null, outcome ? JSON.stringify(outcome) : null);
        // Update reflexion stats
        const updateStmt = db.prepare(`
      UPDATE tracked_reflexions
      SET usage_count = usage_count + 1,
          successful_uses = successful_uses + ?,
          last_used = ?,
          updated_at = ?
      WHERE id = ?
    `);
        updateStmt.run(success ? 1 : 0, Date.now(), Date.now(), reflexionId);
        // Recalculate validity score
        await this.recalculateValidity(reflexionId);
    }
    /**
     * Recalculate validity score based on recent outcomes
     */
    async recalculateValidity(reflexionId) {
        const db = await this.getDb();
        if (!db)
            return;
        const windowMs = this.config.driftWindow * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - windowMs;
        // Get recent usage
        const stmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful
      FROM reflexion_usage
      WHERE reflexion_id = ? AND timestamp >= ?
    `);
        const stats = stmt.get(reflexionId, cutoff);
        if (stats.total < this.config.minUsageForValidity) {
            // Not enough data yet, keep default validity
            return;
        }
        const validityScore = stats.successful / stats.total;
        // Update validity
        const updateStmt = db.prepare(`
      UPDATE tracked_reflexions
      SET validity_score = ?, updated_at = ?
      WHERE id = ?
    `);
        updateStmt.run(validityScore, Date.now(), reflexionId);
        // Check if reflexion should be marked stale
        if (validityScore < this.config.validityThreshold) {
            await this.markAsStale(reflexionId, `Validity score dropped to ${validityScore.toFixed(2)}`);
        }
    }
    /**
     * Mark reflexion as stale
     * Updates both Supabase and local cache
     */
    async markAsStale(reflexionId, reason) {
        const db = await this.getDb();
        if (!db)
            return;
        // Update local AgentDB
        const stmt = db.prepare(`
      UPDATE tracked_reflexions
      SET marked_stale = 1, stale_reason = ?, updated_at = ?
      WHERE id = ?
    `);
        stmt.run(reason, Date.now(), reflexionId);
        // Note: Supabase doesn't have a direct "stale" concept
        // This is tracked locally for now, could be added to Supabase metadata in future
        // Create advisory
        await this.createAdvisory({
            type: 'deprecation',
            severity: 'warning',
            message: `Reflexion ${reflexionId} marked as stale: ${reason}`,
            reflexionId,
            recommendations: [
                'Review recent outcomes',
                'Update reflexion with new insights',
                'Consider creating new reflexion variant'
            ],
            timestamp: new Date()
        });
    }
    /**
     * Mark reflexion as reused
     * Primary: Updates Supabase reuse_count
     * Fallback: Updates local AgentDB
     */
    async markAsReused(reflexionId) {
        // Try Supabase first
        if (isSupabaseInitialized()) {
            try {
                await markReflexionReused(reflexionId);
                // Also update local cache
                await this.incrementLocalReuseCount(reflexionId);
                return;
            }
            catch (error) {
                console.warn('Failed to mark as reused in Supabase, falling back to AgentDB:', error);
            }
        }
        // Fallback to local AgentDB
        await this.incrementLocalReuseCount(reflexionId);
    }
    /**
     * Increment reuse count in local AgentDB
     */
    async incrementLocalReuseCount(reflexionId) {
        const db = await this.getDb();
        if (!db)
            return;
        const stmt = db.prepare(`
      UPDATE tracked_reflexions
      SET usage_count = usage_count + 1,
          last_used = ?,
          updated_at = ?
      WHERE id = ?
    `);
        stmt.run(Date.now(), Date.now(), reflexionId);
    }
    // ============================================================================
    // Drift Detection
    // ============================================================================
    /**
     * Detect drift for a reflexion
     */
    async detectDrift(reflexionId) {
        const reflexion = await this.getReflexion(reflexionId);
        if (!reflexion) {
            throw new Error(`Reflexion ${reflexionId} not found`);
        }
        // Calculate validity change over time
        const windowMs = this.config.driftWindow * 24 * 60 * 60 * 1000;
        const halfWindow = windowMs / 2;
        const now = Date.now();
        const recentValidity = await this.calculateValidityForPeriod(reflexionId, now - halfWindow, now);
        const olderValidity = await this.calculateValidityForPeriod(reflexionId, now - windowMs, now - halfWindow);
        const validityChange = recentValidity - olderValidity;
        const driftDetected = Math.abs(validityChange) > 0.1 || recentValidity < this.config.validityThreshold;
        let severityLevel;
        if (Math.abs(validityChange) < 0.1)
            severityLevel = 'low';
        else if (Math.abs(validityChange) < 0.2)
            severityLevel = 'medium';
        else if (Math.abs(validityChange) < 0.3)
            severityLevel = 'high';
        else
            severityLevel = 'critical';
        const reason = validityChange < 0
            ? `Validity decreased by ${Math.abs(validityChange).toFixed(2)}`
            : validityChange > 0
                ? `Validity improved by ${validityChange.toFixed(2)}`
                : 'Validity stable but below threshold';
        const recommendations = this.generateDriftRecommendations(reflexion, validityChange);
        // Record drift event
        if (driftDetected) {
            const db = await this.getDb();
            if (!db) {
                return {
                    reflexionId,
                    driftDetected: false,
                    severityLevel: 'low',
                    reason: 'AgentDB unavailable',
                    recommendations,
                    affectedProjects: [reflexion.project],
                    validityChange
                };
            }
            const driftStmt = db.prepare(`
        INSERT INTO drift_events
        (reflexion_id, timestamp, severity, reason, validity_change, recommendations)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            driftStmt.run(reflexionId, Date.now(), severityLevel, reason, validityChange, JSON.stringify(recommendations));
        }
        return {
            reflexionId,
            driftDetected,
            severityLevel,
            reason,
            recommendations,
            affectedProjects: [reflexion.project],
            validityChange
        };
    }
    /**
     * Calculate validity for a specific time period
     */
    async calculateValidityForPeriod(reflexionId, startMs, endMs) {
        const db = await this.getDb();
        if (!db)
            return 1.0;
        const stmt = db.prepare(`
      SELECT COUNT(*) as total, SUM(success) as successful
      FROM reflexion_usage
      WHERE reflexion_id = ? AND timestamp >= ? AND timestamp < ?
    `);
        const stats = stmt.get(reflexionId, startMs, endMs);
        if (stats.total === 0)
            return 1.0; // No data, assume valid
        return stats.successful / stats.total;
    }
    /**
     * Generate recommendations based on drift
     */
    generateDriftRecommendations(reflexion, validityChange) {
        const recommendations = [];
        if (validityChange < -0.2) {
            recommendations.push('Immediate review recommended - significant degradation');
            recommendations.push('Check if domain conditions have changed');
            recommendations.push('Consider retraining expert with recent data');
        }
        else if (validityChange < 0) {
            recommendations.push('Monitor closely - declining performance');
            recommendations.push('Review recent failure cases');
            recommendations.push('Update action items based on new patterns');
        }
        else if (validityChange > 0.2) {
            recommendations.push('Performance improving - document what changed');
            recommendations.push('Consider sharing insights with other projects');
            recommendations.push('Update reflexion to capture new learnings');
        }
        if (reflexion.usageCount > 100 && reflexion.validityScore < 0.7) {
            recommendations.push('High usage with low validity - deprecation candidate');
        }
        return recommendations;
    }
    // ============================================================================
    // Cross-Project Discovery
    // ============================================================================
    /**
     * Find similar reflexions across projects
     * DUAL-READ: Queries BOTH Supabase and AgentDB, merges results
     */
    async findSimilarReflexions(reflexionId, threshold = 0.7) {
        const reflexion = await this.getReflexion(reflexionId);
        if (!reflexion) {
            throw new Error(`Reflexion ${reflexionId} not found`);
        }
        // Query BOTH sources concurrently
        const [supabaseResults, localResults] = await Promise.allSettled([
            // Query Supabase for cross-project patterns
            isSupabaseInitialized()
                ? (async () => {
                    const embedding = await this.generateEmbedding(reflexion);
                    const supabaseReflexions = await findSimilarReflexionsSupabase(embedding, {
                        reflexionType: 'tracked_reflexion',
                        successOnly: false,
                        limit: 20,
                        minImpactScore: threshold,
                    });
                    return supabaseReflexions
                        .filter(r => this.extractProjectFromContext(r) !== reflexion.project)
                        .map(r => ({
                        id: this.extractIdFromContext(r),
                        project: this.extractProjectFromContext(r),
                        similarity: r.impact_score || 0.7,
                        validityScore: r.success ? 1.0 : 0.5,
                        reusable: r.success && (r.impact_score || 0) >= 0.8,
                    }))
                        .filter(r => r.similarity >= threshold);
                })().catch(err => {
                    console.warn('Supabase query failed:', err);
                    return [];
                })
                : Promise.resolve([]),
            // Query local AgentDB
            this.findSimilarReflexionsLocal(reflexion, threshold).then(result => result.similarReflexions)
        ]);
        // Merge and deduplicate results
        const cloudReflexions = supabaseResults.status === 'fulfilled' ? supabaseResults.value : [];
        const localReflexions = localResults.status === 'fulfilled' ? localResults.value : [];
        // Deduplicate by ID, prefer cloud results (more metadata)
        const seenIds = new Set();
        const mergedReflexions = [...cloudReflexions, ...localReflexions].filter(r => {
            if (seenIds.has(r.id))
                return false;
            seenIds.add(r.id);
            return true;
        });
        // Sort by similarity
        const similarReflexions = mergedReflexions.sort((a, b) => b.similarity - a.similarity);
        const transferPotential = similarReflexions.length > 0
            ? Math.max(...similarReflexions.map(r => r.similarity * r.validityScore))
            : 0;
        return {
            reflexionId,
            project: reflexion.project,
            similarReflexions,
            transferPotential,
        };
    }
    /**
     * Local similarity search using AgentDB
     */
    async findSimilarReflexionsLocal(reflexion, threshold) {
        const db = await this.getDb();
        if (!db) {
            return {
                reflexionId: reflexion.id,
                project: reflexion.project,
                similarReflexions: [],
                transferPotential: 0
            };
        }
        // Get all reflexions from other projects
        const stmt = db.prepare(`
      SELECT * FROM tracked_reflexions
      WHERE project != ? AND marked_stale = 0 AND validity_score >= ?
    `);
        const candidates = stmt.all(reflexion.project, threshold);
        const similarReflexions = candidates
            .map(candidate => {
            // Simple similarity based on shared insights
            const reflexionInsights = reflexion.insights;
            const candidateInsights = JSON.parse(candidate.insights);
            const sharedInsights = reflexionInsights.filter((insight) => candidateInsights.includes(insight)).length;
            const similarity = (sharedInsights * 2) / (reflexionInsights.length + candidateInsights.length);
            return {
                id: candidate.id,
                project: candidate.project,
                similarity,
                validityScore: candidate.validity_score,
                reusable: similarity >= threshold && candidate.validity_score >= 0.8
            };
        })
            .filter(r => r.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity);
        const transferPotential = similarReflexions.length > 0
            ? Math.max(...similarReflexions.map(r => r.similarity * r.validityScore))
            : 0;
        return {
            reflexionId: reflexion.id,
            project: reflexion.project,
            similarReflexions,
            transferPotential
        };
    }
    /**
     * Generate embedding for reflexion (placeholder - integrate with actual embedding service)
     */
    async generateEmbedding(_reflexion) {
        // TODO: Integrate with OpenAI/Anthropic embeddings API
        // For now, return a dummy embedding based on the reflexion content
        // In production, this would use: const text = `${reflexion.reflection} ${reflexion.insights.join(' ')} ${reflexion.actionItems.join(' ')}`
        return Array(1536).fill(0).map(() => Math.random());
    }
    /**
     * Extract project from Supabase reflexion context
     */
    extractProjectFromContext(reflexion) {
        return reflexion.project || reflexion.context?.project || 'unknown';
    }
    /**
     * Extract ID from Supabase reflexion context
     */
    extractIdFromContext(reflexion) {
        return reflexion.context?.id || reflexion.id;
    }
    // ============================================================================
    // Advisories
    // ============================================================================
    /**
     * Create advisory for developers
     */
    async createAdvisory(advisory) {
        const db = await this.getDb();
        if (!db)
            return;
        const stmt = db.prepare(`
      INSERT INTO reflexion_advisories
      (type, severity, message, reflexion_id, recommendations, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(advisory.type, advisory.severity, advisory.message, advisory.reflexionId, JSON.stringify(advisory.recommendations), advisory.timestamp.getTime());
    }
    /**
     * Get unacknowledged advisories
     */
    async getUnacknowledgedAdvisories() {
        const db = await this.getDb();
        if (!db)
            return [];
        const stmt = db.prepare(`
      SELECT * FROM reflexion_advisories
      WHERE acknowledged = 0
      ORDER BY timestamp DESC
    `);
        const rows = stmt.all();
        return rows.map(row => ({
            type: row.type,
            severity: row.severity,
            message: row.message,
            reflexionId: row.reflexion_id,
            recommendations: JSON.parse(row.recommendations),
            timestamp: new Date(row.timestamp)
        }));
    }
    /**
     * Acknowledge advisory
     */
    async acknowledgeAdvisory(advisoryId) {
        const db = await this.getDb();
        if (!db)
            return;
        const stmt = db.prepare(`
      UPDATE reflexion_advisories
      SET acknowledged = 1
      WHERE id = ?
    `);
        stmt.run(advisoryId);
    }
    // ============================================================================
    // Queries
    // ============================================================================
    /**
     * Get reflexion by ID
     */
    async getReflexion(id) {
        const db = await this.getDb();
        if (!db)
            return null;
        const stmt = db.prepare(`
      SELECT * FROM tracked_reflexions WHERE id = ?
    `);
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            project: row.project,
            expertRole: row.expert_role,
            experience: row.experience,
            reflection: row.reflection,
            insights: JSON.parse(row.insights),
            actionItems: JSON.parse(row.action_items),
            timestamp: new Date(row.timestamp),
            validityScore: row.validity_score,
            usageCount: row.usage_count,
            successfulUses: row.successful_uses,
            lastUsed: row.last_used ? new Date(row.last_used) : undefined,
            markedStale: row.marked_stale === 1,
            staleReason: row.stale_reason
        };
    }
    /**
     * Get all reflexions for a project
     */
    async getProjectReflexions(project, includeStale = false) {
        const query = includeStale
            ? `SELECT * FROM tracked_reflexions WHERE project = ?`
            : `SELECT * FROM tracked_reflexions WHERE project = ? AND marked_stale = 0`;
        const db = await this.getDb();
        if (!db)
            return [];
        const stmt = db.prepare(query);
        const rows = stmt.all(project);
        return rows.map(row => ({
            id: row.id,
            project: row.project,
            expertRole: row.expert_role,
            experience: row.experience,
            reflection: row.reflection,
            insights: JSON.parse(row.insights),
            actionItems: JSON.parse(row.action_items),
            timestamp: new Date(row.timestamp),
            validityScore: row.validity_score,
            usageCount: row.usage_count,
            successfulUses: row.successful_uses,
            lastUsed: row.last_used ? new Date(row.last_used) : undefined,
            markedStale: row.marked_stale === 1,
            staleReason: row.stale_reason
        }));
    }
    /**
     * Get statistics
     * Primary: Uses Supabase reflexion stats
     * Fallback: Uses local AgentDB stats
     */
    async getStats(project) {
        const db = await this.getDb();
        // Try Supabase first
        if (isSupabaseInitialized()) {
            try {
                const supabaseStats = await getReflexionStatsSupabase('tracked_reflexion');
                // Get drift events from local DB (Supabase doesn't track this yet)
                const windowMs = this.config.driftWindow * 24 * 60 * 60 * 1000;
                const cutoff = Date.now() - windowMs;
                const driftCount = db
                    ? db.prepare(`
              SELECT COUNT(*) as count
              FROM drift_events
              WHERE timestamp >= ?
            `).get(cutoff).count
                    : 0;
                return {
                    totalReflexions: supabaseStats.total,
                    staleReflexions: Math.round(supabaseStats.total * (1 - supabaseStats.successRate)),
                    avgValidity: supabaseStats.successRate,
                    totalUsage: supabaseStats.totalReuses,
                    recentDriftEvents: driftCount,
                };
            }
            catch (error) {
                console.warn('Failed to get stats from Supabase, falling back to AgentDB:', error);
            }
        }
        // Fallback to local AgentDB
        if (!db) {
            return {
                totalReflexions: 0,
                staleReflexions: 0,
                avgValidity: 1,
                totalUsage: 0,
                recentDriftEvents: 0
            };
        }
        const projectFilter = project ? `WHERE project = '${project}'` : '';
        const statsStmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(marked_stale) as stale,
        AVG(validity_score) as avg_validity,
        SUM(usage_count) as total_usage
      FROM tracked_reflexions
      ${projectFilter}
    `);
        const stats = statsStmt.get();
        const windowMs = this.config.driftWindow * 24 * 60 * 60 * 1000;
        const cutoff = Date.now() - windowMs;
        const driftStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM drift_events
      WHERE timestamp >= ?
    `);
        const driftCount = driftStmt.get(cutoff).count;
        return {
            totalReflexions: stats.total || 0,
            staleReflexions: stats.stale || 0,
            avgValidity: stats.avg_validity || 1.0,
            totalUsage: stats.total_usage || 0,
            recentDriftEvents: driftCount
        };
    }
    /**
     * Close database connection
     */
    close() {
        const closeDb = () => {
            if (this.db) {
                try {
                    this.db.close();
                }
                catch (error) {
                    console.warn('⚠ ReflexionMonitor: Failed to close AgentDB:', error);
                }
            }
        };
        if (this.dbReady) {
            this.dbReady
                .then(() => closeDb())
                .catch(error => {
                console.warn('⚠ ReflexionMonitor: AgentDB still initializing during close:', error);
            });
            return;
        }
        closeDb();
    }
}
/**
 * Create reflexion monitor instance
 */
export function createReflexionMonitor(config) {
    return new ReflexionMonitor(config);
}
