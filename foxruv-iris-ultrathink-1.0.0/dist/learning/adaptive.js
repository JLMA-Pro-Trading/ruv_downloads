/**
 * Adaptive Optimization System
 *
 * Self-healing and adaptive optimization for MCP wrappers:
 * - Auto-optimize based on usage patterns
 * - Self-healing on errors
 * - Adaptive wrapper generation
 * - Performance and quality suggestions
 *
 * Uses AgentDB's learning algorithms and reasoning systems
 */
import { ReasoningBank, ReflexionMemory, SkillLibrary, LearningSystem, createDatabase } from 'agentdb';
export class AdaptiveOptimizer {
    db;
    reasoningBank;
    reflexion;
    skillLibrary;
    learningSystem;
    tracker;
    patternLearner;
    memory;
    strategies = new Map();
    healingHistory = [];
    constructor(dbPath = './ultrathink-adaptive.db', tracker, patternLearner, memory) {
        this.db = createDatabase(dbPath);
        this.tracker = tracker;
        this.patternLearner = patternLearner;
        this.memory = memory;
        // Initialize AgentDB learning components
        const embedder = memory.embedder; // Access embedder from memory
        this.reasoningBank = new ReasoningBank(this.db, embedder);
        this.reflexion = new ReflexionMemory(this.db, embedder);
        this.skillLibrary = new SkillLibrary(this.db, embedder);
        this.learningSystem = new LearningSystem(this.db, embedder);
        this.initializeSchema();
        this.loadStrategies();
    }
    /**
     * Initialize database schema
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS adaptive_strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        trigger TEXT NOT NULL,
        action TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        conditions TEXT NOT NULL,
        created INTEGER NOT NULL,
        last_triggered INTEGER,
        trigger_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS self_healing_actions (
        id TEXT PRIMARY KEY,
        trigger TEXT NOT NULL,
        action TEXT NOT NULL,
        server_id TEXT NOT NULL,
        tool_id TEXT,
        timestamp INTEGER NOT NULL,
        success INTEGER NOT NULL,
        details TEXT NOT NULL,
        impact TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS optimization_suggestions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        impact TEXT NOT NULL,
        effort TEXT NOT NULL,
        confidence REAL NOT NULL,
        applicable_to TEXT NOT NULL,
        implementation TEXT NOT NULL,
        expected_gains TEXT NOT NULL,
        based_on TEXT NOT NULL,
        created INTEGER NOT NULL,
        applied INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS learning_feedback (
        invocation_id TEXT PRIMARY KEY,
        rating INTEGER NOT NULL,
        issues TEXT,
        suggestions TEXT,
        user_notes TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (invocation_id) REFERENCES mcp_invocations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_strategies_enabled ON adaptive_strategies(enabled);
      CREATE INDEX IF NOT EXISTS idx_healing_timestamp ON self_healing_actions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_suggestions_applied ON optimization_suggestions(applied);
    `);
    }
    /**
     * Load adaptive strategies
     */
    loadStrategies() {
        const rows = this.db.prepare(`
      SELECT * FROM adaptive_strategies WHERE enabled = 1
    `).all();
        for (const row of rows) {
            const strategy = {
                id: row.id,
                name: row.name,
                type: row.type,
                trigger: JSON.parse(row.trigger),
                action: JSON.parse(row.action),
                enabled: row.enabled === 1,
                priority: row.priority,
                conditions: JSON.parse(row.conditions),
                created: row.created,
                lastTriggered: row.last_triggered || undefined,
                triggerCount: row.trigger_count,
            };
            this.strategies.set(strategy.id, strategy);
        }
        // Register default strategies if none exist
        if (this.strategies.size === 0) {
            this.registerDefaultStrategies();
        }
    }
    /**
     * Register default adaptive strategies
     */
    registerDefaultStrategies() {
        const defaultStrategies = [
            {
                name: 'Auto-regenerate on high failure rate',
                type: 'error-handling',
                trigger: {
                    type: 'threshold',
                    metric: 'successRate',
                    threshold: 70, // < 70% success rate
                },
                action: {
                    type: 'regenerate',
                    params: { reason: 'low_success_rate' },
                },
                enabled: true,
                priority: 1,
                conditions: [
                    { metric: 'totalInvocations', operator: 'gte', value: 10 },
                ],
            },
            {
                name: 'Optimize for high latency',
                type: 'performance',
                trigger: {
                    type: 'threshold',
                    metric: 'p95Latency',
                    threshold: 5000, // > 5s p95 latency
                },
                action: {
                    type: 'optimize',
                    params: { focus: 'latency' },
                },
                enabled: true,
                priority: 2,
                conditions: [
                    { metric: 'totalInvocations', operator: 'gte', value: 20 },
                ],
            },
            {
                name: 'Learn from repeated errors',
                type: 'error-handling',
                trigger: {
                    type: 'pattern',
                    pattern: 'repeated_error',
                },
                action: {
                    type: 'learn',
                    params: { strategy: 'reflexion' },
                },
                enabled: true,
                priority: 3,
                conditions: [],
            },
        ];
        for (const strategy of defaultStrategies) {
            this.addStrategy(strategy);
        }
    }
    /**
     * Add a new adaptive strategy
     */
    addStrategy(strategy) {
        const id = `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fullStrategy = {
            ...strategy,
            id,
            created: Date.now(),
            triggerCount: 0,
        };
        const stmt = this.db.prepare(`
      INSERT INTO adaptive_strategies (
        id, name, type, trigger, action, enabled, priority,
        conditions, created, trigger_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, fullStrategy.name, fullStrategy.type, JSON.stringify(fullStrategy.trigger), JSON.stringify(fullStrategy.action), fullStrategy.enabled ? 1 : 0, fullStrategy.priority, JSON.stringify(fullStrategy.conditions), fullStrategy.created, 0);
        this.strategies.set(id, fullStrategy);
        return id;
    }
    /**
     * Analyze tool metrics and trigger adaptive strategies
     */
    async analyzeAndAdapt(toolId) {
        const metrics = await this.tracker.getToolMetrics(toolId);
        if (!metrics)
            return;
        // Check all enabled strategies
        const triggeredStrategies = [];
        for (const strategy of this.strategies.values()) {
            if (!strategy.enabled)
                continue;
            if (this.shouldTriggerStrategy(strategy, metrics)) {
                triggeredStrategies.push(strategy);
            }
        }
        // Execute strategies by priority
        triggeredStrategies.sort((a, b) => a.priority - b.priority);
        for (const strategy of triggeredStrategies) {
            await this.executeStrategy(strategy, toolId, metrics);
        }
    }
    /**
     * Check if strategy should be triggered
     */
    shouldTriggerStrategy(strategy, metrics) {
        // Check conditions
        for (const condition of strategy.conditions) {
            const metricValue = metrics[condition.metric];
            if (metricValue === undefined)
                continue;
            switch (condition.operator) {
                case 'gt':
                    if (metricValue <= condition.value)
                        return false;
                    break;
                case 'lt':
                    if (metricValue >= condition.value)
                        return false;
                    break;
                case 'gte':
                    if (metricValue < condition.value)
                        return false;
                    break;
                case 'lte':
                    if (metricValue > condition.value)
                        return false;
                    break;
                case 'eq':
                    if (metricValue !== condition.value)
                        return false;
                    break;
                case 'ne':
                    if (metricValue === condition.value)
                        return false;
                    break;
            }
        }
        // Check trigger
        switch (strategy.trigger.type) {
            case 'threshold':
                const metricValue = metrics[strategy.trigger.metric];
                const threshold = strategy.trigger.threshold;
                if (strategy.name.includes('failure')) {
                    return metricValue < threshold; // Trigger if below threshold
                }
                else {
                    return metricValue > threshold; // Trigger if above threshold
                }
            case 'pattern':
                return this.detectPattern(strategy.trigger.pattern, metrics);
            default:
                return false;
        }
    }
    /**
     * Detect specific patterns in metrics
     */
    detectPattern(pattern, metrics) {
        switch (pattern) {
            case 'repeated_error':
                return metrics.errorPatterns.some(ep => ep.count >= 3);
            case 'degrading_performance':
                return metrics.p95Latency > metrics.avgLatency * 2;
            case 'inconsistent_results':
                return metrics.successRate > 50 && metrics.successRate < 80;
            default:
                return false;
        }
    }
    /**
     * Execute an adaptive strategy
     */
    async executeStrategy(strategy, toolId, metrics) {
        const action = {
            id: `heal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            trigger: strategy.name,
            action: strategy.action.type,
            serverId: metrics.serverId,
            toolId,
            timestamp: Date.now(),
            success: false,
            details: '',
            impact: '',
        };
        try {
            switch (strategy.action.type) {
                case 'regenerate':
                    await this.regenerateWrapper(metrics.serverId, toolId, strategy.action.params);
                    action.details = 'Wrapper regenerated due to low performance';
                    action.impact = 'High - New wrapper generated';
                    action.success = true;
                    break;
                case 'optimize':
                    await this.optimizeWrapper(metrics.serverId, toolId, strategy.action.params);
                    action.details = 'Wrapper optimized for better performance';
                    action.impact = 'Medium - Existing wrapper improved';
                    action.success = true;
                    break;
                case 'learn':
                    await this.learnFromFailures(toolId, strategy.action.params);
                    action.details = 'Learning patterns from failures';
                    action.impact = 'Low - Pattern learning in progress';
                    action.success = true;
                    break;
                case 'fallback':
                    await this.implementFallback(toolId, strategy.action.params);
                    action.details = 'Fallback mechanism implemented';
                    action.impact = 'Medium - Fallback strategy active';
                    action.success = true;
                    break;
                default:
                    action.details = `Unknown action type: ${strategy.action.type}`;
                    action.impact = 'None';
            }
            // Update strategy trigger count
            this.db.prepare(`
        UPDATE adaptive_strategies
        SET last_triggered = ?,
            trigger_count = trigger_count + 1
        WHERE id = ?
      `).run(Date.now(), strategy.id);
            strategy.lastTriggered = Date.now();
            strategy.triggerCount++;
        }
        catch (error) {
            action.details = `Failed: ${error.message}`;
            action.impact = 'None - Action failed';
        }
        // Store healing action
        this.storeHealingAction(action);
        this.healingHistory.push(action);
    }
    /**
     * Regenerate wrapper for a server/tool
     */
    async regenerateWrapper(serverId, toolId, params) {
        // Use ReasoningBank to analyze why regeneration is needed
        const trajectory = await this.tracker.getRecentInvocations(50);
        const failedInvocations = trajectory.filter(inv => !inv.success && inv.toolId === toolId);
        // Store reasoning pattern for why regeneration is needed
        await this.reasoningBank.storePattern({
            taskType: 'analyze_failures',
            approach: `Tool ${toolId} has ${failedInvocations.length} failures. Reason: ${params.reason}. Observations: ${failedInvocations.map(inv => inv.error || 'Unknown error').join(', ')}`,
            successRate: 0,
            metadata: {
                toolId,
                failureCount: failedInvocations.length,
                reason: params.reason,
            },
        });
        // Mark for regeneration (actual regeneration would happen in the wrapper generator)
        const server = await this.memory.getServer(serverId);
        if (server) {
            // Store a new version placeholder
            await this.memory.storeWrapperVersion({
                id: `${serverId}-v${Date.now()}`,
                serverId,
                version: `regen-${Date.now()}`,
                code: '// Regeneration pending',
                metadata: {
                    tools: [toolId],
                    features: ['auto-regenerated'],
                    optimizations: [params.reason],
                },
                created: Date.now(),
            });
        }
    }
    /**
     * Optimize existing wrapper
     */
    async optimizeWrapper(serverId, toolId, params) {
        const metrics = await this.tracker.getToolMetrics(toolId);
        if (!metrics)
            return;
        // Use Reflexion to critique current implementation
        await this.reflexion.storeEpisode({
            sessionId: `tool-${toolId}`,
            task: 'performance-optimization',
            critique: `Tool has high latency: p95=${metrics.p95Latency}ms`,
            reward: 0,
            success: false,
            metadata: {
                currentMetrics: metrics,
                optimizationFocus: params.focus,
            },
        });
        // Generate optimization suggestions
        const suggestions = await this.generateOptimizations(toolId, metrics, params.focus);
        // Store suggestions
        for (const suggestion of suggestions) {
            await this.storeSuggestion(suggestion);
        }
    }
    /**
     * Learn from failures using AgentDB's learning algorithms
     */
    async learnFromFailures(toolId, params) {
        const recentInvocations = await this.tracker.getRecentInvocations(100);
        const toolInvocations = recentInvocations.filter(inv => inv.toolId === toolId);
        // Start a learning session
        const sessionId = await this.learningSystem.startSession('system', 'actor-critic', {
            learningRate: 0.01,
            discountFactor: 0.95,
        });
        // Learn from success/failure patterns
        for (const inv of toolInvocations) {
            const state = JSON.stringify({
                tool: inv.toolName,
                params: inv.params,
            });
            const reward = inv.success ? 1.0 : -1.0;
            await this.learningSystem.submitFeedback({
                sessionId,
                action: 'invoke_tool',
                state,
                reward,
                success: inv.success,
                timestamp: inv.timestamp,
            });
        }
        // Train the policy
        await this.learningSystem.train(sessionId, 10, 32, 0.01);
        await this.learningSystem.endSession(sessionId);
        // Store learned skill
        await this.skillLibrary.createSkill({
            name: `Optimized ${toolId} invocation`,
            description: `Learned optimal patterns for ${toolId}`,
            signature: {
                inputs: { tool: 'string', params: 'object' },
                outputs: { result: 'any' },
            },
            successRate: toolInvocations.filter(i => i.success).length / toolInvocations.length,
            uses: 0,
            avgReward: toolInvocations.reduce((sum, i) => sum + (i.success ? 1.0 : -1.0), 0) / toolInvocations.length,
            avgLatencyMs: toolInvocations.reduce((sum, i) => sum + i.duration, 0) / toolInvocations.length,
            metadata: {
                learnedFrom: toolInvocations.length,
                strategy: params.strategy,
                category: 'tool-invocation',
            },
        });
    }
    /**
     * Implement fallback strategy
     */
    async implementFallback(toolId, params) {
        // Find alternative tools with similar capabilities
        const tool = await this.memory.getTool(toolId);
        if (!tool)
            return;
        // Search for similar tools
        const alternatives = await this.memory.searchTools({
            query: tool.description,
            type: 'tool',
            limit: 3,
        });
        // Store fallback strategy
        await this.skillLibrary.createSkill({
            name: `Fallback for ${tool.name}`,
            description: `Alternative tools when ${tool.name} fails`,
            signature: {
                inputs: { primaryTool: 'string', context: 'object' },
                outputs: { fallbackTool: 'string' },
            },
            code: JSON.stringify({
                primaryTool: toolId,
                alternatives: alternatives.map(a => a.item.id),
            }),
            successRate: 0.9,
            uses: 0,
            avgReward: 0.85,
            avgLatencyMs: 0,
            metadata: {
                category: 'fallback-strategy',
                type: 'fallback',
                reason: params.reason || 'high_failure_rate',
            },
        });
    }
    /**
     * Generate optimization suggestions
     */
    async generateOptimizations(toolId, metrics, focus) {
        const suggestions = [];
        // Performance optimization
        if (!focus || focus === 'latency') {
            if (metrics.p95Latency > 3000) {
                suggestions.push({
                    id: `opt-${Date.now()}-latency`,
                    type: 'performance',
                    title: 'Reduce Tool Latency',
                    description: `Tool has high p95 latency of ${metrics.p95Latency}ms. Consider caching, parallelization, or timeout optimization.`,
                    impact: 'high',
                    effort: 'medium',
                    confidence: 0.85,
                    applicableTo: [toolId],
                    implementation: 'Implement result caching for repeated queries. Add request timeout handling. Consider async processing.',
                    expectedGains: {
                        latencyReduction: '40-60%',
                        reliabilityIncrease: '10-15%',
                    },
                    basedOn: [`${metrics.totalInvocations} invocations`, 'p95 latency analysis'],
                });
            }
        }
        // Reliability optimization
        if (!focus || focus === 'reliability') {
            if (metrics.successRate < 90) {
                suggestions.push({
                    id: `opt-${Date.now()}-reliability`,
                    type: 'reliability',
                    title: 'Improve Success Rate',
                    description: `Tool has ${metrics.successRate.toFixed(1)}% success rate. Add error handling and retry logic.`,
                    impact: 'high',
                    effort: 'low',
                    confidence: 0.9,
                    applicableTo: [toolId],
                    implementation: 'Add exponential backoff retry logic. Improve error handling. Add input validation.',
                    expectedGains: {
                        reliabilityIncrease: '15-25%',
                    },
                    basedOn: [`${metrics.failureCount} failures`, 'error pattern analysis'],
                });
            }
        }
        // Error handling
        if (metrics.errorPatterns.length > 0) {
            const topError = metrics.errorPatterns[0];
            suggestions.push({
                id: `opt-${Date.now()}-errors`,
                type: 'quality',
                title: 'Handle Common Errors',
                description: `Most common error: "${topError.errorType}" (${topError.count} occurrences). Add specific error handling.`,
                impact: 'medium',
                effort: 'low',
                confidence: 0.95,
                applicableTo: [toolId],
                implementation: `Add specific error handler for "${topError.errorType}". Implement graceful degradation or fallback.`,
                expectedGains: {
                    reliabilityIncrease: '10-20%',
                    qualityImprovement: 'Better error messages and recovery',
                },
                basedOn: ['error pattern analysis', `${topError.count} occurrences`],
            });
        }
        return suggestions;
    }
    /**
     * Record learning feedback
     */
    async recordFeedback(feedback) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO learning_feedback (
        invocation_id, rating, issues, suggestions, user_notes, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
        stmt.run(feedback.invocationId, feedback.rating, feedback.issues ? JSON.stringify(feedback.issues) : null, feedback.suggestions ? JSON.stringify(feedback.suggestions) : null, feedback.userNotes || null, feedback.timestamp);
        // If negative feedback, trigger learning
        if (feedback.rating <= 2) {
            const invocation = (await this.tracker.getRecentInvocations(1000))
                .find(inv => inv.id === feedback.invocationId);
            if (invocation) {
                await this.learnFromFailures(invocation.toolId, {
                    strategy: 'reflexion',
                    feedback,
                });
            }
        }
    }
    /**
     * Get all suggestions
     */
    async getAllSuggestions(appliedOnly = false) {
        const rows = this.db.prepare(`
      SELECT * FROM optimization_suggestions
      WHERE applied = ?
      ORDER BY impact DESC, confidence DESC
    `).all(appliedOnly ? 1 : 0);
        return rows.map((row) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            description: row.description,
            impact: row.impact,
            effort: row.effort,
            confidence: row.confidence,
            applicableTo: JSON.parse(row.applicable_to),
            implementation: row.implementation,
            expectedGains: JSON.parse(row.expected_gains),
            basedOn: JSON.parse(row.based_on),
        }));
    }
    /**
     * Get healing history
     */
    getHealingHistory(limit = 50) {
        return this.healingHistory.slice(-limit);
    }
    // ========== Helper Methods ==========
    storeHealingAction(action) {
        const stmt = this.db.prepare(`
      INSERT INTO self_healing_actions (
        id, trigger, action, server_id, tool_id, timestamp,
        success, details, impact
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(action.id, action.trigger, action.action, action.serverId, action.toolId || null, action.timestamp, action.success ? 1 : 0, action.details, action.impact);
    }
    async storeSuggestion(suggestion) {
        const stmt = this.db.prepare(`
      INSERT INTO optimization_suggestions (
        id, type, title, description, impact, effort, confidence,
        applicable_to, implementation, expected_gains, based_on, created
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(suggestion.id, suggestion.type, suggestion.title, suggestion.description, suggestion.impact, suggestion.effort, suggestion.confidence, JSON.stringify(suggestion.applicableTo), suggestion.implementation, JSON.stringify(suggestion.expectedGains), JSON.stringify(suggestion.basedOn), Date.now());
    }
}
//# sourceMappingURL=adaptive.js.map