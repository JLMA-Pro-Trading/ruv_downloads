/**
 * Pattern Discovery and Learning
 *
 * Discovers and learns from MCP usage patterns:
 * - Sequential tool usage patterns
 * - Successful generation patterns
 * - Anti-patterns and failure modes
 * - Optimization recommendations
 *
 * Uses AgentDB's vector search and learning algorithms
 */
import { WASMVectorSearch, EmbeddingService, LearningSystem, createDatabase } from 'agentdb';
export class PatternLearner {
    db;
    vectorSearch;
    embedder;
    learningSystem;
    patterns = new Map();
    constructor(dbPath = './ultrathink-patterns.db', embeddingModel = 'transformer') {
        this.db = createDatabase(dbPath);
        this.embedder = new EmbeddingService(embeddingModel);
        this.vectorSearch = new WASMVectorSearch(this.db); // Vector dimensions inferred from data
        this.learningSystem = new LearningSystem(this.db, this.embedder);
        this.initializeSchema();
    }
    /**
     * Initialize database schema for patterns
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS discovered_patterns (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        confidence REAL NOT NULL,
        support INTEGER NOT NULL,
        frequency INTEGER NOT NULL,
        tools TEXT NOT NULL,
        sequence TEXT,
        conditions TEXT,
        outcomes TEXT NOT NULL,
        discovered INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        embedding BLOB
      );

      CREATE INDEX IF NOT EXISTS idx_patterns_type ON discovered_patterns(type);
      CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON discovered_patterns(confidence);

      CREATE TABLE IF NOT EXISTS anti_patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        occurrences INTEGER NOT NULL,
        impact TEXT NOT NULL,
        tools TEXT NOT NULL,
        symptoms TEXT NOT NULL,
        remediation TEXT NOT NULL,
        examples TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pattern_examples (
        id TEXT PRIMARY KEY,
        pattern_id TEXT NOT NULL,
        invocation_ids TEXT NOT NULL,
        success INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (pattern_id) REFERENCES discovered_patterns(id)
      );

      CREATE INDEX IF NOT EXISTS idx_pattern_examples_pattern ON pattern_examples(pattern_id);
    `);
    }
    /**
     * Discover patterns from invocation history
     */
    async discoverPatterns(invocations) {
        const newPatterns = [];
        // Discover sequential patterns
        newPatterns.push(...await this.discoverSequentialPatterns(invocations));
        // Discover combination patterns
        newPatterns.push(...await this.discoverCombinationPatterns(invocations));
        // Discover success patterns
        newPatterns.push(...await this.discoverSuccessPatterns(invocations));
        // Discover anti-patterns
        await this.discoverAntiPatterns(invocations);
        // Store new patterns
        for (const pattern of newPatterns) {
            await this.storePattern(pattern);
        }
        return newPatterns;
    }
    /**
     * Discover sequential tool usage patterns
     */
    async discoverSequentialPatterns(invocations) {
        const sequences = new Map();
        // Group by session
        const sessionGroups = this.groupBySession(invocations);
        for (const [sessionId, sessionInvs] of sessionGroups) {
            if (sessionInvs.length < 2)
                continue;
            // Extract sequences of 2-4 tools
            for (let windowSize = 2; windowSize <= Math.min(4, sessionInvs.length); windowSize++) {
                for (let i = 0; i <= sessionInvs.length - windowSize; i++) {
                    const window = sessionInvs.slice(i, i + windowSize);
                    const toolSeq = window.map(inv => inv.toolName);
                    const seqKey = toolSeq.join(' -> ');
                    if (!sequences.has(seqKey)) {
                        sequences.set(seqKey, {
                            tools: toolSeq,
                            occurrences: [],
                        });
                    }
                    sequences.get(seqKey).occurrences.push({
                        invocations: window,
                        success: window.every(inv => inv.success),
                    });
                }
            }
        }
        // Convert to patterns
        const patterns = [];
        for (const [seqKey, data] of sequences) {
            if (data.occurrences.length < 3)
                continue; // Minimum support
            const successCount = data.occurrences.filter((o) => o.success).length;
            const successRate = successCount / data.occurrences.length;
            if (successRate < 0.7)
                continue; // Minimum confidence
            const embedding = await this.embedder.embed(`Sequential pattern: ${seqKey}. Success rate: ${(successRate * 100).toFixed(1)}%`);
            patterns.push({
                id: `seq-${Date.now()}-${patterns.length}`,
                type: 'sequence',
                name: `${data.tools[0]} → ${data.tools[data.tools.length - 1]}`,
                description: `Tools are typically used in sequence: ${seqKey}`,
                confidence: successRate,
                support: data.occurrences.length,
                frequency: data.occurrences.length,
                tools: data.tools,
                sequence: data.tools,
                outcomes: {
                    successRate: successRate * 100,
                    avgLatency: this.calculateAvgLatency(data.occurrences),
                    reliability: this.calculateReliability(successRate, data.occurrences.length),
                    impact: this.determineImpact(successRate, data.occurrences.length),
                },
                discovered: Date.now(),
                lastSeen: Date.now(),
                embedding: Array.from(embedding),
            });
        }
        return patterns;
    }
    /**
     * Discover combination patterns (tools used together)
     */
    async discoverCombinationPatterns(invocations) {
        const combinations = new Map();
        const sessionGroups = this.groupBySession(invocations);
        for (const [sessionId, sessionInvs] of sessionGroups) {
            const toolSet = [...new Set(sessionInvs.map(inv => inv.toolName))].sort();
            if (toolSet.length < 2)
                continue;
            const comboKey = toolSet.join(' + ');
            if (!combinations.has(comboKey)) {
                combinations.set(comboKey, {
                    tools: toolSet,
                    occurrences: [],
                });
            }
            combinations.get(comboKey).occurrences.push({
                session: sessionInvs,
                success: sessionInvs.every(inv => inv.success),
            });
        }
        const patterns = [];
        for (const [comboKey, data] of combinations) {
            if (data.occurrences.length < 3)
                continue;
            const successCount = data.occurrences.filter((o) => o.success).length;
            const successRate = successCount / data.occurrences.length;
            if (successRate < 0.7)
                continue;
            const embedding = await this.embedder.embed(`Tool combination: ${comboKey}. Used together effectively.`);
            patterns.push({
                id: `combo-${Date.now()}-${patterns.length}`,
                type: 'combination',
                name: `${data.tools.join(' + ')} Combination`,
                description: `These tools work well together: ${comboKey}`,
                confidence: successRate,
                support: data.occurrences.length,
                frequency: data.occurrences.length,
                tools: data.tools,
                outcomes: {
                    successRate: successRate * 100,
                    avgLatency: this.calculateAvgLatency(data.occurrences),
                    reliability: this.calculateReliability(successRate, data.occurrences.length),
                    impact: this.determineImpact(successRate, data.occurrences.length),
                },
                discovered: Date.now(),
                lastSeen: Date.now(),
                embedding: Array.from(embedding),
            });
        }
        return patterns;
    }
    /**
     * Discover success patterns from high-performing invocations
     */
    async discoverSuccessPatterns(invocations) {
        // Find consistently successful tools with low latency
        const toolPerformance = new Map();
        for (const inv of invocations) {
            if (!toolPerformance.has(inv.toolName)) {
                toolPerformance.set(inv.toolName, {
                    successes: 0,
                    failures: 0,
                    latencies: [],
                });
            }
            const perf = toolPerformance.get(inv.toolName);
            if (inv.success) {
                perf.successes++;
                perf.latencies.push(inv.duration);
            }
            else {
                perf.failures++;
            }
        }
        const patterns = [];
        for (const [toolName, perf] of toolPerformance) {
            const total = perf.successes + perf.failures;
            if (total < 5)
                continue;
            const successRate = perf.successes / total;
            const avgLatency = perf.latencies.reduce((a, b) => a + b, 0) / perf.latencies.length;
            if (successRate > 0.95 && avgLatency < 1000) {
                const embedding = await this.embedder.embed(`Highly reliable tool: ${toolName}. ${(successRate * 100).toFixed(1)}% success rate, ${avgLatency.toFixed(0)}ms average latency.`);
                patterns.push({
                    id: `success-${Date.now()}-${patterns.length}`,
                    type: 'success-pattern',
                    name: `${toolName} Excellence`,
                    description: `${toolName} consistently performs well with ${(successRate * 100).toFixed(1)}% success rate`,
                    confidence: successRate,
                    support: total,
                    frequency: total,
                    tools: [toolName],
                    outcomes: {
                        successRate: successRate * 100,
                        avgLatency,
                        reliability: this.calculateReliability(successRate, total),
                        impact: 'high',
                    },
                    discovered: Date.now(),
                    lastSeen: Date.now(),
                    embedding: Array.from(embedding),
                });
            }
        }
        return patterns;
    }
    /**
     * Discover anti-patterns (things to avoid)
     */
    async discoverAntiPatterns(invocations) {
        const antiPatterns = new Map();
        // Find consistently failing patterns
        const sessionGroups = this.groupBySession(invocations);
        for (const [sessionId, sessionInvs] of sessionGroups) {
            const failures = sessionInvs.filter(inv => !inv.success);
            if (failures.length === 0)
                continue;
            // Check for repeated tool failures
            const failedTools = failures.map(inv => inv.toolName);
            const uniqueFailedTools = [...new Set(failedTools)];
            for (const tool of uniqueFailedTools) {
                const toolFailures = failures.filter(inv => inv.toolName === tool);
                if (toolFailures.length < 2)
                    continue;
                const patternKey = `repeated-failure-${tool}`;
                if (!antiPatterns.has(patternKey)) {
                    antiPatterns.set(patternKey, {
                        name: `Repeated ${tool} Failures`,
                        description: `Multiple consecutive failures of ${tool} tool`,
                        occurrences: 0,
                        impact: 'medium',
                        tools: [tool],
                        symptoms: [],
                        examples: [],
                    });
                }
                const pattern = antiPatterns.get(patternKey);
                pattern.occurrences++;
                pattern.examples.push(sessionId);
                // Extract symptoms from errors
                for (const failure of toolFailures) {
                    if (failure.error && !pattern.symptoms.includes(failure.error)) {
                        pattern.symptoms.push(failure.error);
                    }
                }
            }
        }
        // Store anti-patterns
        for (const [key, data] of antiPatterns) {
            if (data.occurrences < 3)
                continue; // Minimum threshold
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO anti_patterns (
          id, name, description, occurrences, impact, tools,
          symptoms, remediation, examples
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            stmt.run(key, data.name, data.description, data.occurrences, data.impact, JSON.stringify(data.tools), JSON.stringify(data.symptoms), this.generateRemediation(data), JSON.stringify(data.examples.slice(0, 10)) // Keep last 10
            );
        }
    }
    /**
     * Get recommendations based on context
     */
    async getRecommendations(context, currentTools, limit = 5) {
        // Search for relevant patterns
        const queryEmbedding = await this.embedder.embed(context);
        const patterns = this.db.prepare(`
      SELECT * FROM discovered_patterns
      WHERE confidence > 0.7
      ORDER BY frequency DESC, confidence DESC
      LIMIT 20
    `).all();
        const recommendations = [];
        for (const patternRow of patterns) {
            const pattern = this.rowToPattern(patternRow);
            // Calculate relevance
            const toolOverlap = pattern.tools.filter(t => currentTools.includes(t)).length;
            const relevanceScore = (toolOverlap / Math.max(pattern.tools.length, currentTools.length)) *
                pattern.confidence;
            if (relevanceScore < 0.3)
                continue;
            recommendations.push({
                pattern,
                relevanceScore,
                reasoning: this.generateReasoning(pattern, currentTools, relevanceScore),
                applicableContext: this.determineApplicableContext(pattern),
                expectedImpact: this.describeExpectedImpact(pattern),
            });
        }
        return recommendations
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, limit);
    }
    /**
     * Learn from successful generations
     */
    async learnFromSuccess(invocations, outcome, feedback) {
        const sessionId = await this.learningSystem.startSession('user', 'policy-gradient', {
            learningRate: 0.01,
            discountFactor: 0.95,
        });
        // Convert invocations to state-action pairs
        for (let i = 0; i < invocations.length - 1; i++) {
            const current = invocations[i];
            const next = invocations[i + 1];
            const state = this.invocationToState(current);
            const action = next.toolName;
            const reward = outcome === 'success' ? 1.0 : -1.0;
            await this.learningSystem.submitFeedback({
                sessionId,
                action,
                state,
                reward,
                nextState: this.invocationToState(next),
                success: outcome === 'success',
                timestamp: Date.now(),
            });
        }
        await this.learningSystem.endSession(sessionId);
    }
    /**
     * Get anti-patterns to avoid
     */
    async getAntiPatterns() {
        const rows = this.db.prepare(`
      SELECT * FROM anti_patterns
      ORDER BY occurrences DESC, impact DESC
    `).all();
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            occurrences: row.occurrences,
            impact: row.impact,
            tools: JSON.parse(row.tools),
            symptoms: JSON.parse(row.symptoms),
            remediation: row.remediation,
            examples: JSON.parse(row.examples),
        }));
    }
    // ========== Helper Methods ==========
    groupBySession(invocations) {
        const groups = new Map();
        for (const inv of invocations) {
            const sessionId = inv.context.sessionId || 'default';
            if (!groups.has(sessionId)) {
                groups.set(sessionId, []);
            }
            groups.get(sessionId).push(inv);
        }
        return groups;
    }
    calculateAvgLatency(occurrences) {
        let totalLatency = 0;
        let count = 0;
        for (const occ of occurrences) {
            const invs = occ.invocations || occ.session || [];
            for (const inv of invs) {
                totalLatency += inv.duration;
                count++;
            }
        }
        return count > 0 ? totalLatency / count : 0;
    }
    calculateReliability(successRate, support) {
        // Combine success rate with support (more data = more reliable)
        const supportFactor = Math.min(support / 20, 1.0); // Max at 20 occurrences
        return successRate * 0.7 + supportFactor * 0.3;
    }
    determineImpact(successRate, support) {
        if (successRate > 0.9 && support > 10)
            return 'high';
        if (successRate > 0.8 && support > 5)
            return 'medium';
        return 'low';
    }
    async storePattern(pattern) {
        this.patterns.set(pattern.id, pattern);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO discovered_patterns (
        id, type, name, description, confidence, support, frequency,
        tools, sequence, conditions, outcomes, discovered, last_seen, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(pattern.id, pattern.type, pattern.name, pattern.description, pattern.confidence, pattern.support, pattern.frequency, JSON.stringify(pattern.tools), pattern.sequence ? JSON.stringify(pattern.sequence) : null, pattern.conditions ? JSON.stringify(pattern.conditions) : null, JSON.stringify(pattern.outcomes), pattern.discovered, pattern.lastSeen, pattern.embedding ? Buffer.from(new Float32Array(pattern.embedding).buffer) : null);
    }
    rowToPattern(row) {
        return {
            id: row.id,
            type: row.type,
            name: row.name,
            description: row.description,
            confidence: row.confidence,
            support: row.support,
            frequency: row.frequency,
            tools: JSON.parse(row.tools),
            sequence: row.sequence ? JSON.parse(row.sequence) : undefined,
            conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
            outcomes: JSON.parse(row.outcomes),
            discovered: row.discovered,
            lastSeen: row.last_seen,
        };
    }
    generateRemediation(antiPatternData) {
        const tool = antiPatternData.tools[0];
        return `Review ${tool} configuration and parameters. Check for common failure causes. Consider using alternative tools or implementing retry logic with exponential backoff.`;
    }
    generateReasoning(pattern, currentTools, score) {
        const overlap = pattern.tools.filter(t => currentTools.includes(t));
        if (overlap.length > 0) {
            return `Pattern includes tools you're already using (${overlap.join(', ')}). ${pattern.description}`;
        }
        return pattern.description;
    }
    determineApplicableContext(pattern) {
        const contexts = [];
        if (pattern.type === 'sequence')
            contexts.push('sequential-workflow');
        if (pattern.type === 'combination')
            contexts.push('multi-tool-task');
        if (pattern.outcomes.successRate > 95)
            contexts.push('high-reliability-required');
        return contexts;
    }
    describeExpectedImpact(pattern) {
        return `Expected ${pattern.outcomes.successRate.toFixed(1)}% success rate with ~${pattern.outcomes.avgLatency.toFixed(0)}ms latency`;
    }
    invocationToState(inv) {
        return JSON.stringify({
            tool: inv.toolName,
            server: inv.serverName,
            context: inv.context.taskType || 'unknown',
        });
    }
}
//# sourceMappingURL=patterns.js.map