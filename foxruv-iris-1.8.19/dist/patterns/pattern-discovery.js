/**
 * Pattern Discovery - Cross-Domain Learning Engine
 *
 * Discovers effective patterns, strategies, and reasoning chains across domains
 * using Supabase pgvector for centralized pattern storage and vector search.
 * Falls back to AgentDB for local acceleration.
 *
 * Features:
 * - Vector similarity search for patterns (Supabase pgvector primary, AgentDB fallback)
 * - Cross-domain strategy discovery
 * - Few-shot example retrieval
 * - Decision chain matching
 * - Transfer learning recommendations
 * - Centralized pattern storage across all projects
 *
 * @module pattern-discovery
 * @version 2.0.0
 */
import { AgentDBManager } from '../storage/agentdb-integration.js';
import { AgentDBSingleton } from '../storage/agentdb-singleton.js';
import { getSupabase, getProjectId, isSupabaseInitialized, saveReflexion, findSimilarReflexions, markReflexionReused } from '../supabase/index.js';
/**
 * Pattern Discovery Engine
 */
export class PatternDiscovery {
    db;
    agentDB;
    config;
    useSupabase;
    agentDbReady = null;
    constructor(config = {}) {
        this.config = {
            dbPath: config.dbPath || './data/pattern-discovery.db',
            agentDBPath: config.agentDBPath || './data/pattern-agentdb.db',
            similarityThreshold: config.similarityThreshold ?? 0.7,
            minUsageForTransfer: config.minUsageForTransfer ?? 5,
            enableAutoTransfer: config.enableAutoTransfer ?? false,
            useSupabase: config.useSupabase ?? true,
            enableAgentDBCache: config.enableAgentDBCache ?? false
        };
        // Check if Supabase is available
        this.useSupabase = this.config.useSupabase && isSupabaseInitialized();
        // Initialize local SQLite DB for fallback and metadata
        this.agentDbReady = this.initializeAgentDb();
        // Initialize AgentDB for local caching/acceleration if enabled
        if (this.config.enableAgentDBCache || !this.useSupabase) {
            this.agentDB = new AgentDBManager({
                dbPath: this.config.agentDBPath,
                enableCausalReasoning: true,
                enableReflexion: true,
                enableSkillLibrary: true
            });
        }
    }
    /**
     * Initialize AgentDB (handles async sql.js loader)
     */
    initializeAgentDb() {
        return (async () => {
            try {
                this.db = await AgentDBSingleton.getInstance(this.config.dbPath);
                this.initializeTables();
            }
            catch (error) {
                console.warn('⚠ PatternDiscovery: AgentDB initialization failed (sql.js compatibility issue):', error);
                this.db = null;
            }
        })();
    }
    /**
     * Ensure AgentDB (if enabled) has finished initializing
     */
    async ensureAgentDbReady() {
        const ready = this.agentDbReady;
        if (ready) {
            try {
                await ready;
            }
            finally {
                if (this.agentDbReady === ready) {
                    this.agentDbReady = null;
                }
            }
        }
    }
    /**
     * Convenience helper to get initialized DB instance
     */
    async getDb() {
        await this.ensureAgentDbReady();
        return this.db;
    }
    /**
     * Initialize database tables
     */
    initializeTables() {
        if (!this.db)
            return;
        try {
            // Learned patterns
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS learned_patterns (
          pattern_id TEXT PRIMARY KEY,
          project TEXT NOT NULL,
          domain TEXT NOT NULL,
          pattern_type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          context TEXT NOT NULL,
          implementation TEXT NOT NULL,
          success_rate REAL DEFAULT 0.0,
          avg_confidence REAL DEFAULT 0.0,
          usage_count INTEGER DEFAULT 0,
          domains TEXT NOT NULL,
          reusable INTEGER DEFAULT 1,
          metadata TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
            // Pattern usage history
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS pattern_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_id TEXT NOT NULL,
          project TEXT NOT NULL,
          domain TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          success INTEGER NOT NULL,
          adaptations TEXT,
          context TEXT,
          FOREIGN KEY (pattern_id) REFERENCES learned_patterns(pattern_id)
        )
      `);
            // Transfer recommendations
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS transfer_recommendations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_project TEXT NOT NULL,
          target_project TEXT NOT NULL,
          pattern_id TEXT NOT NULL,
          expected_improvement REAL NOT NULL,
          confidence REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          applied_at INTEGER,
          actual_improvement REAL,
          created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
      `);
            // Create indexes
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_project ON learned_patterns(project)`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_domain ON learned_patterns(domain)`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_type ON learned_patterns(pattern_type)`);
            this.db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_pattern ON pattern_usage(pattern_id)`);
        }
        catch (error) {
            console.warn('⚠ PatternDiscovery: Table initialization failed (sql.js compatibility issue):', error);
            this.db = null;
        }
    }
    // ============================================================================
    // Pattern Learning & Storage
    // ============================================================================
    /**
     * Learn and store a new pattern
     * DUAL-WRITE: Saves to BOTH Supabase, AgentDB, and local DB
     */
    async learnPattern(pattern) {
        const patternId = `pattern-${pattern.project}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // Generate embedding for vector search
        const embedding = await this.generatePatternEmbedding(pattern);
        // Write to ALL stores concurrently
        const results = await Promise.allSettled([
            // Store in local SQLite DB (reliable metadata store)
            (async () => {
                const db = await this.getDb();
                if (!db)
                    return;
                const stmt = db.prepare(`
          INSERT INTO learned_patterns
          (pattern_id, project, domain, pattern_type, name, description, context,
           implementation, success_rate, avg_confidence, usage_count, domains,
           reusable, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
                stmt.run(patternId, pattern.project, pattern.domain, pattern.patternType, pattern.name, pattern.description, JSON.stringify(pattern.context), pattern.implementation, pattern.performanceMetrics.successRate, pattern.performanceMetrics.avgConfidence, pattern.performanceMetrics.usageCount, JSON.stringify(pattern.performanceMetrics.domains), pattern.reusable ? 1 : 0, pattern.metadata ? JSON.stringify(pattern.metadata) : null);
            })(),
            // Store in AgentDB (vector search, local acceleration)
            this.agentDB
                ? this.agentDB.storeExpertEmbedding({
                    expertId: patternId,
                    name: pattern.name,
                    signature: pattern.description,
                    embedding,
                    performance: pattern.performanceMetrics.successRate,
                    metadata: {
                        patternType: pattern.patternType,
                        project: pattern.project,
                        domain: pattern.domain,
                        reusable: pattern.reusable
                    }
                })
                : Promise.resolve(),
            // Store in Supabase (cloud, cross-project vector search)
            this.useSupabase
                ? saveReflexion(`pattern:${pattern.patternType}`, {
                    name: pattern.name,
                    description: pattern.description,
                    domain: pattern.domain,
                    context: pattern.context,
                    implementation: pattern.implementation,
                    reusable: pattern.reusable,
                    patternId,
                    metadata: pattern.metadata
                }, {
                    successRate: pattern.performanceMetrics.successRate,
                    avgConfidence: pattern.performanceMetrics.avgConfidence,
                    usageCount: pattern.performanceMetrics.usageCount,
                    domains: pattern.performanceMetrics.domains
                }, pattern.performanceMetrics.successRate > 0.5, {
                    expertId: patternId,
                    embedding,
                    confidence: pattern.performanceMetrics.avgConfidence,
                    impactScore: pattern.performanceMetrics.successRate
                }).catch(err => {
                    console.warn('Supabase pattern write failed (non-blocking):', err);
                    return null;
                })
                : Promise.resolve(null)
        ]);
        // Log results but only fail if local DB fails
        const [localResult, agentdbResult, supabaseResult] = results;
        if (localResult.status === 'rejected') {
            console.error('Local DB pattern write failed:', localResult.reason);
            throw new Error('Failed to write pattern to local database');
        }
        if (agentdbResult.status === 'rejected') {
            console.warn('AgentDB pattern write failed (continuing):', agentdbResult.reason);
        }
        if (supabaseResult.status === 'rejected') {
            console.warn('Supabase pattern write failed (continuing):', supabaseResult.reason);
        }
        return patternId;
    }
    /**
     * Generate embedding for a pattern (mock - replace with real embeddings)
     */
    async generatePatternEmbedding(pattern) {
        // In production, use OpenAI embeddings or similar
        // For now, generate mock embedding based on pattern characteristics
        const text = `${pattern.name} ${pattern.description} ${pattern.patternType} ${pattern.domain}`;
        // Mock: create deterministic embedding based on text
        const embedding = new Array(1536).fill(0);
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            embedding[i % 1536] += charCode / 1000;
        }
        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / magnitude);
    }
    /**
     * Record pattern usage
     */
    async recordUsage(patternId, project, domain, success, adaptations, context) {
        // Primary: Update usage in Supabase
        if (this.useSupabase) {
            try {
                // Find the reflexion entry for this pattern
                const supabase = getSupabase();
                const { data: reflexions } = await supabase
                    .from('reflexion_bank')
                    .select('*')
                    .eq('project', getProjectId())
                    .eq('expert_id', patternId)
                    .limit(1);
                if (reflexions && reflexions.length > 0) {
                    const reflexionId = reflexions[0].id;
                    await markReflexionReused(reflexionId);
                }
            }
            catch (error) {
                console.error('Failed to update pattern usage in Supabase:', error);
            }
        }
        // Record usage in local DB
        const db = await this.getDb();
        if (!db)
            return;
        const usageStmt = db.prepare(`
      INSERT INTO pattern_usage
      (pattern_id, project, domain, timestamp, success, adaptations, context)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        usageStmt.run(patternId, project, domain, Date.now(), success ? 1 : 0, adaptations ? JSON.stringify(adaptations) : null, context ? JSON.stringify(context) : null);
        // Update pattern metrics
        await this.updatePatternMetrics(patternId);
        // Update AgentDB performance if enabled
        if (this.agentDB) {
            const pattern = await this.getPattern(patternId);
            if (pattern) {
                await this.agentDB.storeExpertEmbedding({
                    expertId: patternId,
                    name: pattern.name,
                    signature: pattern.description,
                    embedding: pattern.embedding,
                    performance: pattern.performanceMetrics.successRate,
                    metadata: {
                        patternType: pattern.patternType,
                        project: pattern.project,
                        domain: pattern.domain,
                        reusable: pattern.reusable
                    }
                });
            }
        }
    }
    /**
     * Update pattern metrics
     */
    async updatePatternMetrics(patternId) {
        const db = await this.getDb();
        if (!db)
            return;
        const stmt = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(success) as successful,
        COUNT(DISTINCT domain) as domains
      FROM pattern_usage
      WHERE pattern_id = ?
    `);
        const stats = stmt.get(patternId);
        const successRate = stats.total > 0 ? stats.successful / stats.total : 0;
        // Get unique domains
        const domainsStmt = db.prepare(`
      SELECT DISTINCT domain FROM pattern_usage WHERE pattern_id = ?
    `);
        const domainRows = domainsStmt.all(patternId);
        const domains = domainRows.map(row => row.domain);
        const updateStmt = db.prepare(`
      UPDATE learned_patterns
      SET success_rate = ?,
          usage_count = ?,
          domains = ?,
          updated_at = ?
      WHERE pattern_id = ?
    `);
        updateStmt.run(successRate, stats.total, JSON.stringify(domains), Date.now(), patternId);
    }
    // ============================================================================
    // Pattern Discovery
    // ============================================================================
    /**
     * Find similar patterns using vector search
     * DUAL-READ: Queries BOTH Supabase and AgentDB, merges results
     */
    async findSimilarPatterns(context, threshold) {
        const similarityThreshold = threshold ?? this.config.similarityThreshold;
        // Generate query embedding
        const queryText = JSON.stringify(context);
        const queryEmbedding = await this.generatePatternEmbedding({
            name: '',
            description: queryText,
            patternType: 'strategy',
            project: '',
            domain: '',
            context,
            implementation: '',
            performanceMetrics: {
                successRate: 0,
                avgConfidence: 0,
                usageCount: 0,
                domains: []
            },
            reusable: true
        });
        // Query BOTH sources concurrently
        const [supabaseResults, agentdbResults] = await Promise.allSettled([
            // Query Supabase for cross-project patterns
            this.useSupabase
                ? (async () => {
                    const similarReflexions = await findSimilarReflexions(queryEmbedding, {
                        successOnly: false,
                        limit: 20,
                        minImpactScore: 0.5
                    });
                    const matches = [];
                    for (const reflexion of similarReflexions) {
                        const patternContext = reflexion.context;
                        if (!patternContext.patternId || !patternContext.reusable)
                            continue;
                        const pattern = {
                            patternId: patternContext.patternId,
                            project: reflexion.project,
                            domain: patternContext.domain || '',
                            patternType: reflexion.reflexion_type.replace('pattern:', ''),
                            name: patternContext.name || '',
                            description: patternContext.description || '',
                            context: patternContext.context || {},
                            implementation: patternContext.implementation || '',
                            embedding: reflexion.embedding || [],
                            performanceMetrics: {
                                successRate: reflexion.outcome?.successRate || reflexion.impact_score || 0,
                                avgConfidence: reflexion.confidence || 0,
                                usageCount: reflexion.reuse_count || 0,
                                domains: reflexion.outcome?.domains || [patternContext.domain]
                            },
                            reusable: true,
                            metadata: patternContext.metadata
                        };
                        const similarity = reflexion.impact_score || 0.5;
                        if (similarity < similarityThreshold)
                            continue;
                        const transferPotential = this.calculateTransferPotential(pattern, context);
                        const adaptationRequired = this.assessAdaptationNeeded(pattern, context);
                        const suggestions = this.generateTransferSuggestions(pattern, context, adaptationRequired);
                        matches.push({ pattern, similarity, transferPotential, adaptationRequired, suggestions });
                    }
                    return matches;
                })().catch(err => {
                    console.warn('Supabase pattern search failed:', err);
                    return [];
                })
                : Promise.resolve([]),
            // Query AgentDB for local patterns
            this.agentDB
                ? (async () => {
                    const similarExperts = await this.agentDB.findSimilarExperts(queryEmbedding, 10);
                    const matches = [];
                    for (const expert of similarExperts) {
                        const pattern = await this.getPattern(expert.expertId);
                        if (!pattern || !pattern.reusable)
                            continue;
                        const similarity = expert.performance;
                        if (similarity < similarityThreshold)
                            continue;
                        const transferPotential = this.calculateTransferPotential(pattern, context);
                        const adaptationRequired = this.assessAdaptationNeeded(pattern, context);
                        const suggestions = this.generateTransferSuggestions(pattern, context, adaptationRequired);
                        matches.push({ pattern, similarity, transferPotential, adaptationRequired, suggestions });
                    }
                    return matches;
                })()
                : Promise.resolve([])
        ]);
        // Merge and deduplicate results
        const cloudMatches = supabaseResults.status === 'fulfilled' ? supabaseResults.value : [];
        const localMatches = agentdbResults.status === 'fulfilled' ? agentdbResults.value : [];
        // Deduplicate by pattern ID, prefer cloud results (more metadata)
        const seenIds = new Set();
        const mergedMatches = [...cloudMatches, ...localMatches].filter(m => {
            if (seenIds.has(m.pattern.patternId))
                return false;
            seenIds.add(m.pattern.patternId);
            return true;
        });
        return mergedMatches.sort((a, b) => b.transferPotential - a.transferPotential);
    }
    /**
     * Calculate transfer potential
     */
    calculateTransferPotential(pattern, targetContext) {
        let potential = pattern.performanceMetrics.successRate;
        // Boost if used in multiple domains
        if (pattern.performanceMetrics.domains.length > 2) {
            potential *= 1.2;
        }
        // Boost if high usage count
        if (pattern.performanceMetrics.usageCount >= this.config.minUsageForTransfer) {
            potential *= 1.1;
        }
        // Reduce if context mismatch
        const contextOverlap = this.calculateContextOverlap(pattern.context, targetContext);
        potential *= contextOverlap;
        return Math.min(potential, 1.0);
    }
    /**
     * Calculate context overlap
     */
    calculateContextOverlap(sourceContext, _targetContext) {
        const sourceKeys = Object.keys(sourceContext);
        const targetKeys = Object.keys(_targetContext);
        const commonKeys = sourceKeys.filter(key => targetKeys.includes(key));
        const totalKeys = new Set([...sourceKeys, ...targetKeys]).size;
        return commonKeys.length / totalKeys;
    }
    /**
     * Assess adaptation needed
     */
    assessAdaptationNeeded(pattern, targetContext) {
        const overlap = this.calculateContextOverlap(pattern.context, targetContext);
        if (overlap > 0.9)
            return 'none';
        if (overlap > 0.7)
            return 'minor';
        if (overlap > 0.5)
            return 'moderate';
        return 'major';
    }
    /**
     * Generate transfer suggestions
     */
    generateTransferSuggestions(pattern, _targetContext, adaptationRequired) {
        const suggestions = [];
        if (adaptationRequired === 'none') {
            suggestions.push('Pattern can be used as-is');
            suggestions.push('No modifications required');
        }
        else if (adaptationRequired === 'minor') {
            suggestions.push('Adjust context parameters to match target domain');
            suggestions.push('Test with small sample before full deployment');
        }
        else if (adaptationRequired === 'moderate') {
            suggestions.push('Modify implementation to fit target context');
            suggestions.push('Add domain-specific adaptations');
            suggestions.push('Run A/B test against baseline');
        }
        else {
            suggestions.push('Use as inspiration rather than direct transfer');
            suggestions.push('Extract core strategy and rebuild for target domain');
            suggestions.push('Consider hybrid approach combining with existing patterns');
        }
        suggestions.push(`Pattern success rate: ${(pattern.performanceMetrics.successRate * 100).toFixed(1)}%`);
        suggestions.push(`Used in ${pattern.performanceMetrics.domains.length} domain(s)`);
        return suggestions;
    }
    // ============================================================================
    // Transfer Recommendations
    // ============================================================================
    /**
     * Generate transfer recommendations for a project
     */
    async generateTransferRecommendations(targetProject, _targetDomain, targetContext) {
        // Find similar patterns
        const matches = await this.findSimilarPatterns(targetContext);
        const recommendations = [];
        for (const match of matches) {
            if (match.transferPotential < 0.6)
                continue;
            const adaptationSteps = this.generateAdaptationSteps(match.pattern, match.adaptationRequired);
            const requiredContext = this.extractRequiredContext(match.pattern);
            const risks = this.assessTransferRisks(match.pattern, match.adaptationRequired);
            recommendations.push({
                sourceProject: match.pattern.project,
                targetProject,
                patternId: match.pattern.patternId,
                patternType: match.pattern.patternType,
                expectedImprovement: match.transferPotential * 0.3, // Conservative estimate
                confidence: match.similarity,
                adaptationSteps,
                requiredContext,
                risks
            });
        }
        // Store recommendations
        const db = await this.getDb();
        if (!db)
            return recommendations;
        for (const rec of recommendations) {
            const stmt = db.prepare(`
        INSERT INTO transfer_recommendations
        (source_project, target_project, pattern_id, expected_improvement, confidence)
        VALUES (?, ?, ?, ?, ?)
      `);
            stmt.run(rec.sourceProject, rec.targetProject, rec.patternId, rec.expectedImprovement, rec.confidence);
        }
        return recommendations.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
    }
    /**
     * Generate adaptation steps
     */
    generateAdaptationSteps(_pattern, adaptationRequired) {
        const steps = [];
        if (adaptationRequired === 'none') {
            steps.push('1. Copy pattern implementation directly');
            steps.push('2. Test with validation data');
            steps.push('3. Deploy if metrics meet threshold');
        }
        else if (adaptationRequired === 'minor') {
            steps.push('1. Review pattern implementation');
            steps.push('2. Adjust context parameters');
            steps.push('3. Run pilot test with 10% traffic');
            steps.push('4. Monitor metrics and adjust');
        }
        else if (adaptationRequired === 'moderate') {
            steps.push('1. Extract core strategy from pattern');
            steps.push('2. Rebuild for target domain specifics');
            steps.push('3. Add domain-specific validations');
            steps.push('4. A/B test against baseline');
            steps.push('5. Gradual rollout with monitoring');
        }
        else {
            steps.push('1. Study pattern strategy and approach');
            steps.push('2. Design custom implementation for target');
            steps.push('3. Prototype and validate locally');
            steps.push('4. Extended testing period');
            steps.push('5. Careful rollout with fallback plan');
        }
        return steps;
    }
    /**
     * Extract required context
     */
    extractRequiredContext(pattern) {
        return Object.keys(pattern.context).map(key => `${key}: ${typeof pattern.context[key]}`);
    }
    /**
     * Assess transfer risks
     */
    assessTransferRisks(pattern, adaptationRequired) {
        const risks = [];
        if (pattern.performanceMetrics.usageCount < this.config.minUsageForTransfer) {
            risks.push('Limited usage history - may not be battle-tested');
        }
        if (pattern.performanceMetrics.domains.length === 1) {
            risks.push('Only used in single domain - cross-domain effectiveness unknown');
        }
        if (adaptationRequired === 'major') {
            risks.push('Significant adaptation required - transfer may not preserve effectiveness');
        }
        if (pattern.performanceMetrics.successRate < 0.8) {
            risks.push('Moderate success rate - not consistently high performing');
        }
        if (risks.length === 0) {
            risks.push('Low risk - pattern is well-tested and suitable');
        }
        return risks;
    }
    // ============================================================================
    // Pattern Evolution
    // ============================================================================
    /**
     * Get pattern evolution history
     */
    async getPatternEvolution(patternId) {
        const pattern = await this.getPattern(patternId);
        if (!pattern) {
            throw new Error(`Pattern ${patternId} not found`);
        }
        const db = await this.getDb();
        if (!db) {
            return {
                patternId,
                versions: [],
                crossDomainUsage: []
            };
        }
        // Get usage history
        const usageStmt = db.prepare(`
      SELECT
        project,
        domain,
        timestamp,
        success,
        adaptations
      FROM pattern_usage
      WHERE pattern_id = ?
      ORDER BY timestamp ASC
    `);
        const usageHistory = usageStmt.all(patternId);
        // Group by project/domain
        const crossDomainMap = new Map();
        for (const usage of usageHistory) {
            const key = `${usage.project}-${usage.domain}`;
            if (!crossDomainMap.has(key)) {
                crossDomainMap.set(key, {
                    project: usage.project,
                    domain: usage.domain,
                    total: 0,
                    successful: 0,
                    adaptations: new Set()
                });
            }
            const stats = crossDomainMap.get(key);
            stats.total++;
            if (usage.success)
                stats.successful++;
            if (usage.adaptations) {
                const adapts = JSON.parse(usage.adaptations);
                adapts.forEach((a) => stats.adaptations.add(a));
            }
        }
        const crossDomainUsage = Array.from(crossDomainMap.values()).map(stats => ({
            project: stats.project,
            domain: stats.domain,
            successRate: stats.total > 0 ? stats.successful / stats.total : 0,
            adaptations: Array.from(stats.adaptations)
        }));
        return {
            patternId,
            versions: [
                {
                    version: '1.0.0',
                    timestamp: new Date(),
                    successRate: pattern.performanceMetrics.successRate,
                    changes: ['Initial version']
                }
            ],
            crossDomainUsage
        };
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    /**
     * Get pattern by ID
     */
    async getPattern(patternId) {
        const db = await this.getDb();
        if (!db)
            return null;
        const stmt = db.prepare(`
      SELECT * FROM learned_patterns WHERE pattern_id = ?
    `);
        const row = stmt.get(patternId);
        if (!row)
            return null;
        // Get embedding from AgentDB if available
        let embedding = [];
        if (this.agentDB) {
            const expert = await this.agentDB.getExpert(patternId);
            embedding = expert?.embedding || [];
        }
        return {
            patternId: row.pattern_id,
            project: row.project,
            domain: row.domain,
            patternType: row.pattern_type,
            name: row.name,
            description: row.description,
            context: JSON.parse(row.context),
            implementation: row.implementation,
            embedding,
            performanceMetrics: {
                successRate: row.success_rate,
                avgConfidence: row.avg_confidence,
                usageCount: row.usage_count,
                domains: JSON.parse(row.domains)
            },
            reusable: row.reusable === 1,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined
        };
    }
    /**
     * Get all patterns for a project
     */
    async getProjectPatterns(project) {
        const patterns = [];
        // Primary: Get patterns from Supabase
        if (this.useSupabase) {
            try {
                const supabase = getSupabase();
                const { data: reflexions } = await supabase
                    .from('reflexion_bank')
                    .select('*')
                    .eq('project', project)
                    .like('reflexion_type', 'pattern:%')
                    .order('impact_score', { ascending: false });
                if (reflexions) {
                    for (const reflexion of reflexions) {
                        const patternContext = reflexion.context;
                        if (!patternContext.patternId)
                            continue;
                        const pattern = {
                            patternId: patternContext.patternId,
                            project: reflexion.project,
                            domain: patternContext.domain || '',
                            patternType: reflexion.reflexion_type.replace('pattern:', ''),
                            name: patternContext.name || '',
                            description: patternContext.description || '',
                            context: patternContext.context || {},
                            implementation: patternContext.implementation || '',
                            embedding: reflexion.embedding || [],
                            performanceMetrics: {
                                successRate: reflexion.outcome?.successRate || reflexion.impact_score || 0,
                                avgConfidence: reflexion.confidence || 0,
                                usageCount: reflexion.reuse_count || 0,
                                domains: reflexion.outcome?.domains || [patternContext.domain]
                            },
                            reusable: patternContext.reusable ?? true,
                            metadata: patternContext.metadata
                        };
                        patterns.push(pattern);
                    }
                }
            }
            catch (error) {
                console.error('Failed to get patterns from Supabase:', error);
                // Fall through to local DB
            }
        }
        // Fallback: Get patterns from local DB
        const db = await this.getDb();
        if (!db)
            return [];
        if (patterns.length === 0) {
            const stmt = db.prepare(`
        SELECT pattern_id FROM learned_patterns
        WHERE project = ?
        ORDER BY success_rate DESC
      `);
            const rows = stmt.all(project);
            for (const row of rows) {
                const pattern = await this.getPattern(row.pattern_id);
                if (pattern)
                    patterns.push(pattern);
            }
        }
        return patterns;
    }
    /**
     * Close connections
     */
    close() {
        const closeDb = () => {
            if (this.db) {
                try {
                    this.db.close();
                }
                catch (error) {
                    console.warn('⚠ PatternDiscovery: Failed to close AgentDB:', error);
                }
            }
            if (this.agentDB) {
                try {
                    this.agentDB.close();
                }
                catch (error) {
                    console.warn('⚠ PatternDiscovery: Failed to close AgentDB manager:', error);
                }
            }
        };
        if (this.agentDbReady) {
            this.agentDbReady
                .then(() => closeDb())
                .catch(error => {
                console.warn('⚠ PatternDiscovery: AgentDB still initializing during close:', error);
            });
            return;
        }
        closeDb();
    }
}
/**
 * Create pattern discovery engine
 */
export function createPatternDiscovery(config) {
    return new PatternDiscovery(config);
}
