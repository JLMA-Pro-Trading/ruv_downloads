/**
 * Real AgentDB Integration
 *
 * Full-featured AgentDB integration with:
 * - Vector similarity search for expert retrieval
 * - Causal reasoning for decision tracking
 * - Reflexion memory for self-improvement
 * - Skill library for learned capabilities
 * - Episodic memory for experience tracking
 *
 * @module agentdb-integration
 * @version 1.0.0
 */
import { AgentDBSingleton } from './agentdb-singleton.js';
/**
 * AgentDB Manager for learning and memory
 */
export class AgentDBManager {
    db = null;
    ready;
    config;
    constructor(config = {}) {
        // Support both 'path' and 'dbPath' parameters for backward compatibility
        const dbPath = config.path || config.dbPath || ':memory:';
        this.config = {
            dbPath,
            enableCausalReasoning: config.enableCausalReasoning ?? true,
            enableReflexion: config.enableReflexion ?? true,
            enableSkillLibrary: config.enableSkillLibrary ?? true,
            vectorDimension: config.vectorDimension ?? 1536, // OpenAI ada-002 dimension
            similarityThreshold: config.similarityThreshold ?? 0.75
        };
        // Initialize database asynchronously (methods await this.ready)
        this.ready = this.initializeAgentDb();
    }
    /**
     * Initialize AgentDB using singleton pattern
     */
    initializeAgentDb() {
        return (async () => {
            try {
                this.db = await AgentDBSingleton.getInstance(this.config.dbPath);
                this.initializeTables();
            }
            catch (error) {
                console.warn('⚠ AgentDBManager: Database initialization failed (sql.js compatibility issue):', error);
                this.db = null;
            }
        })();
    }
    /**
     * Initialize database tables for learning features
     */
    initializeTables() {
        if (!this.db)
            return;
        try {
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS kv_store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
            // Expert embeddings table with vector search
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS expert_embeddings (
          expert_id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          signature TEXT NOT NULL,
          embedding BLOB NOT NULL,
          performance REAL DEFAULT 0.0,
          metadata TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
            // Causal decisions table
            if (this.config.enableCausalReasoning) {
                this.db.exec(`
          CREATE TABLE IF NOT EXISTS causal_decisions (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            expert_id TEXT NOT NULL,
            input TEXT NOT NULL,
            output TEXT NOT NULL,
            reasoning TEXT NOT NULL,
            causality TEXT NOT NULL,
            outcome TEXT,
            FOREIGN KEY (expert_id) REFERENCES expert_embeddings(expert_id)
          )
        `);
            }
            // Reflexion entries table
            if (this.config.enableReflexion) {
                this.db.exec(`
          CREATE TABLE IF NOT EXISTS reflexion_entries (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            experience TEXT NOT NULL,
            reflection TEXT NOT NULL,
            insights TEXT NOT NULL,
            action_items TEXT NOT NULL,
            related_decisions TEXT NOT NULL
          )
        `);
            }
            // Skill library table
            if (this.config.enableSkillLibrary) {
                this.db.exec(`
          CREATE TABLE IF NOT EXISTS skill_library (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL,
            implementation TEXT NOT NULL,
            prerequisites TEXT NOT NULL,
            performance TEXT NOT NULL,
            examples TEXT NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
          )
        `);
            }
        }
        catch (error) {
            console.warn('⚠ AgentDBManager: Table initialization failed (sql.js compatibility issue):', error);
            this.db = null;
        }
    }
    // ============================================================================
    // Expert Embeddings & Vector Search
    // ============================================================================
    /**
     * Store expert embedding for semantic search
     */
    async storeExpertEmbedding(expert) {
        await this.ready;
        if (!this.db)
            return;
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO expert_embeddings
      (expert_id, name, signature, embedding, performance, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        const embeddingBuffer = Buffer.from(new Float32Array(expert.embedding).buffer);
        stmt.run(expert.expertId, expert.name, expert.signature, embeddingBuffer, expert.performance, JSON.stringify(expert.metadata));
    }
    /**
     * Find similar experts using vector similarity search
     */
    async findSimilarExperts(queryEmbedding, topK = 5) {
        await this.ready;
        if (!this.db)
            return [];
        const results = this.db.vectorSearch({
            table: 'expert_embeddings',
            column: 'embedding',
            queryVector: queryEmbedding,
            limit: topK,
            threshold: this.config.similarityThreshold
        });
        return results.map((row) => ({
            expertId: row.expert_id,
            name: row.name,
            signature: row.signature,
            embedding: Array.from(new Float32Array(row.embedding.buffer)),
            performance: row.performance,
            metadata: JSON.parse(row.metadata || '{}')
        }));
    }
    /**
     * Get expert by ID
     */
    async getExpert(expertId) {
        await this.ready;
        if (!this.db)
            return null;
        const stmt = this.db.prepare(`
      SELECT * FROM expert_embeddings WHERE expert_id = ?
    `);
        const row = stmt.get(expertId);
        if (!row)
            return null;
        return {
            expertId: row.expert_id,
            name: row.name,
            signature: row.signature,
            embedding: Array.from(new Float32Array(row.embedding.buffer)),
            performance: row.performance,
            metadata: JSON.parse(row.metadata || '{}')
        };
    }
    // ============================================================================
    // Causal Reasoning
    // ============================================================================
    /**
     * Record a causal decision
     */
    async recordCausalDecision(decision) {
        await this.ready;
        if (!this.db)
            return;
        if (!this.config.enableCausalReasoning)
            return;
        const stmt = this.db.prepare(`
      INSERT INTO causal_decisions
      (id, timestamp, expert_id, input, output, reasoning, causality, outcome)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(decision.id, decision.timestamp.getTime(), decision.expertId, JSON.stringify(decision.input), JSON.stringify(decision.output), JSON.stringify(decision.reasoning), JSON.stringify(decision.causality), decision.outcome ? JSON.stringify(decision.outcome) : null);
    }
    /**
     * Get causal chain for a decision
     */
    async getCausalChain(decisionId, depth = 3) {
        await this.ready;
        if (!this.db)
            return [];
        const chain = [];
        const visited = new Set();
        const getDecision = (id) => {
            const stmt = this.db.prepare(`
        SELECT * FROM causal_decisions WHERE id = ?
      `);
            const row = stmt.get(id);
            if (!row)
                return null;
            return {
                id: row.id,
                timestamp: new Date(row.timestamp),
                expertId: row.expert_id,
                input: JSON.parse(row.input),
                output: JSON.parse(row.output),
                reasoning: JSON.parse(row.reasoning),
                causality: JSON.parse(row.causality),
                outcome: row.outcome ? JSON.parse(row.outcome) : undefined
            };
        };
        const traverse = (id, currentDepth) => {
            if (currentDepth >= depth || visited.has(id))
                return;
            visited.add(id);
            const decision = getDecision(id);
            if (!decision)
                return;
            chain.push(decision);
            // Traverse causes
            for (const causeId of decision.causality.causes) {
                traverse(causeId, currentDepth + 1);
            }
        };
        traverse(decisionId, 0);
        return chain;
    }
    // ============================================================================
    // Reflexion Memory
    // ============================================================================
    /**
     * Add reflexion entry for self-improvement
     */
    async addReflexion(entry) {
        await this.ready;
        if (!this.db)
            return;
        if (!this.config.enableReflexion)
            return;
        const stmt = this.db.prepare(`
      INSERT INTO reflexion_entries
      (id, timestamp, experience, reflection, insights, action_items, related_decisions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(entry.id, entry.timestamp.getTime(), entry.experience, entry.reflection, JSON.stringify(entry.insights), JSON.stringify(entry.actionItems), JSON.stringify(entry.relatedDecisions));
    }
    /**
     * Get recent reflexions
     */
    async getRecentReflexions(limit = 10) {
        await this.ready;
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM reflexion_entries
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp),
            experience: row.experience,
            reflection: row.reflection,
            insights: JSON.parse(row.insights),
            actionItems: JSON.parse(row.action_items),
            relatedDecisions: JSON.parse(row.related_decisions)
        }));
    }
    // ============================================================================
    // Skill Library
    // ============================================================================
    /**
     * Add skill to library
     */
    async addSkill(skill) {
        await this.ready;
        if (!this.db)
            return;
        if (!this.config.enableSkillLibrary)
            return;
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO skill_library
      (id, name, description, implementation, prerequisites, performance, examples, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
    `);
        stmt.run(skill.id, skill.name, skill.description, skill.implementation, JSON.stringify(skill.prerequisites), JSON.stringify(skill.performance), JSON.stringify(skill.examples));
    }
    /**
     * Get skill by name
     */
    async getSkill(name) {
        await this.ready;
        if (!this.db)
            return null;
        const stmt = this.db.prepare(`
      SELECT * FROM skill_library WHERE name = ?
    `);
        const row = stmt.get(name);
        if (!row)
            return null;
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            implementation: row.implementation,
            prerequisites: JSON.parse(row.prerequisites),
            performance: JSON.parse(row.performance),
            examples: JSON.parse(row.examples)
        };
    }
    /**
     * List all skills
     */
    async listSkills() {
        await this.ready;
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM skill_library ORDER BY updated_at DESC
    `);
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            implementation: row.implementation,
            prerequisites: JSON.parse(row.prerequisites),
            performance: JSON.parse(row.performance),
            examples: JSON.parse(row.examples)
        }));
    }
    /**
     * Update skill performance metrics
     */
    async updateSkillPerformance(skillName, metrics) {
        if (!this.db)
            return;
        const skill = await this.getSkill(skillName);
        if (!skill)
            return;
        const updatedPerformance = {
            ...skill.performance,
            ...metrics
        };
        const stmt = this.db.prepare(`
      UPDATE skill_library
      SET performance = ?, updated_at = strftime('%s', 'now')
      WHERE name = ?
    `);
        stmt.run(JSON.stringify(updatedPerformance), skillName);
    }
    // ============================================================================
    // Cleanup & Utilities
    // ============================================================================
    // ============================================================================
    // Cross-Project Features
    // ============================================================================
    /**
     * Find experts across all projects by role
     */
    async findExpertsByRole(role, topK = 10) {
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM expert_embeddings
      WHERE name LIKE ? OR expert_id LIKE ?
      ORDER BY performance DESC
      LIMIT ?
    `);
        const rows = stmt.all(`%${role}%`, `%${role}%`, topK);
        return rows.map(row => ({
            expertId: row.expert_id,
            name: row.name,
            signature: row.signature,
            embedding: Array.from(new Float32Array(row.embedding.buffer)),
            performance: row.performance,
            metadata: JSON.parse(row.metadata || '{}')
        }));
    }
    /**
     * Compare expert performance across projects
     */
    async compareExpertsAcrossProjects(expertRole) {
        const experts = await this.findExpertsByRole(expertRole, 100);
        if (experts.length === 0) {
            return {
                expertRole,
                totalExperts: 0,
                avgPerformance: 0,
                bestExpert: null,
                projectPerformance: []
            };
        }
        // Calculate overall stats
        const avgPerformance = experts.reduce((sum, e) => sum + e.performance, 0) / experts.length;
        // Find best expert
        const bestExpert = experts.reduce((best, e) => e.performance > best.performance ? e : best);
        // Group by project
        const projectMap = new Map();
        for (const expert of experts) {
            const project = expert.metadata.project || 'unknown';
            if (!projectMap.has(project)) {
                projectMap.set(project, { sum: 0, count: 0 });
            }
            const stats = projectMap.get(project);
            stats.sum += expert.performance;
            stats.count++;
        }
        const projectPerformance = Array.from(projectMap.entries()).map(([project, stats]) => ({
            project,
            avgPerformance: stats.sum / stats.count,
            count: stats.count
        }));
        return {
            expertRole,
            totalExperts: experts.length,
            avgPerformance,
            bestExpert: {
                expertId: bestExpert.expertId,
                project: bestExpert.metadata.project || 'unknown',
                performance: bestExpert.performance
            },
            projectPerformance: projectPerformance.sort((a, b) => b.avgPerformance - a.avgPerformance)
        };
    }
    /**
     * Export expert knowledge for cross-project sharing
     */
    async exportExpertKnowledge(expertId) {
        if (!this.db)
            return null;
        const expert = await this.getExpert(expertId);
        if (!expert)
            return null;
        // Get all related data
        const skills = await this.listSkills();
        const reflexions = await this.getRecentReflexions(100);
        // Get recent decisions
        const decisionStmt = this.db.prepare(`
      SELECT * FROM causal_decisions
      WHERE expert_id = ?
      ORDER BY timestamp DESC
      LIMIT 50
    `);
        const decisionRows = decisionStmt.all(expertId);
        const decisions = decisionRows.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp),
            expertId: row.expert_id,
            input: JSON.parse(row.input),
            output: JSON.parse(row.output),
            reasoning: JSON.parse(row.reasoning),
            causality: JSON.parse(row.causality),
            outcome: row.outcome ? JSON.parse(row.outcome) : undefined
        }));
        return {
            expert,
            skills,
            reflexions,
            decisions
        };
    }
    /**
     * Import expert knowledge from another project
     */
    async importExpertKnowledge(knowledge, targetProject) {
        // Create new expert ID for target project
        const newExpertId = `${knowledge.expert.expertId}-${targetProject}-${Date.now()}`;
        // Store expert with new ID
        await this.storeExpertEmbedding({
            ...knowledge.expert,
            expertId: newExpertId,
            metadata: {
                ...knowledge.expert.metadata,
                project: targetProject,
                importedFrom: knowledge.expert.metadata.project,
                originalExpertId: knowledge.expert.expertId
            }
        });
        // Import skills
        for (const skill of knowledge.skills) {
            await this.addSkill({
                ...skill,
                id: `${skill.id}-${targetProject}`,
                name: `${skill.name}_${targetProject}`
            });
        }
        return newExpertId;
    }
    /**
     * Close database connection
     */
    /**
     * Close database connection via Singleton
     */
    close() {
        if (this.config.dbPath) {
            AgentDBSingleton.close(this.config.dbPath);
            this.db = null;
        }
    }
    /**
     * Get database statistics
     */
    async getStats() {
        if (!this.db) {
            return {
                expertCount: 0,
                decisionCount: 0,
                reflexionCount: 0,
                skillCount: 0
            };
        }
        const getCount = (table) => {
            const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
            return stmt.get().count;
        };
        return {
            expertCount: getCount('expert_embeddings'),
            decisionCount: this.config.enableCausalReasoning ? getCount('causal_decisions') : 0,
            reflexionCount: this.config.enableReflexion ? getCount('reflexion_entries') : 0,
            skillCount: this.config.enableSkillLibrary ? getCount('skill_library') : 0
        };
    }
    // ============================================================================
    // Generic KV storage for miscellaneous data (rotation, league tables, etc.)
    // ============================================================================
    async setKeyValue(key, value) {
        await this.ready;
        if (!this.db)
            return;
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kv_store (key, value, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `);
        stmt.run(key, JSON.stringify(value));
    }
    async getKeyValue(key) {
        await this.ready;
        if (!this.db)
            return null;
        const stmt = this.db.prepare(`SELECT value FROM kv_store WHERE key = ?`);
        const row = stmt.get(key);
        if (!row)
            return null;
        try {
            return JSON.parse(row.value);
        }
        catch {
            return row.value;
        }
    }
    async deleteKey(key) {
        await this.ready;
        if (!this.db)
            return;
        const stmt = this.db.prepare(`DELETE FROM kv_store WHERE key = ?`);
        stmt.run(key);
    }
    async listKeyPrefix(prefix) {
        await this.ready;
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`SELECT key, value FROM kv_store WHERE key LIKE ?`);
        const rows = stmt.all(`${prefix}%`);
        return rows.map(row => {
            try {
                return { key: row.key, value: JSON.parse(row.value) };
            }
            catch {
                return { key: row.key, value: row.value };
            }
        });
    }
    // ============================================================================
    // High-Level Query Methods
    // ============================================================================
    /**
     * Get expert performance statistics
     */
    async getExpertStats(expertId) {
        await this.ready;
        if (!this.db || !this.config.enableCausalReasoning)
            return null;
        const stmt = this.db.prepare(`
      SELECT
        expert_id,
        COUNT(*) as total_decisions,
        SUM(CASE WHEN json_extract(outcome, '$.success') = 1 THEN 1 ELSE 0 END) as successful_decisions,
        AVG(json_extract(causality, '$.confidence')) as avg_confidence
      FROM causal_decisions
      WHERE expert_id = ?
    `);
        const row = stmt.get(expertId);
        if (!row || row.total_decisions === 0)
            return null;
        const winRate = row.successful_decisions / row.total_decisions;
        // Calculate recent performance (last 10 decisions)
        const recentStmt = this.db.prepare(`
      SELECT AVG(CASE WHEN json_extract(outcome, '$.success') = 1 THEN 1.0 ELSE 0.0 END) as recent_rate
      FROM (
        SELECT outcome FROM causal_decisions
        WHERE expert_id = ?
        ORDER BY timestamp DESC
        LIMIT 10
      )
    `);
        const recentRow = recentStmt.get(expertId);
        const recentPerformance = recentRow?.recent_rate || 0;
        return {
            expertId: row.expert_id,
            totalDecisions: row.total_decisions,
            successfulDecisions: row.successful_decisions,
            winRate,
            averageConfidence: row.avg_confidence || 0,
            recentPerformance
        };
    }
    /**
     * Alias for getExpertStats (backward compatibility)
     */
    async getExpertPerformance(expertId) {
        return this.getExpertStats(expertId);
    }
    /**
     * Get win rate for an expert
     */
    async getWinRate(expertId) {
        const stats = await this.getExpertStats(expertId);
        return stats?.winRate || 0;
    }
    /**
     * Get recent decisions with optional filtering
     */
    async getRecentDecisions(options = {}) {
        await this.ready;
        if (!this.db || !this.config.enableCausalReasoning)
            return [];
        const { expertId, limit = 20, successOnly = false } = options;
        let query = `
      SELECT * FROM causal_decisions
      WHERE 1=1
    `;
        const params = [];
        if (expertId) {
            query += ` AND expert_id = ?`;
            params.push(expertId);
        }
        if (successOnly) {
            query += ` AND json_extract(outcome, '$.success') = 1`;
        }
        query += ` ORDER BY timestamp DESC LIMIT ?`;
        params.push(limit);
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp * 1000),
            expertId: row.expert_id,
            input: JSON.parse(row.input),
            output: JSON.parse(row.output),
            reasoning: JSON.parse(row.reasoning),
            causality: JSON.parse(row.causality),
            outcome: row.outcome ? JSON.parse(row.outcome) : undefined
        }));
    }
    /**
     * Get all experts
     */
    async getAllExperts() {
        await this.ready;
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM expert_embeddings
      ORDER BY performance DESC
    `);
        const rows = stmt.all();
        return rows.map(row => ({
            expertId: row.expert_id,
            name: row.name,
            signature: row.signature,
            embedding: Array.from(new Float32Array(row.embedding.buffer || row.embedding)),
            performance: row.performance,
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
        }));
    }
    /**
     * Get open decisions (decisions without outcomes)
     */
    async getOpenDecisions() {
        await this.ready;
        if (!this.db || !this.config.enableCausalReasoning)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM causal_decisions
      WHERE outcome IS NULL
      ORDER BY timestamp DESC
    `);
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            timestamp: new Date(row.timestamp * 1000),
            expertId: row.expert_id,
            input: JSON.parse(row.input),
            output: JSON.parse(row.output),
            reasoning: JSON.parse(row.reasoning),
            causality: JSON.parse(row.causality),
            outcome: undefined
        }));
    }
    /**
     * Discover patterns in decision data
     */
    async discoverPatterns(options = {}) {
        await this.ready;
        if (!this.db || !this.config.enableCausalReasoning)
            return [];
        const { expertId, minOccurrences = 3, timeWindowDays = 30 } = options;
        const windowSeconds = timeWindowDays * 24 * 60 * 60;
        const cutoff = Math.floor(Date.now() / 1000) - windowSeconds;
        let query = `
      SELECT
        json_extract(reasoning, '$[0]') as pattern,
        COUNT(*) as occurrences,
        AVG(CASE WHEN json_extract(outcome, '$.success') = 1 THEN 1.0 ELSE 0.0 END) as success_rate,
        GROUP_CONCAT(id, '|') as example_ids
      FROM causal_decisions
      WHERE timestamp >= ?
    `;
        const params = [cutoff];
        if (expertId) {
            query += ` AND expert_id = ?`;
            params.push(expertId);
        }
        query += `
      GROUP BY pattern
      HAVING occurrences >= ?
      ORDER BY success_rate DESC, occurrences DESC
    `;
        params.push(minOccurrences);
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params);
        return rows.map(row => ({
            pattern: row.pattern || 'unknown',
            occurrences: row.occurrences,
            successRate: row.success_rate || 0,
            examples: row.example_ids ? row.example_ids.split('|').slice(0, 3) : []
        }));
    }
}
/**
 * Create AgentDB manager with default configuration
 */
export function createAgentDB(config) {
    return new AgentDBManager(config);
}
