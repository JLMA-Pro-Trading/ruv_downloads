/**
 * FoxRuv Prime AI Council - Main Orchestrator
 *
 * 6-Agent federated learning control plane for cross-project decisions
 *
 * Architecture:
 * - Tier 1: PatternMaster, PromptScientist, PerformanceJudge
 * - Tier 2: TransferTester, SafetyValidator
 * - Tier 3: ConsensusOrchestrator
 *
 * @module council/AICouncil
 * @version 1.0.0
 */
import { PatternMaster } from './agents/PatternMaster.js';
import { PromptScientist } from './agents/PromptScientist.js';
import { PerformanceJudge } from './agents/PerformanceJudge.js';
import { TransferTester } from './agents/TransferTester.js';
import { SafetyValidator } from './agents/SafetyValidator.js';
import { ConsensusOrchestrator } from './agents/ConsensusOrchestrator.js';
import { GlobalMetricsCollector } from '../telemetry/global-metrics.js';
/**
 * FoxRuv Prime AI Council
 *
 * Main orchestrator for 6-agent federated learning control plane
 */
export class AICouncil {
    // Tier 1: Core Decision Makers
    patternMaster;
    promptScientist;
    performanceJudge;
    // Tier 2: Validators
    transferTester;
    safetyValidator;
    // Tier 3: Consensus
    consensusOrchestrator;
    // Telemetry collector
    metricsCollector;
    // Configuration
    config;
    constructor(config = {}) {
        this.config = {
            agentDbPath: config.agentDbPath || './data/council/council.db',
            consensusThreshold: config.consensusThreshold ?? 0.80,
            maxIterations: config.maxIterations ?? 3,
            agentWeights: {
                PatternMaster: 2.0,
                PromptScientist: 2.0,
                PerformanceJudge: 2.0,
                TransferTester: 1.5,
                SafetyValidator: 1.5,
                ...config.agentWeights
            },
            analysisInterval: config.analysisInterval || '5m',
            defaultRolloutPercentage: config.defaultRolloutPercentage ?? 0.10,
            defaultMonitoringDuration: config.defaultMonitoringDuration || '24h',
            defaultRollbackThreshold: config.defaultRollbackThreshold ?? 0.05
        };
        // Initialize agents
        this.patternMaster = new PatternMaster({
            agentDbPath: this.config.agentDbPath,
            voteWeight: this.config.agentWeights.PatternMaster
        });
        this.promptScientist = new PromptScientist({
            voteWeight: this.config.agentWeights.PromptScientist
        });
        this.performanceJudge = new PerformanceJudge({
            voteWeight: this.config.agentWeights.PerformanceJudge
        });
        this.transferTester = new TransferTester({
            voteWeight: this.config.agentWeights.TransferTester
        });
        this.safetyValidator = new SafetyValidator({
            voteWeight: this.config.agentWeights.SafetyValidator
        });
        this.consensusOrchestrator = new ConsensusOrchestrator({
            consensusThreshold: this.config.consensusThreshold,
            maxIterations: this.config.maxIterations
        });
        // Initialize telemetry collector
        this.metricsCollector = new GlobalMetricsCollector({
            dbPath: this.config.agentDbPath,
            useSupabase: true,
            enableAgentDBCache: true
        });
    }
    /**
     * Hold council meeting: Analyze telemetry and make decisions
     */
    async holdMeeting(telemetry) {
        const meetingId = `council-${Date.now()}`;
        const timestamp = new Date();
        console.log(`\n🏛️  AI Council Meeting ${meetingId}`);
        console.log(`📊 Analyzing ${telemetry.projects.length} project(s)...`);
        // Step 1: Tier 1 Analysis (Parallel)
        console.log('\n🔍 Tier 1: Core Decision Makers');
        const [patternAnalysis, promptAnalysis, performanceAnalysis] = await Promise.all([
            this.runPatternMasterAnalysis(telemetry),
            this.runPromptScientistAnalysis(telemetry),
            this.runPerformanceJudgeAnalysis(telemetry)
        ]);
        // Step 2: Tier 2 Validation (Parallel)
        console.log('\n✅ Tier 2: Validators');
        const [transferTestAnalysis, safetyAnalysis] = await Promise.all([
            this.runTransferTesterAnalysis(telemetry),
            this.runSafetyValidatorAnalysis(telemetry)
        ]);
        // Collect all analyses
        const analyses = [
            patternAnalysis,
            promptAnalysis,
            performanceAnalysis,
            transferTestAnalysis,
            safetyAnalysis
        ];
        // Step 3: Tier 3 Consensus (ReConcile Algorithm)
        console.log('\n⚖️  Tier 3: Consensus Orchestration');
        const consensus = await this.consensusOrchestrator.reachConsensus(analyses);
        console.log(`   Decision: ${consensus.decision}`);
        console.log(`   Confidence: ${(consensus.confidence * 100).toFixed(1)}%`);
        console.log(`   Iterations: ${consensus.iterations}`);
        console.log(`   Breakdown: ✅${consensus.breakdown.approveCount} ❌${consensus.breakdown.rejectCount} ⚪${consensus.breakdown.neutralCount} ⚠️${consensus.breakdown.conditionalCount}`);
        // Step 4: Generate decisions based on consensus
        const decisions = this.generateDecisions(analyses, consensus, telemetry);
        // Step 5: Create execution plan
        const executionPlan = this.createExecutionPlan(decisions);
        // Step 6: Generate summary
        const summary = this.generateSummary(decisions, consensus);
        const result = {
            meetingId,
            timestamp,
            telemetryInput: telemetry,
            analyses,
            decisions,
            consensusResults: [consensus],
            executionPlan,
            summary
        };
        console.log(`\n📋 Meeting Summary:`);
        console.log(`   Total Decisions: ${summary.totalDecisions}`);
        console.log(`   Approved: ${summary.approvedDecisions}`);
        console.log(`   Rejected: ${summary.rejectedDecisions}`);
        console.log(`   Avg Confidence: ${(summary.avgConfidence * 100).toFixed(1)}%`);
        return result;
    }
    /**
     * Run PatternMaster analysis
     */
    async runPatternMasterAnalysis(telemetry) {
        console.log('   🧠 PatternMaster analyzing...');
        const analysis = await this.patternMaster.analyze(telemetry);
        console.log(`      Found ${analysis.patternsFound.length} patterns`);
        console.log(`      Transfer candidates: ${analysis.transferCandidates.length}`);
        console.log(`      Vote: ${analysis.recommendation} (${(analysis.confidence * 100).toFixed(1)}%)`);
        return analysis;
    }
    /**
     * Run PromptScientist analysis
     */
    async runPromptScientistAnalysis(telemetry) {
        console.log('   🔬 PromptScientist analyzing...');
        const analysis = await this.promptScientist.analyze(telemetry);
        console.log(`      Evolved prompts: ${analysis.evolvedPrompts.length}`);
        console.log(`      Deployment candidates: ${analysis.deploymentCandidates.length}`);
        console.log(`      Vote: ${analysis.recommendation} (${(analysis.confidence * 100).toFixed(1)}%)`);
        return analysis;
    }
    /**
     * Run PerformanceJudge analysis
     */
    async runPerformanceJudgeAnalysis(telemetry) {
        console.log('   ⚖️  PerformanceJudge analyzing...');
        const analysis = await this.performanceJudge.analyze(telemetry);
        console.log(`      Drifting experts: ${analysis.driftingExperts.length}`);
        console.log(`      Rotation recommendations: ${analysis.rotationRecommendations.length}`);
        console.log(`      Vote: ${analysis.recommendation} (${(analysis.confidence * 100).toFixed(1)}%)`);
        return analysis;
    }
    /**
     * Run TransferTester analysis
     */
    async runTransferTesterAnalysis(telemetry) {
        console.log('   🔄 TransferTester validating...');
        const analysis = await this.transferTester.analyze(telemetry);
        const passed = analysis.testsCompleted.filter(t => t.passed).length;
        console.log(`      Tests: ${passed}/${analysis.testsCompleted.length} passed`);
        console.log(`      Vote: ${analysis.recommendation} (${(analysis.confidence * 100).toFixed(1)}%)`);
        return analysis;
    }
    /**
     * Run SafetyValidator analysis
     */
    async runSafetyValidatorAnalysis(telemetry) {
        console.log('   🛡️  SafetyValidator checking...');
        const analysis = await this.safetyValidator.analyze(telemetry);
        console.log(`      Safety score: ${(analysis.safetyScore * 100).toFixed(0)}%`);
        console.log(`      Vote: ${analysis.recommendation} (${(analysis.confidence * 100).toFixed(1)}%)`);
        return analysis;
    }
    /**
     * Generate decisions from analyses and consensus
     */
    generateDecisions(analyses, consensus, _telemetry) {
        const decisions = [];
        // Only generate decisions if consensus reached
        if (!consensus.consensusReached) {
            console.log('\n⚠️  Consensus not reached - no decisions made');
            return decisions;
        }
        // Pattern transfer decisions
        const patternAnalysis = analyses.find(a => a.agent === 'PatternMaster');
        if (patternAnalysis && 'transferCandidates' in patternAnalysis) {
            for (const candidate of patternAnalysis.transferCandidates.slice(0, 1)) {
                // Top candidate only
                const decision = {
                    type: 'pattern_transfer',
                    pattern: candidate.pattern,
                    targetProjects: candidate.targetProjects,
                    rollout: {
                        strategy: 'gradual',
                        percentage: this.config.defaultRolloutPercentage,
                        duration: this.config.defaultMonitoringDuration
                    },
                    monitoring: {
                        checkInterval: '1h',
                        successMetric: 'accuracy_improvement > 0.03',
                        rollbackTrigger: `accuracy < baseline - ${this.config.defaultRollbackThreshold}`
                    },
                    consensus,
                    timestamp: new Date()
                };
                decisions.push(decision);
            }
        }
        // Prompt upgrade decisions
        const promptAnalysis = analyses.find(a => a.agent === 'PromptScientist');
        if (promptAnalysis && 'deploymentCandidates' in promptAnalysis) {
            for (const candidate of promptAnalysis.deploymentCandidates.slice(0, 1)) {
                const targetExperts = candidate.targetExperts.map(id => {
                    const [project, expertId] = id.split(':');
                    return {
                        project,
                        expertId,
                        expertType: candidate.prompt.expertType
                    };
                });
                const decision = {
                    type: 'prompt_upgrade',
                    prompt: candidate.prompt,
                    targetExperts,
                    rollout: {
                        strategy: 'ab_test',
                        percentage: 0.2, // 20% for prompt upgrades
                        duration: '48h'
                    },
                    safetyGuards: {
                        rollbackCondition: 'accuracy < baseline - 0.02',
                        monitoringDuration: '48h',
                        requiredConfidence: 0.85
                    },
                    consensus,
                    timestamp: new Date()
                };
                decisions.push(decision);
            }
        }
        // Expert rotation decisions
        const performanceAnalysis = analyses.find(a => a.agent === 'PerformanceJudge');
        if (performanceAnalysis && 'rotationRecommendations' in performanceAnalysis) {
            for (const rec of performanceAnalysis.rotationRecommendations.slice(0, 1)) {
                const decision = {
                    type: 'expert_rotation',
                    action: rec.action,
                    sourceExpert: rec.expert,
                    league: Array.from(performanceAnalysis.leagues.get(rec.expert.expertType) || []),
                    strategy: {
                        type: 'knowledge_transfer',
                        steps: [
                            'Extract top performer prompt and few-shot examples',
                            'Adapt domain-specific terminology',
                            'Deploy to drifting expert',
                            'Monitor for 72 hours',
                            'Promote if successful'
                        ]
                    },
                    monitoringPlan: {
                        duration: '72h',
                        metrics: ['accuracy', 'confidence', 'latency'],
                        successCriteria: {
                            accuracy: 0.85,
                            confidence: 0.80
                        }
                    },
                    consensus,
                    timestamp: new Date()
                };
                decisions.push(decision);
            }
        }
        return decisions;
    }
    /**
     * Create execution plan for decisions
     */
    createExecutionPlan(decisions) {
        return decisions.map(decision => {
            let steps = [];
            let estimatedDuration = '24h';
            switch (decision.type) {
                case 'pattern_transfer':
                    steps = [
                        `Deploy pattern to ${decision.targetProjects.length} project(s) with ${decision.rollout.percentage * 100}% traffic`,
                        'Monitor accuracy, confidence, latency metrics',
                        'Compare against baseline performance',
                        'Increase rollout if metrics improve',
                        'Full deployment or rollback based on results'
                    ];
                    estimatedDuration = decision.rollout.duration;
                    break;
                case 'prompt_upgrade':
                    steps = [
                        `Deploy evolved prompt v${decision.prompt.version} to ${decision.targetExperts.length} expert(s)`,
                        `A/B test with ${decision.rollout.percentage * 100}% traffic`,
                        'Monitor performance vs baseline',
                        'Rollback if accuracy drops',
                        'Full deployment if improvement confirmed'
                    ];
                    estimatedDuration = decision.rollout.duration;
                    break;
                case 'expert_rotation':
                    steps = decision.strategy.steps;
                    estimatedDuration = decision.monitoringPlan.duration;
                    break;
            }
            return {
                decision,
                steps,
                estimatedDuration
            };
        });
    }
    /**
     * Generate meeting summary
     */
    generateSummary(decisions, consensus) {
        const approvedDecisions = decisions.length;
        const rejectedDecisions = consensus.consensusReached ? 0 : 1;
        const topRecommendations = [];
        for (const decision of decisions) {
            switch (decision.type) {
                case 'pattern_transfer':
                    topRecommendations.push(`Transfer "${decision.pattern.name}" from ${decision.pattern.sourceProject} to ${decision.targetProjects.join(', ')}`);
                    break;
                case 'prompt_upgrade':
                    topRecommendations.push(`Upgrade ${decision.prompt.expertType} prompts to v${decision.prompt.version}`);
                    break;
                case 'expert_rotation':
                    topRecommendations.push(`${decision.action} ${decision.sourceExpert.expertId} in ${decision.sourceExpert.project}`);
                    break;
            }
        }
        return {
            totalDecisions: decisions.length,
            approvedDecisions,
            rejectedDecisions,
            avgConfidence: consensus.confidence,
            topRecommendations
        };
    }
    /**
     * Execute council decisions
     */
    async executeDecisions(result) {
        console.log(`\n🚀 Executing ${result.decisions.length} decision(s)...`);
        for (const { decision, steps } of result.executionPlan) {
            console.log(`\n📌 ${decision.type}:`);
            for (let i = 0; i < steps.length; i++) {
                console.log(`   ${i + 1}. ${steps[i]}`);
            }
            // In production, would execute actual deployment logic here
            console.log(`   ⏱️  Estimated duration: ${result.executionPlan.find(p => p.decision === decision)?.estimatedDuration}`);
        }
    }
    /**
     * Close all resources
     */
    close() {
        this.patternMaster.close();
        this.metricsCollector.close();
    }
}
/**
 * Create AI Council
 */
export function createAICouncil(config) {
    return new AICouncil(config);
}
