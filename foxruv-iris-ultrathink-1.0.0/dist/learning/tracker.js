/**
 * MCP Tool Invocation Tracker
 *
 * Tracks all MCP tool invocations with comprehensive metrics:
 * - Success/failure rates
 * - Latency and performance metrics
 * - Usage patterns
 * - Error patterns and diagnostics
 *
 * Uses AgentDB for persistent storage and analysis
 */
import { createDatabase } from 'agentdb';
export class MCPInvocationTracker {
    db;
    invocations = new Map();
    metricsCache = new Map();
    cacheExpiry = 60000; // 1 minute
    lastCacheUpdate = 0;
    constructor(dbPath = './ultrathink-tracking.db') {
        this.db = createDatabase(dbPath);
        this.initializeSchema();
    }
    /**
     * Initialize database schema for tracking
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_invocations (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_id TEXT NOT NULL,
        params TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration INTEGER NOT NULL,
        success INTEGER NOT NULL,
        error TEXT,
        result TEXT,
        context TEXT,
        session_id TEXT,
        user_id TEXT,
        task_type TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_invocations_server ON mcp_invocations(server_id);
      CREATE INDEX IF NOT EXISTS idx_invocations_tool ON mcp_invocations(tool_id);
      CREATE INDEX IF NOT EXISTS idx_invocations_timestamp ON mcp_invocations(timestamp);
      CREATE INDEX IF NOT EXISTS idx_invocations_success ON mcp_invocations(success);
      CREATE INDEX IF NOT EXISTS idx_invocations_session ON mcp_invocations(session_id);

      CREATE TABLE IF NOT EXISTS tool_metrics_cache (
        tool_id TEXT PRIMARY KEY,
        metrics TEXT NOT NULL,
        updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS error_patterns (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        error_type TEXT NOT NULL,
        message TEXT NOT NULL,
        count INTEGER NOT NULL,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        examples TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_error_patterns_tool ON error_patterns(tool_id);
    `);
    }
    /**
     * Track a new MCP tool invocation
     */
    async trackInvocation(invocation) {
        this.invocations.set(invocation.id, invocation);
        const stmt = this.db.prepare(`
      INSERT INTO mcp_invocations (
        id, server_id, server_name, tool_name, tool_id, params,
        timestamp, duration, success, error, result, context,
        session_id, user_id, task_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(invocation.id, invocation.serverId, invocation.serverName, invocation.toolName, invocation.toolId, JSON.stringify(invocation.params), invocation.timestamp, invocation.duration, invocation.success ? 1 : 0, invocation.error || null, invocation.result ? JSON.stringify(invocation.result) : null, JSON.stringify(invocation.context), invocation.context.sessionId || null, invocation.context.userId || null, invocation.context.taskType || null);
        // Track error patterns
        if (!invocation.success && invocation.error) {
            await this.trackErrorPattern(invocation);
        }
        // Invalidate metrics cache
        this.metricsCache.delete(invocation.toolId);
    }
    /**
     * Track error patterns for diagnostics
     */
    async trackErrorPattern(invocation) {
        const errorType = this.extractErrorType(invocation.error);
        const patternId = `${invocation.toolId}:${errorType}`;
        const existing = this.db.prepare(`
      SELECT * FROM error_patterns WHERE id = ?
    `).get(patternId);
        if (existing) {
            const examples = JSON.parse(existing.examples);
            examples.push(invocation.id);
            if (examples.length > 10) {
                examples.shift(); // Keep last 10 examples
            }
            this.db.prepare(`
        UPDATE error_patterns
        SET count = count + 1,
            last_seen = ?,
            examples = ?
        WHERE id = ?
      `).run(invocation.timestamp, JSON.stringify(examples), patternId);
        }
        else {
            this.db.prepare(`
        INSERT INTO error_patterns (
          id, tool_id, error_type, message, count,
          first_seen, last_seen, examples
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patternId, invocation.toolId, errorType, invocation.error, 1, invocation.timestamp, invocation.timestamp, JSON.stringify([invocation.id]));
        }
    }
    /**
     * Extract error type from error message
     */
    extractErrorType(error) {
        // Common error patterns
        if (error.includes('timeout'))
            return 'timeout';
        if (error.includes('not found') || error.includes('404'))
            return 'not_found';
        if (error.includes('unauthorized') || error.includes('401'))
            return 'unauthorized';
        if (error.includes('forbidden') || error.includes('403'))
            return 'forbidden';
        if (error.includes('rate limit'))
            return 'rate_limit';
        if (error.includes('invalid') || error.includes('validation'))
            return 'validation_error';
        if (error.includes('network') || error.includes('connection'))
            return 'network_error';
        return 'unknown_error';
    }
    /**
     * Get comprehensive metrics for a tool
     */
    async getToolMetrics(toolId, forceRefresh = false) {
        // Check cache
        if (!forceRefresh && this.metricsCache.has(toolId)) {
            const cached = this.metricsCache.get(toolId);
            if (Date.now() - this.lastCacheUpdate < this.cacheExpiry) {
                return cached;
            }
        }
        const invocations = this.db.prepare(`
      SELECT * FROM mcp_invocations WHERE tool_id = ? ORDER BY timestamp DESC
    `).all(toolId);
        if (invocations.length === 0) {
            return null;
        }
        const latencies = invocations.map((i) => i.duration).sort((a, b) => a - b);
        const successCount = invocations.filter((i) => i.success === 1).length;
        const failureCount = invocations.length - successCount;
        const errorPatterns = this.db.prepare(`
      SELECT * FROM error_patterns WHERE tool_id = ? ORDER BY count DESC
    `).all(toolId).map((ep) => ({
            errorType: ep.error_type,
            message: ep.message,
            count: ep.count,
            firstSeen: ep.first_seen,
            lastSeen: ep.last_seen,
            examples: JSON.parse(ep.examples),
        }));
        const metrics = {
            toolId,
            toolName: invocations[0].tool_name,
            serverId: invocations[0].server_id,
            totalInvocations: invocations.length,
            successCount,
            failureCount,
            avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            minLatency: latencies[0],
            maxLatency: latencies[latencies.length - 1],
            p50Latency: latencies[Math.floor(latencies.length * 0.5)],
            p95Latency: latencies[Math.floor(latencies.length * 0.95)],
            p99Latency: latencies[Math.floor(latencies.length * 0.99)],
            lastInvocation: invocations[0].timestamp,
            successRate: (successCount / invocations.length) * 100,
            errorPatterns,
        };
        this.metricsCache.set(toolId, metrics);
        this.lastCacheUpdate = Date.now();
        return metrics;
    }
    /**
     * Get all tool metrics
     */
    async getAllToolMetrics() {
        const toolIds = this.db.prepare(`
      SELECT DISTINCT tool_id FROM mcp_invocations
    `).all().map((r) => r.tool_id);
        const metrics = [];
        for (const toolId of toolIds) {
            const toolMetrics = await this.getToolMetrics(toolId);
            if (toolMetrics) {
                metrics.push(toolMetrics);
            }
        }
        return metrics.sort((a, b) => b.totalInvocations - a.totalInvocations);
    }
    /**
     * Analyze usage patterns across invocations
     */
    async analyzeUsagePatterns(timeWindowMs) {
        const cutoff = timeWindowMs ? Date.now() - timeWindowMs : 0;
        const invocations = this.db.prepare(`
      SELECT * FROM mcp_invocations
      WHERE timestamp > ?
      ORDER BY timestamp ASC
    `).all(cutoff);
        const patterns = new Map();
        // Analyze sequential patterns
        for (let i = 0; i < invocations.length - 1; i++) {
            const current = invocations[i];
            const next = invocations[i + 1];
            // Check if part of same session
            if (current.session_id === next.session_id && next.timestamp - current.timestamp < 30000) {
                const patternKey = `${current.tool_name} -> ${next.tool_name}`;
                if (!patterns.has(patternKey)) {
                    patterns.set(patternKey, {
                        pattern: patternKey,
                        description: `Tool ${current.tool_name} followed by ${next.tool_name}`,
                        frequency: 0,
                        tools: [current.tool_name, next.tool_name],
                        avgSuccessRate: 0,
                        examples: [],
                    });
                }
                const pattern = patterns.get(patternKey);
                pattern.frequency++;
                pattern.examples.push({
                    invocationId: current.id,
                    timestamp: current.timestamp,
                    success: current.success === 1 && next.success === 1,
                    context: JSON.parse(current.context),
                });
            }
        }
        // Calculate success rates
        for (const pattern of patterns.values()) {
            const successfulExamples = pattern.examples.filter(e => e.success).length;
            pattern.avgSuccessRate = (successfulExamples / pattern.examples.length) * 100;
        }
        return Array.from(patterns.values())
            .filter(p => p.frequency > 2) // At least 3 occurrences
            .sort((a, b) => b.frequency - a.frequency);
    }
    /**
     * Get invocations for a specific session
     */
    async getSessionInvocations(sessionId) {
        const rows = this.db.prepare(`
      SELECT * FROM mcp_invocations
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `).all(sessionId);
        return rows.map((row) => this.rowToInvocation(row));
    }
    /**
     * Get recent invocations
     */
    async getRecentInvocations(limit = 100) {
        const rows = this.db.prepare(`
      SELECT * FROM mcp_invocations
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit);
        return rows.map((row) => this.rowToInvocation(row));
    }
    /**
     * Get performance trends over time
     */
    async getPerformanceTrends(toolId, intervalMs = 3600000) {
        const invocations = this.db.prepare(`
      SELECT * FROM mcp_invocations
      WHERE tool_id = ?
      ORDER BY timestamp ASC
    `).all(toolId);
        if (invocations.length === 0)
            return [];
        const trends = [];
        let currentBucket = {
            start: invocations[0].timestamp,
            end: invocations[0].timestamp + intervalMs,
            invocations: [],
        };
        for (const inv of invocations) {
            if (inv.timestamp > currentBucket.end) {
                // Finalize current bucket
                if (currentBucket.invocations.length > 0) {
                    trends.push(this.calculateBucketMetrics(currentBucket));
                }
                // Start new bucket
                currentBucket = {
                    start: inv.timestamp,
                    end: inv.timestamp + intervalMs,
                    invocations: [inv],
                };
            }
            else {
                currentBucket.invocations.push(inv);
            }
        }
        // Add last bucket
        if (currentBucket.invocations.length > 0) {
            trends.push(this.calculateBucketMetrics(currentBucket));
        }
        return trends;
    }
    /**
     * Calculate metrics for a time bucket
     */
    calculateBucketMetrics(bucket) {
        const invs = bucket.invocations;
        const successful = invs.filter((i) => i.success === 1).length;
        const latencies = invs.map((i) => i.duration);
        return {
            timestamp: bucket.start,
            count: invs.length,
            successRate: (successful / invs.length) * 100,
            avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
            minLatency: Math.min(...latencies),
            maxLatency: Math.max(...latencies),
        };
    }
    /**
     * Convert database row to MCPInvocation
     */
    rowToInvocation(row) {
        return {
            id: row.id,
            serverId: row.server_id,
            serverName: row.server_name,
            toolName: row.tool_name,
            toolId: row.tool_id,
            params: JSON.parse(row.params),
            timestamp: row.timestamp,
            duration: row.duration,
            success: row.success === 1,
            error: row.error || undefined,
            result: row.result ? JSON.parse(row.result) : undefined,
            context: JSON.parse(row.context),
        };
    }
    /**
     * Clear old data
     */
    async clearOldData(olderThanMs) {
        const cutoff = Date.now() - olderThanMs;
        const result = this.db.prepare(`
      DELETE FROM mcp_invocations WHERE timestamp < ?
    `).run(cutoff);
        // Clear orphaned error patterns
        this.db.prepare(`
      DELETE FROM error_patterns
      WHERE last_seen < ?
    `).run(cutoff);
        this.metricsCache.clear();
        return result.changes || 0;
    }
    /**
     * Export tracking data for analysis
     */
    async exportData(outputPath) {
        const data = {
            invocations: this.db.prepare('SELECT * FROM mcp_invocations').all(),
            errorPatterns: this.db.prepare('SELECT * FROM error_patterns').all(),
            exportedAt: Date.now(),
        };
        const fs = await import('fs/promises');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    }
}
//# sourceMappingURL=tracker.js.map