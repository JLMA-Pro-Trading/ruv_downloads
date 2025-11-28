/**
 * Learning System Manager
 *
 * Unified interface for the complete learning system.
 * Coordinates tracking, pattern learning, memory, and adaptive optimization.
 */
import { MCPInvocationTracker } from './tracker.js';
import { PatternLearner } from './patterns.js';
import { MCPMemorySystem } from './memory.js';
import { AdaptiveOptimizer } from './adaptive.js';
export class LearningSystemManager {
    tracker;
    patternLearner;
    memory;
    adaptive;
    config;
    constructor(config = {}) {
        this.config = {
            agentDbPath: config.agentDbPath || './ultrathink',
            embeddingModel: config.embeddingModel || 'transformer',
            vectorDimensions: config.vectorDimensions || 384,
            trackingEnabled: config.trackingEnabled !== false,
            patternDiscoveryEnabled: config.patternDiscoveryEnabled !== false,
            adaptiveOptimizationEnabled: config.adaptiveOptimizationEnabled !== false,
            selfHealingEnabled: config.selfHealingEnabled !== false,
            learningRate: config.learningRate || 0.01,
            confidenceThreshold: config.confidenceThreshold || 0.7,
            minSupport: config.minSupport || 3,
            maxPatterns: config.maxPatterns || 1000,
        };
        // Initialize components
        this.tracker = new MCPInvocationTracker(`${this.config.agentDbPath}-tracking.db`);
        this.patternLearner = new PatternLearner(`${this.config.agentDbPath}-patterns.db`, this.config.embeddingModel);
        this.memory = new MCPMemorySystem(`${this.config.agentDbPath}-memory.db`, this.config.embeddingModel, this.config.vectorDimensions);
        this.adaptive = new AdaptiveOptimizer(`${this.config.agentDbPath}-adaptive.db`, this.tracker, this.patternLearner, this.memory);
    }
    /**
     * Track a new MCP invocation
     */
    async trackInvocation(invocation) {
        if (!this.config.trackingEnabled)
            return;
        await this.tracker.trackInvocation(invocation);
        // Trigger pattern discovery periodically
        if (this.config.patternDiscoveryEnabled && Math.random() < 0.1) {
            // 10% chance to discover patterns
            const recent = await this.tracker.getRecentInvocations(100);
            await this.patternLearner.discoverPatterns(recent);
        }
        // Trigger adaptive optimization for the tool
        if (this.config.adaptiveOptimizationEnabled && !invocation.success) {
            await this.adaptive.analyzeAndAdapt(invocation.toolId);
        }
    }
    /**
     * Register a new MCP server
     */
    async registerServer(server) {
        await this.memory.storeServerMetadata(server);
    }
    /**
     * Search for tools
     */
    async searchTools(query, limit = 10) {
        return this.memory.searchTools({
            query,
            type: 'tool',
            limit,
        });
    }
    /**
     * Get tool recommendations based on context
     */
    async getRecommendations(context, currentTools, limit = 5) {
        return this.patternLearner.getRecommendations(context, currentTools, limit);
    }
    /**
     * Record user feedback
     */
    async recordFeedback(feedback) {
        await this.adaptive.recordFeedback(feedback);
    }
    /**
     * Get system metrics
     */
    async getMetrics() {
        const allMetrics = await this.tracker.getAllToolMetrics();
        const servers = await this.memory.getAllServers();
        const totalInvocations = allMetrics.reduce((sum, m) => sum + m.totalInvocations, 0);
        const avgSuccessRate = allMetrics.length > 0
            ? allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length
            : 0;
        const avgLatency = allMetrics.length > 0
            ? allMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / allMetrics.length
            : 0;
        return {
            totalInvocations,
            totalServers: servers.length,
            totalTools: allMetrics.length,
            totalPatterns: 0, // TODO: Get from pattern learner
            totalTemplates: 0, // TODO: Get from memory
            avgSuccessRate,
            avgLatency,
            lastUpdate: Date.now(),
            health: this.determineHealth(avgSuccessRate, avgLatency),
        };
    }
    /**
     * Get system health status
     */
    async getHealthStatus() {
        const metrics = await this.getMetrics();
        const issues = [];
        // Check for issues
        if (metrics.avgSuccessRate < 80) {
            issues.push({
                severity: 'critical',
                component: 'tools',
                message: `Low average success rate: ${metrics.avgSuccessRate.toFixed(1)}%`,
                recommendation: 'Review failing tools and implement error handling',
            });
        }
        if (metrics.avgLatency > 5000) {
            issues.push({
                severity: 'warning',
                component: 'performance',
                message: `High average latency: ${metrics.avgLatency.toFixed(0)}ms`,
                recommendation: 'Consider implementing caching or optimization',
            });
        }
        if (metrics.totalInvocations < 10) {
            issues.push({
                severity: 'info',
                component: 'data',
                message: 'Insufficient data for reliable analysis',
                recommendation: 'Continue using the system to collect more data',
            });
        }
        return {
            status: metrics.health,
            issues,
            metrics,
            timestamp: Date.now(),
        };
    }
    /**
     * Get optimization suggestions
     */
    async getOptimizationSuggestions() {
        return this.adaptive.getAllSuggestions(false);
    }
    /**
     * Get anti-patterns to avoid
     */
    async getAntiPatterns() {
        return this.patternLearner.getAntiPatterns();
    }
    /**
     * Export all learning data
     */
    async exportAllData(outputDir) {
        const fs = await import('fs/promises');
        await fs.mkdir(outputDir, { recursive: true });
        await this.tracker.exportData(`${outputDir}/tracking-data.json`);
        await this.memory.exportData(`${outputDir}/memory-data.json`);
        const metrics = await this.getMetrics();
        const health = await this.getHealthStatus();
        const suggestions = await this.getOptimizationSuggestions();
        const antiPatterns = await this.getAntiPatterns();
        await fs.writeFile(`${outputDir}/summary.json`, JSON.stringify({
            metrics,
            health,
            suggestions,
            antiPatterns,
            exportedAt: Date.now(),
        }, null, 2));
    }
    /**
     * Cleanup old data
     */
    async cleanup(olderThanDays = 30) {
        const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000;
        await this.tracker.clearOldData(olderThanMs);
    }
    /**
     * Get component instances (for advanced usage)
     */
    getComponents() {
        return {
            tracker: this.tracker,
            patternLearner: this.patternLearner,
            memory: this.memory,
            adaptive: this.adaptive,
        };
    }
    // ========== Helper Methods ==========
    determineHealth(successRate, latency) {
        if (successRate < 70 || latency > 10000) {
            return 'critical';
        }
        if (successRate < 85 || latency > 5000) {
            return 'degraded';
        }
        return 'healthy';
    }
}
//# sourceMappingURL=manager.js.map