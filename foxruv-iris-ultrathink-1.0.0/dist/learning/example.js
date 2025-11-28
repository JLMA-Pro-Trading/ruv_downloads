/**
 * UltraThink Learning System - Example Usage
 *
 * Demonstrates how to use the learning system for MCP tool optimization
 */
import { LearningSystemManager } from './manager.js';
async function main() {
    console.log('🚀 UltraThink Learning System Example\n');
    // ===== 1. Initialize the Learning System =====
    console.log('📦 Initializing learning system...');
    const learning = new LearningSystemManager({
        agentDbPath: './example-data',
        embeddingModel: 'transformer',
        vectorDimensions: 384,
        trackingEnabled: true,
        patternDiscoveryEnabled: true,
        adaptiveOptimizationEnabled: true,
        selfHealingEnabled: true,
    });
    console.log('✓ Learning system initialized\n');
    // ===== 2. Register MCP Servers =====
    console.log('📋 Registering MCP servers...');
    const codeAnalyzerTools = [
        {
            id: 'tool-analyze',
            serverId: 'server-code-analyzer',
            name: 'analyze_code',
            description: 'Analyze TypeScript code for issues and improvements',
            inputSchema: {
                type: 'object',
                properties: {
                    file: { type: 'string' },
                    options: { type: 'object' },
                },
            },
            examples: [
                {
                    description: 'Analyze a TypeScript file',
                    input: { file: 'app.ts', options: { strict: true } },
                },
            ],
            tags: ['typescript', 'analysis', 'code-quality'],
            category: 'code-analysis',
            complexity: 'moderate',
            reliability: 0.95,
            avgLatency: 1200,
        },
        {
            id: 'tool-lint',
            serverId: 'server-code-analyzer',
            name: 'lint_code',
            description: 'Run ESLint on code files',
            inputSchema: {
                type: 'object',
                properties: {
                    file: { type: 'string' },
                },
            },
            examples: [
                {
                    description: 'Lint a file',
                    input: { file: 'app.ts' },
                },
            ],
            tags: ['eslint', 'linting'],
            category: 'code-quality',
            complexity: 'simple',
            reliability: 0.98,
            avgLatency: 800,
        },
    ];
    const codeAnalyzerServer = {
        id: 'server-code-analyzer',
        name: 'code-analyzer',
        version: '1.0.0',
        description: 'MCP server for code analysis and quality checks',
        capabilities: ['analysis', 'linting', 'formatting'],
        tools: codeAnalyzerTools,
        added: Date.now(),
        lastUpdated: Date.now(),
        status: 'active',
    };
    await learning.registerServer(codeAnalyzerServer);
    console.log('✓ Registered server: code-analyzer\n');
    // ===== 3. Simulate Tool Invocations =====
    console.log('🔄 Simulating tool invocations...');
    const invocations = [];
    // Simulate successful invocations
    for (let i = 0; i < 20; i++) {
        const invocation = {
            id: `inv-${Date.now()}-${i}`,
            serverId: 'server-code-analyzer',
            serverName: 'code-analyzer',
            toolName: 'analyze_code',
            toolId: 'tool-analyze',
            params: {
                file: `file-${i % 5}.ts`,
                options: { strict: true },
            },
            timestamp: Date.now() - (20 - i) * 60000, // Spread over last 20 minutes
            duration: 1000 + Math.random() * 500,
            success: Math.random() > 0.1, // 90% success rate
            error: Math.random() < 0.1 ? 'Timeout error' : undefined,
            context: {
                sessionId: `session-${Math.floor(i / 5)}`,
                taskType: 'code-review',
            },
        };
        invocations.push(invocation);
        await learning.trackInvocation(invocation);
    }
    // Simulate lint tool invocations (often used after analyze)
    for (let i = 0; i < 15; i++) {
        const invocation = {
            id: `inv-lint-${Date.now()}-${i}`,
            serverId: 'server-code-analyzer',
            serverName: 'code-analyzer',
            toolName: 'lint_code',
            toolId: 'tool-lint',
            params: {
                file: `file-${i % 5}.ts`,
            },
            timestamp: Date.now() - (15 - i) * 60000,
            duration: 600 + Math.random() * 300,
            success: Math.random() > 0.05, // 95% success rate
            context: {
                sessionId: `session-${Math.floor(i / 5)}`,
                taskType: 'code-review',
            },
        };
        invocations.push(invocation);
        await learning.trackInvocation(invocation);
    }
    console.log(`✓ Tracked ${invocations.length} invocations\n`);
    // ===== 4. Get System Metrics =====
    console.log('📊 System Metrics:');
    const metrics = await learning.getMetrics();
    console.log(`  Total Invocations: ${metrics.totalInvocations}`);
    console.log(`  Total Servers: ${metrics.totalServers}`);
    console.log(`  Total Tools: ${metrics.totalTools}`);
    console.log(`  Avg Success Rate: ${metrics.avgSuccessRate.toFixed(1)}%`);
    console.log(`  Avg Latency: ${metrics.avgLatency.toFixed(0)}ms`);
    console.log(`  Health: ${metrics.health}\n`);
    // ===== 5. Search for Tools =====
    console.log('🔍 Searching for tools...');
    const searchResults = await learning.searchTools('analyze TypeScript code for bugs and improvements', 3);
    console.log('Search results:');
    for (const result of searchResults) {
        console.log(`  [${(result.score * 100).toFixed(1)}%] ${result.item.name}`);
        console.log(`    ${result.item.description}`);
        console.log(`    Tags: ${result.item.tags.join(', ')}`);
        console.log(`    Reliability: ${(result.item.reliability * 100).toFixed(0)}%\n`);
    }
    // ===== 6. Get Pattern-Based Recommendations =====
    console.log('💡 Getting recommendations...');
    const recommendations = await learning.getRecommendations('Reviewing TypeScript codebase for quality issues', ['analyze_code'], 3);
    if (recommendations.length > 0) {
        console.log('Recommended patterns:');
        for (const rec of recommendations) {
            console.log(`  [${(rec.relevanceScore * 100).toFixed(0)}%] ${rec.pattern.name}`);
            console.log(`    ${rec.reasoning}`);
            console.log(`    Expected: ${rec.expectedImpact}\n`);
        }
    }
    else {
        console.log('  No recommendations yet (need more data)\n');
    }
    // ===== 7. Get Optimization Suggestions =====
    console.log('🎯 Optimization Suggestions:');
    const suggestions = await learning.getOptimizationSuggestions();
    if (suggestions.length > 0) {
        for (const suggestion of suggestions.slice(0, 3)) {
            console.log(`  [${suggestion.impact.toUpperCase()}] ${suggestion.title}`);
            console.log(`    ${suggestion.description}`);
            console.log(`    Effort: ${suggestion.effort} | Confidence: ${(suggestion.confidence * 100).toFixed(0)}%`);
            console.log(`    Implementation: ${suggestion.implementation}\n`);
        }
    }
    else {
        console.log('  No suggestions yet (system is performing well)\n');
    }
    // ===== 8. Check Health Status =====
    console.log('🏥 Health Status:');
    const health = await learning.getHealthStatus();
    console.log(`  Status: ${health.status.toUpperCase()}`);
    if (health.issues.length > 0) {
        console.log('  Issues:');
        for (const issue of health.issues) {
            console.log(`    [${issue.severity}] ${issue.message}`);
            if (issue.recommendation) {
                console.log(`      → ${issue.recommendation}`);
            }
        }
    }
    else {
        console.log('  No issues detected');
    }
    console.log();
    // ===== 9. Get Anti-Patterns =====
    console.log('⚠️  Anti-Patterns:');
    const antiPatterns = await learning.getAntiPatterns();
    if (antiPatterns.length > 0) {
        for (const antiPattern of antiPatterns.slice(0, 2)) {
            console.log(`  [${antiPattern.impact.toUpperCase()}] ${antiPattern.name}`);
            console.log(`    ${antiPattern.description}`);
            console.log(`    Occurrences: ${antiPattern.occurrences}`);
            console.log(`    Remediation: ${antiPattern.remediation}\n`);
        }
    }
    else {
        console.log('  No anti-patterns detected\n');
    }
    // ===== 10. Record User Feedback =====
    console.log('📝 Recording user feedback...');
    await learning.recordFeedback({
        invocationId: invocations[0].id,
        rating: 5,
        suggestions: ['Great performance', 'Accurate analysis'],
        userNotes: 'Tool works perfectly for TypeScript analysis',
        timestamp: Date.now(),
    });
    console.log('✓ Feedback recorded\n');
    // ===== 11. Access Individual Components =====
    console.log('🔧 Accessing individual components...');
    const components = learning.getComponents();
    // Get detailed tool metrics
    const toolMetrics = await components.tracker.getToolMetrics('tool-analyze');
    if (toolMetrics) {
        console.log('Detailed metrics for analyze_code:');
        console.log(`  Total invocations: ${toolMetrics.totalInvocations}`);
        console.log(`  Success rate: ${toolMetrics.successRate.toFixed(1)}%`);
        console.log(`  Avg latency: ${toolMetrics.avgLatency.toFixed(0)}ms`);
        console.log(`  P95 latency: ${toolMetrics.p95Latency.toFixed(0)}ms`);
        console.log(`  P99 latency: ${toolMetrics.p99Latency.toFixed(0)}ms`);
        if (toolMetrics.errorPatterns.length > 0) {
            console.log('  Error patterns:');
            for (const error of toolMetrics.errorPatterns) {
                console.log(`    - ${error.errorType}: ${error.count} times`);
            }
        }
    }
    console.log();
    // ===== 12. Export Data =====
    console.log('💾 Exporting learning data...');
    await learning.exportAllData('./example-export');
    console.log('✓ Data exported to ./example-export\n');
    // ===== 13. Cleanup =====
    console.log('🧹 Cleanup (optional):');
    console.log('  Run: learning.cleanup(30) to clean data older than 30 days');
    console.log('  Run: components.memory.vacuum() to optimize database\n');
    console.log('✅ Example completed successfully!');
    console.log('\nNext steps:');
    console.log('  1. Integrate with your MCP wrapper generator');
    console.log('  2. Track all tool invocations automatically');
    console.log('  3. Use recommendations to improve wrapper generation');
    console.log('  4. Monitor health status and apply optimizations');
    console.log('  5. Let the system self-heal and adapt over time');
}
// Run example
main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
//# sourceMappingURL=example.js.map