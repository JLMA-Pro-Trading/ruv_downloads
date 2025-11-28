/**
 * Discovery Storage - AgentDB-based Expert Discovery and Instrumentation Tracking
 *
 * Stores and tracks discovered experts from codebase scanning:
 * - Expert class detection with telemetry/Supabase status
 * - Instrumentation history and status tracking
 * - User approval workflow for automatic instrumentation
 * - Cross-project expert discovery and reuse
 *
 * Features:
 * - AgentDB singleton pattern for efficient storage
 * - Async initialization with sql.js compatibility
 * - UNIQUE constraints for duplicate prevention
 * - Foreign key relationships for data integrity
 * - Comprehensive indexing for fast queries
 *
 * @module discovery-storage
 * @version 1.0.0
 */
import { AgentDBSingleton } from '../storage/agentdb-singleton.js';
// ============================================================================
// Main Class
// ============================================================================
/**
 * Discovery Storage - AgentDB-based expert discovery and instrumentation tracking
 *
 * Manages discovered experts and their instrumentation lifecycle.
 */
export class DiscoveryStorage {
    db;
    config;
    dbReady = null;
    constructor(config = {}) {
        this.config = {
            dbPath: config.dbPath || './data/discovery-storage.db',
            enableIndexing: config.enableIndexing ?? true,
            autoVacuum: config.autoVacuum ?? true
        };
        this.dbReady = this.initializeDatabase();
    }
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    initializeDatabase() {
        return (async () => {
            try {
                this.db = await AgentDBSingleton.getInstance(this.config.dbPath);
                this.initializeTables();
                if (this.config.autoVacuum) {
                    this.enableAutoVacuum();
                }
                console.log('✅ DiscoveryStorage: Database initialized');
            }
            catch (error) {
                console.warn('⚠ DiscoveryStorage: AgentDB initialization failed:', error);
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
     * Get initialized DB instance
     */
    async getDb() {
        await this.ensureDbReady();
        return this.db;
    }
    /**
     * Initialize database tables
     */
    initializeTables() {
        if (!this.db)
            return;
        try {
            // Discovered experts table
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS discovered_experts (
          id TEXT PRIMARY KEY,
          project TEXT NOT NULL,
          class_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          has_telemetry INTEGER DEFAULT 0,
          has_supabase_init INTEGER DEFAULT 0,
          prediction_methods TEXT NOT NULL,
          discovered_at INTEGER NOT NULL,
          last_scanned INTEGER NOT NULL,
          instrumentation_status TEXT DEFAULT 'pending',
          description TEXT,
          expert_type TEXT,
          confidence REAL DEFAULT 1.0,
          dependencies TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now')),
          UNIQUE(project, class_name, file_path)
        )
      `);
            // Instrumentation history table
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS instrumentation_history (
          id TEXT PRIMARY KEY,
          expert_id TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          action TEXT NOT NULL,
          changes_made TEXT NOT NULL,
          user_approved INTEGER DEFAULT 0,
          user_id TEXT,
          notes TEXT,
          error_message TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (expert_id) REFERENCES discovered_experts(id) ON DELETE CASCADE
        )
      `);
            // Create indexes for common queries
            if (this.config.enableIndexing) {
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_project ON discovered_experts(project)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_status ON discovered_experts(instrumentation_status)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_telemetry ON discovered_experts(has_telemetry)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_supabase ON discovered_experts(has_supabase_init)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_type ON discovered_experts(expert_type)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_confidence ON discovered_experts(confidence)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_experts_last_scanned ON discovered_experts(last_scanned)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_history_expert ON instrumentation_history(expert_id)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_history_action ON instrumentation_history(action)`);
                this.db.exec(`CREATE INDEX IF NOT EXISTS idx_history_timestamp ON instrumentation_history(timestamp)`);
            }
            console.log('✅ DiscoveryStorage: Tables initialized');
        }
        catch (error) {
            console.warn('⚠ DiscoveryStorage: Table initialization failed:', error);
            this.db = null;
        }
    }
    /**
     * Enable auto-vacuum for database maintenance
     */
    enableAutoVacuum() {
        if (!this.db)
            return;
        try {
            this.db.exec('PRAGMA auto_vacuum = FULL');
            console.log('✅ DiscoveryStorage: Auto-vacuum enabled');
        }
        catch (error) {
            console.warn('⚠ DiscoveryStorage: Failed to enable auto-vacuum:', error);
        }
    }
    // ============================================================================
    // Expert Management
    // ============================================================================
    /**
     * Store a discovered expert
     *
     * Uses INSERT OR REPLACE to handle re-scans.
     * Updates last_scanned and other fields if expert already exists.
     */
    async storeDiscoveredExpert(expert) {
        const db = await this.getDb();
        if (!db)
            throw new Error('Database not initialized');
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO discovered_experts
      (id, project, class_name, file_path, has_telemetry, has_supabase_init,
       prediction_methods, discovered_at, last_scanned, instrumentation_status,
       description, expert_type, confidence, dependencies, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);
        stmt.run(expert.id, expert.project, expert.className, expert.filePath, expert.hasTelemetry ? 1 : 0, expert.hasSupabaseInit ? 1 : 0, JSON.stringify(expert.predictionMethods), expert.discoveredAt.getTime(), expert.lastScanned.getTime(), expert.instrumentationStatus, expert.description || null, expert.expertType || null, expert.confidence ?? 1.0, expert.dependencies ? JSON.stringify(expert.dependencies) : null);
        // Record discovery in history
        await this.recordInstrumentation({
            id: this.generateId('hist'),
            expertId: expert.id,
            timestamp: new Date(),
            action: 'discovered',
            changesMade: [],
            userApproved: false,
            notes: `Discovered expert: ${expert.className}`
        });
    }
    /**
     * Store multiple experts in a batch (uses transaction)
     */
    async storeDiscoveredExpertsBatch(experts) {
        const db = await this.getDb();
        if (!db)
            throw new Error('Database not initialized');
        db.exec('BEGIN TRANSACTION');
        try {
            for (const expert of experts) {
                await this.storeDiscoveredExpert(expert);
            }
            db.exec('COMMIT');
        }
        catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    }
    /**
     * Get expert by ID
     */
    async getExpert(id) {
        const db = await this.getDb();
        if (!db)
            return null;
        const stmt = db.prepare('SELECT * FROM discovered_experts WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return this.rowToExpert(row);
    }
    /**
     * Get all experts for a project
     */
    async getProjectExperts(project) {
        const db = await this.getDb();
        if (!db)
            return [];
        const stmt = db.prepare('SELECT * FROM discovered_experts WHERE project = ? ORDER BY last_scanned DESC');
        const rows = stmt.all(project);
        return rows.map(row => this.rowToExpert(row));
    }
    /**
     * Get experts that need instrumentation (no telemetry or Supabase)
     */
    async getUninstrumentedExperts(project) {
        const db = await this.getDb();
        if (!db)
            return [];
        let query = `
      SELECT * FROM discovered_experts
      WHERE (has_telemetry = 0 OR has_supabase_init = 0)
        AND instrumentation_status IN ('pending', 'approved')
    `;
        const params = [];
        if (project) {
            query += ' AND project = ?';
            params.push(project);
        }
        query += ' ORDER BY confidence DESC, last_scanned DESC';
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => this.rowToExpert(row));
    }
    /**
     * Get experts with filters
     */
    async getExperts(filters = {}) {
        const db = await this.getDb();
        if (!db)
            return [];
        const conditions = [];
        const params = [];
        if (filters.project) {
            conditions.push('project = ?');
            params.push(filters.project);
        }
        if (filters.hasTelemetry !== undefined) {
            conditions.push('has_telemetry = ?');
            params.push(filters.hasTelemetry ? 1 : 0);
        }
        if (filters.hasSupabaseInit !== undefined) {
            conditions.push('has_supabase_init = ?');
            params.push(filters.hasSupabaseInit ? 1 : 0);
        }
        if (filters.instrumentationStatus) {
            const statuses = Array.isArray(filters.instrumentationStatus)
                ? filters.instrumentationStatus
                : [filters.instrumentationStatus];
            const placeholders = statuses.map(() => '?').join(',');
            conditions.push(`instrumentation_status IN (${placeholders})`);
            params.push(...statuses);
        }
        if (filters.expertType) {
            conditions.push('expert_type = ?');
            params.push(filters.expertType);
        }
        if (filters.minConfidence !== undefined) {
            conditions.push('confidence >= ?');
            params.push(filters.minConfidence);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const query = `SELECT * FROM discovered_experts ${whereClause} ORDER BY confidence DESC, last_scanned DESC`;
        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => this.rowToExpert(row));
    }
    /**
     * Update instrumentation status
     */
    async updateInstrumentationStatus(expertId, status, notes) {
        const db = await this.getDb();
        if (!db)
            throw new Error('Database not initialized');
        const stmt = db.prepare(`
      UPDATE discovered_experts
      SET instrumentation_status = ?, updated_at = strftime('%s', 'now')
      WHERE id = ?
    `);
        stmt.run(status, expertId);
        // Record status change in history
        await this.recordInstrumentation({
            id: this.generateId('hist'),
            expertId,
            timestamp: new Date(),
            action: status === 'instrumented' ? 'instrumented' :
                status === 'skipped' ? 'skipped' : 'updated',
            changesMade: [],
            userApproved: status === 'approved',
            notes: notes || `Status changed to: ${status}`
        });
    }
    /**
     * Mark expert as instrumented with changes
     */
    async markInstrumented(expertId, changes, userId, notes) {
        const db = await this.getDb();
        if (!db)
            throw new Error('Database not initialized');
        // Update expert status and telemetry flags based on changes
        const hasTelemetry = changes.some(c => c.changeType === 'telemetry_added' || c.changeType === 'method_wrapped');
        const hasSupabase = changes.some(c => c.changeType === 'supabase_init');
        const stmt = db.prepare(`
      UPDATE discovered_experts
      SET instrumentation_status = 'instrumented',
          has_telemetry = ?,
          has_supabase_init = ?,
          updated_at = strftime('%s', 'now')
      WHERE id = ?
    `);
        stmt.run(hasTelemetry ? 1 : 0, hasSupabase ? 1 : 0, expertId);
        // Record instrumentation in history
        await this.recordInstrumentation({
            id: this.generateId('hist'),
            expertId,
            timestamp: new Date(),
            action: 'instrumented',
            changesMade: changes,
            userApproved: true,
            userId,
            notes: notes || `Instrumented with ${changes.length} changes`
        });
    }
    /**
     * Delete expert by ID
     */
    async deleteExpert(id) {
        const db = await this.getDb();
        if (!db)
            throw new Error('Database not initialized');
        const stmt = db.prepare('DELETE FROM discovered_experts WHERE id = ?');
        stmt.run(id);
        // History is automatically deleted due to CASCADE
    }
    // ============================================================================
    // Instrumentation History
    // ============================================================================
    /**
     * Record instrumentation event
     */
    async recordInstrumentation(record) {
        const db = await this.getDb();
        if (!db)
            throw new Error('Database not initialized');
        const stmt = db.prepare(`
      INSERT INTO instrumentation_history
      (id, expert_id, timestamp, action, changes_made, user_approved, user_id, notes, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(record.id, record.expertId, record.timestamp.getTime(), record.action, JSON.stringify(record.changesMade), record.userApproved ? 1 : 0, record.userId || null, record.notes || null, record.errorMessage || null);
    }
    /**
     * Get instrumentation history for a project
     */
    async getInstrumentationHistory(project, limit) {
        const db = await this.getDb();
        if (!db)
            return [];
        const query = `
      SELECT h.* FROM instrumentation_history h
      JOIN discovered_experts e ON h.expert_id = e.id
      WHERE e.project = ?
      ORDER BY h.timestamp DESC
      ${limit ? `LIMIT ${limit}` : ''}
    `;
        const stmt = db.prepare(query);
        const rows = stmt.all(project);
        return rows.map(row => this.rowToHistory(row));
    }
    /**
     * Get instrumentation history for a specific expert
     */
    async getExpertHistory(expertId) {
        const db = await this.getDb();
        if (!db)
            return [];
        const stmt = db.prepare(`
      SELECT * FROM instrumentation_history
      WHERE expert_id = ?
      ORDER BY timestamp DESC
    `);
        const rows = stmt.all(expertId);
        return rows.map(row => this.rowToHistory(row));
    }
    /**
     * Get recent instrumentation events across all projects
     */
    async getRecentInstrumentations(limit = 50) {
        const db = await this.getDb();
        if (!db)
            return [];
        const stmt = db.prepare(`
      SELECT * FROM instrumentation_history
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map(row => this.rowToHistory(row));
    }
    // ============================================================================
    // Statistics and Analytics
    // ============================================================================
    /**
     * Get discovery statistics
     */
    async getStats(project) {
        const db = await this.getDb();
        if (!db) {
            return this.emptyStats();
        }
        const projectFilter = project ? `WHERE project = '${project}'` : '';
        // Total counts
        const totalStmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(has_telemetry) as with_telemetry,
        SUM(has_supabase_init) as with_supabase,
        AVG(confidence) as avg_confidence
      FROM discovered_experts
      ${projectFilter}
    `);
        const totals = totalStmt.get();
        // Status breakdown
        const statusStmt = db.prepare(`
      SELECT instrumentation_status, COUNT(*) as count
      FROM discovered_experts
      ${projectFilter}
      GROUP BY instrumentation_status
    `);
        const statusRows = statusStmt.all();
        const byStatus = {
            pending: 0,
            approved: 0,
            instrumented: 0,
            skipped: 0,
            failed: 0,
            needs_review: 0
        };
        statusRows.forEach(row => {
            byStatus[row.instrumentation_status] = row.count;
        });
        // Project breakdown
        const projectStmt = db.prepare(`
      SELECT project, COUNT(*) as count
      FROM discovered_experts
      ${project ? `WHERE project = '${project}'` : ''}
      GROUP BY project
    `);
        const projectRows = projectStmt.all();
        const byProject = {};
        projectRows.forEach(row => {
            byProject[row.project] = row.count;
        });
        // Needs instrumentation
        const needsStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM discovered_experts
      WHERE (has_telemetry = 0 OR has_supabase_init = 0)
        AND instrumentation_status NOT IN ('instrumented', 'skipped')
      ${project ? `AND project = '${project}'` : ''}
    `);
        const needsCount = needsStmt.get().count;
        return {
            totalExperts: totals.total || 0,
            byStatus,
            byProject,
            withTelemetry: totals.with_telemetry || 0,
            withSupabase: totals.with_supabase || 0,
            needsInstrumentation: needsCount || 0,
            averageConfidence: totals.avg_confidence || 0
        };
    }
    /**
     * Empty stats object
     */
    emptyStats() {
        return {
            totalExperts: 0,
            byStatus: {
                pending: 0,
                approved: 0,
                instrumented: 0,
                skipped: 0,
                failed: 0,
                needs_review: 0
            },
            byProject: {},
            withTelemetry: 0,
            withSupabase: 0,
            needsInstrumentation: 0,
            averageConfidence: 0
        };
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Convert database row to DiscoveredExpert
     */
    rowToExpert(row) {
        return {
            id: row.id,
            project: row.project,
            className: row.class_name,
            filePath: row.file_path,
            hasTelemetry: row.has_telemetry === 1,
            hasSupabaseInit: row.has_supabase_init === 1,
            predictionMethods: JSON.parse(row.prediction_methods),
            discoveredAt: new Date(row.discovered_at),
            lastScanned: new Date(row.last_scanned),
            instrumentationStatus: row.instrumentation_status,
            description: row.description || undefined,
            expertType: row.expert_type || undefined,
            confidence: row.confidence || 1.0,
            dependencies: row.dependencies ? JSON.parse(row.dependencies) : undefined
        };
    }
    /**
     * Convert database row to InstrumentationRecord
     */
    rowToHistory(row) {
        return {
            id: row.id,
            expertId: row.expert_id,
            timestamp: new Date(row.timestamp),
            action: row.action,
            changesMade: JSON.parse(row.changes_made),
            userApproved: row.user_approved === 1,
            userId: row.user_id || undefined,
            notes: row.notes || undefined,
            errorMessage: row.error_message || undefined
        };
    }
    /**
     * Generate unique ID
     */
    generateId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            try {
                // Don't close singleton - it's managed globally
                // Just clear reference
                this.db = null;
                console.log('✅ DiscoveryStorage: Connection released');
            }
            catch (error) {
                console.warn('⚠ DiscoveryStorage: Failed to release connection:', error);
            }
        }
    }
}
/**
 * Factory function to create storage instance
 */
export function createDiscoveryStorage(config) {
    return new DiscoveryStorage(config);
}
