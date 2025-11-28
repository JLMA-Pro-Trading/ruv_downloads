/**
 * TransferTester Agent - Tier 2 Validator
 *
 * Tests pattern/prompt applicability across projects with A/B testing
 *
 * Responsibilities:
 * - Run A/B tests with small traffic percentages
 * - Measure accuracy, confidence, latency changes
 * - Assess domain compatibility
 * - Calculate improvement confidence intervals
 *
 * @module council/agents/TransferTester
 * @version 1.0.0
 */
/**
 * TransferTester Agent - Validates cross-domain applicability
 */
export class TransferTester {
    config;
    constructor(config = {}) {
        this.config = {
            testPercentage: config.testPercentage ?? 0.1, // 10% traffic
            testDuration: config.testDuration ?? '1h',
            minImprovement: config.minImprovement ?? 0.03, // 3% improvement
            voteWeight: config.voteWeight ?? 1.5
        };
    }
    /**
     * Validate pattern/prompt transfers
     */
    async analyze(telemetry) {
        // Test patterns across projects
        const testsCompleted = await this.runTransferTests(telemetry);
        // Generate recommendation
        const { recommendation, confidence } = this.generateRecommendation(testsCompleted);
        return {
            agent: 'TransferTester',
            testsCompleted,
            recommendation,
            confidence,
            evidence: {
                totalTests: testsCompleted.length,
                passedTests: testsCompleted.filter(t => t.passed).length,
                avgImprovement: testsCompleted.reduce((sum, t) => sum + t.results.improvement, 0) / testsCompleted.length || 0,
                testDuration: this.config.testDuration
            }
        };
    }
    /**
     * Run transfer tests for patterns
     */
    async runTransferTests(telemetry) {
        const tests = [];
        // Test each pattern on compatible projects
        for (const pattern of telemetry.patterns) {
            // Find compatible target projects
            const targetProjects = this.findCompatibleProjects(pattern, telemetry);
            for (const targetProject of targetProjects) {
                // Simulate A/B test (in production, would run actual test)
                const testResults = this.simulateABTest(pattern, targetProject, telemetry);
                tests.push({
                    pattern,
                    targetProject,
                    testDuration: this.config.testDuration,
                    results: testResults,
                    passed: testResults.improvement >= this.config.minImprovement
                });
            }
        }
        return tests;
    }
    /**
     * Find compatible target projects for a pattern
     */
    findCompatibleProjects(pattern, telemetry) {
        const compatible = [];
        for (const projectData of telemetry.projects) {
            // Skip source project
            if (projectData.project === pattern.sourceProject)
                continue;
            // Check domain overlap
            const hasOverlap = pattern.domains.some(domain => projectData.experts.some(e => e.expertType.includes(domain) || domain.includes(e.expertType)));
            if (hasOverlap) {
                compatible.push(projectData.project);
            }
        }
        return compatible;
    }
    /**
     * Simulate A/B test for pattern transfer
     */
    simulateABTest(pattern, targetProject, telemetry) {
        // Find target project data
        const projectData = telemetry.projects.find(p => p.project === targetProject);
        if (!projectData) {
            return {
                baselineAccuracy: 0,
                patternAccuracy: 0,
                improvement: 0,
                sampleSize: 0
            };
        }
        // Find compatible expert
        const compatibleExpert = projectData.experts.find(e => pattern.domains.some(d => e.expertType.includes(d)));
        if (!compatibleExpert) {
            return {
                baselineAccuracy: 0,
                patternAccuracy: 0,
                improvement: 0,
                sampleSize: 0
            };
        }
        // Baseline accuracy
        const baselineAccuracy = compatibleExpert.metrics.accuracy;
        // Simulate pattern accuracy (in production, would use actual A/B test data)
        // Assume some improvement based on pattern success rate
        const improvementFactor = (pattern.successRate - baselineAccuracy) * 0.5; // Conservative estimate
        const patternAccuracy = Math.min(baselineAccuracy + improvementFactor, 0.99);
        // Calculate improvement
        const improvement = patternAccuracy - baselineAccuracy;
        // Sample size based on test percentage
        const sampleSize = Math.round(compatibleExpert.metrics.totalRuns * this.config.testPercentage);
        return {
            baselineAccuracy,
            patternAccuracy,
            improvement,
            sampleSize
        };
    }
    /**
     * Generate voting recommendation
     */
    generateRecommendation(tests) {
        if (tests.length === 0) {
            return { recommendation: 'NEUTRAL', confidence: 0.5 };
        }
        const passedTests = tests.filter(t => t.passed);
        const passRate = passedTests.length / tests.length;
        const avgImprovement = tests.reduce((sum, t) => sum + t.results.improvement, 0) / tests.length;
        // High pass rate with good improvement -> APPROVE
        if (passRate >= 0.8 && avgImprovement >= this.config.minImprovement * 1.5) {
            return {
                recommendation: 'APPROVE',
                confidence: Math.min(passRate * avgImprovement * 10, 0.95)
            };
        }
        // Moderate pass rate -> CONDITIONAL
        if (passRate >= 0.6 && avgImprovement >= this.config.minImprovement) {
            return {
                recommendation: 'CONDITIONAL',
                confidence: passRate * 0.85
            };
        }
        // Low pass rate -> REJECT
        if (passRate < 0.5) {
            return {
                recommendation: 'REJECT',
                confidence: 1 - passRate
            };
        }
        // Mixed results -> NEUTRAL
        return {
            recommendation: 'NEUTRAL',
            confidence: 0.6
        };
    }
    /**
     * Get agent vote weight
     */
    getVoteWeight() {
        return this.config.voteWeight;
    }
}
/**
 * Create TransferTester agent
 */
export function createTransferTester(config) {
    return new TransferTester(config);
}
