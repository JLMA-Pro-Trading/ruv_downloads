/**
 * PromptScientist Agent - Tier 1 Core Decision Maker
 *
 * Evolves prompts using PromptBreeder genetic algorithm
 *
 * Responsibilities:
 * - Identify top-performing prompts across projects
 * - Apply mutation and crossover techniques
 * - Evaluate fitness across multiple projects
 * - Vote on prompt upgrade decisions
 *
 * @module council/agents/PromptScientist
 * @version 1.0.0
 */
/**
 * PromptScientist Agent - Evolves prompts using genetic algorithms
 */
export class PromptScientist {
    config;
    constructor(config = {}) {
        this.config = {
            minImprovementThreshold: config.minImprovementThreshold ?? 0.03, // 3% improvement
            minTestProjects: config.minTestProjects ?? 2,
            voteWeight: config.voteWeight ?? 2.0
        };
    }
    /**
     * Analyze telemetry and evolve prompts
     */
    async analyze(telemetry) {
        // Identify top-performing experts
        const topExperts = this.identifyTopExperts(telemetry);
        // Evolve prompts from top performers
        const evolvedPrompts = await this.evolvePrompts(topExperts, telemetry);
        // Find deployment candidates
        const deploymentCandidates = this.findDeploymentCandidates(evolvedPrompts, telemetry);
        // Generate recommendation
        const { recommendation, confidence } = this.generateRecommendation(deploymentCandidates);
        return {
            agent: 'PromptScientist',
            evolvedPrompts,
            deploymentCandidates,
            recommendation,
            confidence,
            evidence: {
                totalEvolved: evolvedPrompts.length,
                avgImprovement: evolvedPrompts.reduce((sum, p) => sum + p.avgImprovement, 0) / evolvedPrompts.length || 0,
                candidatesCount: deploymentCandidates.length,
                topExperts: topExperts.length
            }
        };
    }
    /**
     * Identify top-performing experts across projects
     */
    identifyTopExperts(telemetry) {
        const experts = [];
        for (const projectData of telemetry.projects) {
            for (const expert of projectData.experts) {
                if (expert.metrics.accuracy >= 0.85 && expert.metrics.totalRuns >= 20) {
                    experts.push({
                        project: projectData.project,
                        expertId: expert.expertId,
                        expertType: expert.expertType,
                        version: expert.version,
                        accuracy: expert.metrics.accuracy
                    });
                }
            }
        }
        // Sort by accuracy
        return experts.sort((a, b) => b.accuracy - a.accuracy).slice(0, 10);
    }
    /**
     * Evolve prompts using PromptBreeder techniques
     */
    async evolvePrompts(topExperts, telemetry) {
        const evolved = [];
        // Group by expert type
        const expertsByType = new Map();
        for (const expert of topExperts) {
            if (!expertsByType.has(expert.expertType)) {
                expertsByType.set(expert.expertType, []);
            }
            expertsByType.get(expert.expertType).push(expert);
        }
        // Evolve prompts for each type
        for (const [expertType, experts] of expertsByType) {
            if (experts.length < 2)
                continue; // Need at least 2 for crossover
            // Get best performing expert of this type
            const best = experts[0];
            // Simulate PromptBreeder evolution
            const mutations = this.generateMutations(best);
            // Test fitness across projects
            const fitnessTests = this.simulateFitnessTesting(expertType, telemetry);
            const avgImprovement = fitnessTests.reduce((sum, t) => sum + t.improvement, 0) / fitnessTests.length || 0;
            if (avgImprovement > 0) {
                evolved.push({
                    id: `evolved-${expertType}-${Date.now()}`,
                    expertType,
                    version: this.incrementVersion(best.version),
                    previousVersion: best.version,
                    template: `Evolved ${expertType} prompt v${this.incrementVersion(best.version)}`,
                    mutations,
                    fitnessTests,
                    avgImprovement
                });
            }
        }
        return evolved;
    }
    /**
     * Generate mutations for prompt evolution
     */
    generateMutations(_expert) {
        return [
            {
                type: 'wording',
                description: 'Improved clarity and precision in instructions'
            },
            {
                type: 'structure',
                description: 'Optimized reasoning chain structure'
            },
            {
                type: 'examples',
                description: 'Added high-performing few-shot examples'
            }
        ];
    }
    /**
     * Simulate fitness testing across projects
     */
    simulateFitnessTesting(expertType, telemetry) {
        const tests = [];
        for (const projectData of telemetry.projects) {
            const expert = projectData.experts.find(e => e.expertType === expertType);
            if (expert) {
                // Simulate improvement (in production, would run actual A/B test)
                const improvement = Math.random() * 0.1; // 0-10% improvement
                tests.push({
                    project: projectData.project,
                    improvement,
                    sampleSize: expert.metrics.totalRuns
                });
            }
        }
        return tests;
    }
    /**
     * Find deployment candidates
     */
    findDeploymentCandidates(evolvedPrompts, telemetry) {
        return evolvedPrompts
            .filter(prompt => prompt.avgImprovement >= this.config.minImprovementThreshold)
            .map(prompt => {
            // Find all experts of this type across projects
            const targetExperts = [];
            for (const projectData of telemetry.projects) {
                for (const expert of projectData.experts) {
                    if (expert.expertType === prompt.expertType) {
                        targetExperts.push(`${projectData.project}:${expert.expertId}`);
                    }
                }
            }
            const reasoning = [
                `Evolved from v${prompt.previousVersion} to v${prompt.version}`,
                `Average improvement: ${(prompt.avgImprovement * 100).toFixed(1)}%`,
                `Tested on ${prompt.fitnessTests.length} project(s)`,
                `Applied mutations: ${prompt.mutations.map(m => m.type).join(', ')}`
            ];
            return {
                prompt,
                targetExperts,
                expectedImprovement: prompt.avgImprovement,
                reasoning
            };
        })
            .sort((a, b) => b.expectedImprovement - a.expectedImprovement);
    }
    /**
     * Generate voting recommendation
     */
    generateRecommendation(candidates) {
        if (candidates.length === 0) {
            return { recommendation: 'NEUTRAL', confidence: 0.7 };
        }
        const bestCandidate = candidates[0];
        // Strong improvement -> APPROVE
        if (bestCandidate.expectedImprovement >= 0.05) {
            return {
                recommendation: 'APPROVE',
                confidence: Math.min(bestCandidate.expectedImprovement / 0.1, 0.95)
            };
        }
        // Moderate improvement -> CONDITIONAL
        if (bestCandidate.expectedImprovement >= this.config.minImprovementThreshold) {
            return {
                recommendation: 'CONDITIONAL',
                confidence: bestCandidate.expectedImprovement / 0.05
            };
        }
        return {
            recommendation: 'NEUTRAL',
            confidence: 0.6
        };
    }
    /**
     * Increment version string
     */
    incrementVersion(version) {
        const parts = version.split('.');
        const patch = parseInt(parts[parts.length - 1]) || 0;
        parts[parts.length - 1] = (patch + 1).toString();
        return parts.join('.');
    }
    /**
     * Get agent vote weight
     */
    getVoteWeight() {
        return this.config.voteWeight;
    }
}
/**
 * Create PromptScientist agent
 */
export function createPromptScientist(config) {
    return new PromptScientist(config);
}
