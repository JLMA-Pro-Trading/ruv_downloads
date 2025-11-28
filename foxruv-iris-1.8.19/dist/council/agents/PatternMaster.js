/**
 * PatternMaster Agent - Tier 1 Core Decision Maker
 *
 * Discovers cross-project patterns using AgentDB vector search
 *
 * Responsibilities:
 * - Analyze telemetry for transferable patterns
 * - Use vector similarity to find cross-project patterns
 * - Evaluate pattern success rates and domain overlap
 * - Vote on pattern transfer decisions
 *
 * @module council/agents/PatternMaster
 * @version 1.0.0
 */
import { AgentDBManager } from '../../storage/agentdb-integration.js';
/**
 * PatternMaster Agent - Discovers cross-project patterns
 */
export class PatternMaster {
    agentDb;
    config;
    constructor(config = {}) {
        this.config = {
            agentDbPath: config.agentDbPath || './data/council/patterns.db',
            minSuccessRate: config.minSuccessRate ?? 0.85,
            minSampleSize: config.minSampleSize ?? 20,
            similarityThreshold: config.similarityThreshold ?? 0.75,
            voteWeight: config.voteWeight ?? 2.0
        };
        this.agentDb = new AgentDBManager({
            dbPath: this.config.agentDbPath,
            enableCausalReasoning: true,
            similarityThreshold: this.config.similarityThreshold
        });
    }
    /**
     * Analyze telemetry and discover transferable patterns
     */
    async analyze(telemetry) {
        // Extract patterns from telemetry
        const patterns = await this.extractPatterns(telemetry);
        // Find transfer candidates using vector search
        const transferCandidates = await this.findTransferCandidates(patterns, telemetry);
        // Generate recommendation based on candidates
        const { recommendation, confidence } = this.generateRecommendation(transferCandidates);
        return {
            agent: 'PatternMaster',
            patternsFound: patterns,
            transferCandidates,
            recommendation,
            confidence,
            evidence: {
                totalPatterns: patterns.length,
                highSuccessPatterns: patterns.filter(p => p.successRate >= 0.9).length,
                transferCandidatesCount: transferCandidates.length,
                avgSuccessRate: patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length || 0
            }
        };
    }
    /**
     * Extract patterns from telemetry data
     */
    async extractPatterns(telemetry) {
        const patterns = [];
        for (const projectData of telemetry.projects) {
            for (const expert of projectData.experts) {
                // Only consider high-performing experts
                if (expert.metrics.accuracy >= this.config.minSuccessRate &&
                    expert.metrics.totalRuns >= this.config.minSampleSize) {
                    // Create pattern from expert's successful approach
                    const pattern = {
                        id: `pattern-${projectData.project}-${expert.expertId}-${Date.now()}`,
                        name: `${expert.expertType}_pattern_${projectData.project}`,
                        description: `Successful pattern from ${expert.expertId} with ${(expert.metrics.accuracy * 100).toFixed(1)}% accuracy`,
                        sourceProject: projectData.project,
                        sourceExpert: expert.expertId,
                        pattern: {
                            type: this.inferPatternType(expert),
                            implementation: expert.expertType,
                            config: {
                                expertType: expert.expertType,
                                version: expert.version,
                                averageConfidence: expert.metrics.confidence
                            }
                        },
                        successRate: expert.metrics.accuracy,
                        sampleSize: expert.metrics.totalRuns,
                        domains: [projectData.project, expert.expertType]
                    };
                    patterns.push(pattern);
                }
            }
        }
        // Also include pre-discovered patterns from telemetry
        patterns.push(...telemetry.patterns);
        return patterns;
    }
    /**
     * Infer pattern type from expert characteristics
     */
    inferPatternType(expert) {
        // High confidence suggests good calibration
        if (expert.metrics.confidence > 0.85) {
            return 'confidence_calibration';
        }
        // Fast response suggests efficiency pattern
        if (expert.metrics.latency < 1000) {
            return 'fast_reasoning';
        }
        // High accuracy suggests strong reasoning
        if (expert.metrics.accuracy > 0.9) {
            return 'reasoning_chain';
        }
        return 'general_optimization';
    }
    /**
     * Find transfer candidates using vector similarity
     */
    async findTransferCandidates(patterns, telemetry) {
        const candidates = [];
        for (const pattern of patterns) {
            // Find similar experts across projects using vector search
            // (In production, would use actual embeddings)
            const targetProjects = this.findCompatibleProjects(pattern, telemetry);
            if (targetProjects.length > 0) {
                const reasoning = [
                    `Pattern from ${pattern.sourceProject} shows ${(pattern.successRate * 100).toFixed(1)}% success rate`,
                    `Based on ${pattern.sampleSize} samples`,
                    `Compatible with ${targetProjects.length} other project(s)`,
                    `Pattern type: ${pattern.pattern.type}`
                ];
                // Calculate transfer confidence based on success rate and compatibility
                const transferConfidence = Math.min(pattern.successRate * (targetProjects.length / telemetry.projects.length), 1.0);
                candidates.push({
                    pattern,
                    targetProjects,
                    transferConfidence,
                    reasoning
                });
            }
        }
        // Sort by transfer confidence
        return candidates.sort((a, b) => b.transferConfidence - a.transferConfidence);
    }
    /**
     * Find projects compatible with a pattern
     */
    findCompatibleProjects(pattern, telemetry) {
        const compatibleProjects = [];
        for (const projectData of telemetry.projects) {
            // Skip source project
            if (projectData.project === pattern.sourceProject)
                continue;
            // Check if project has similar expert types
            const hasCompatibleExpert = projectData.experts.some(expert => expert.expertType === pattern.pattern.config.expertType);
            if (hasCompatibleExpert) {
                compatibleProjects.push(projectData.project);
            }
        }
        return compatibleProjects;
    }
    /**
     * Generate voting recommendation
     */
    generateRecommendation(candidates) {
        if (candidates.length === 0) {
            return { recommendation: 'REJECT', confidence: 0.5 };
        }
        // Get best candidate
        const bestCandidate = candidates[0];
        // Approve if confidence is high
        if (bestCandidate.transferConfidence >= 0.85) {
            return {
                recommendation: 'APPROVE',
                confidence: bestCandidate.transferConfidence
            };
        }
        // Conditional if moderate
        if (bestCandidate.transferConfidence >= 0.7) {
            return {
                recommendation: 'CONDITIONAL',
                confidence: bestCandidate.transferConfidence
            };
        }
        // Neutral otherwise
        return {
            recommendation: 'NEUTRAL',
            confidence: bestCandidate.transferConfidence
        };
    }
    /**
     * Get agent vote weight
     */
    getVoteWeight() {
        return this.config.voteWeight;
    }
    /**
     * Close resources
     */
    close() {
        this.agentDb.close();
    }
}
/**
 * Create PatternMaster agent
 */
export function createPatternMaster(config) {
    return new PatternMaster(config);
}
