/**
 * IRIS - Intelligent Reflexive Intelligence System
 *
 * Chief AI Operations orchestrator that monitors all expert agents across projects,
 * detects drift, manages prompt evolution, launches A/B tests, and auto-retrains
 * or rotates underperforming agents.
 *
 * IRIS is the executive function that ties together:
 * - GlobalMetrics (telemetry & drift detection)
 * - PromptRegistry (signature versioning & best-in-class discovery)
 * - ReflexionMonitor (validity tracking & staleness detection)
 * - ConsensusLineageTracker (version impact & rotation recommendations)
 * - PatternDiscovery (cross-domain pattern transfer)
 * - SwarmCoordinator (parallel retraining)
 *
 * @module iris-prime
 * @version 1.0.0
 */
import { randomUUID } from 'crypto';
import { createGlobalMetrics, createPromptRegistry, createReflexionMonitor, createConsensusLineageTracker, createPatternDiscovery, trainExpertsInParallel } from '../index.js';
// Supabase integration for durable persistence
import { logTelemetry, storeExpertSignature, recordSignatureUpgrade, detectDrift, } from '../supabase/index.js';
/**
 * IRIS - AI Operations Orchestrator
 */
export class IrisPrime {
    globalMetrics;
    promptRegistry;
    reflexionMonitor;
    consensusTracker;
    patternDiscovery;
    config;
    projectConfigs = new Map();
    notifiers;
    currentRunId;
    constructor(config = {}) {
        this.config = {
            dbBasePath: config.dbBasePath || './data/iris',
            defaultAutoRetrain: config.defaultAutoRetrain ?? false,
            defaultAutoPromote: config.defaultAutoPromote ?? false,
            scheduleIntervalMs: config.scheduleIntervalMs ?? 24 * 60 * 60 * 1000, // 24 hours
            logPath: config.logPath || './logs',
            notifiers: config.notifiers || []
        };
        // Enable real-time notifications
        this.notifiers = this.config.notifiers;
        this.currentRunId = `iris-${Date.now()}`;
        // Initialize all federated learning components
        this.globalMetrics = createGlobalMetrics({
            dbPath: `${this.config.dbBasePath}/global-metrics.db`,
            driftThreshold: 0.1,
            driftWindow: 7,
            enableAutoRetraining: false // IRIS manages retraining
        });
        this.promptRegistry = createPromptRegistry({
            dbPath: `${this.config.dbBasePath}/prompt-registry.db`,
            minEvaluationsForValidity: 10
        });
        this.reflexionMonitor = createReflexionMonitor({
            dbPath: `${this.config.dbBasePath}/reflexion-monitor.db`,
            validityThreshold: 0.7,
            driftWindow: 14,
            crossProjectEnabled: true
        });
        this.consensusTracker = createConsensusLineageTracker({
            dbPath: `${this.config.dbBasePath}/consensus-lineage.db`,
            minOccurrencesForPattern: 5,
            versionComparisonWindow: 14
        });
        this.patternDiscovery = createPatternDiscovery({
            dbPath: `${this.config.dbBasePath}/pattern-discovery.db`,
            agentDBPath: `${this.config.dbBasePath}/pattern-agentdb.db`,
            similarityThreshold: 0.7,
            minUsageForTransfer: 5
        });
        console.log('🤖 IRIS initialized');
    }
    // ============================================================================
    // Project Configuration
    // ============================================================================
    /**
     * Configure project settings
     */
    configureProject(config) {
        this.projectConfigs.set(config.projectId, config);
        console.log(`✓ Project ${config.projectId} configured`);
    }
    /**
     * Get project config or use defaults
     */
    getProjectConfig(projectId) {
        return (this.projectConfigs.get(projectId) || {
            projectId,
            autoRetrain: this.config.defaultAutoRetrain,
            autoPromote: this.config.defaultAutoPromote,
            retrainingThreshold: 0.1, // 10% drop
            promotionThreshold: 0.1, // 10% improvement
            minEvaluations: 10
        });
    }
    // ============================================================================
    // Event Emission
    // ============================================================================
    /**
     * Emit event to all notifiers
     */
    async emit(event) {
        const fullEvent = { ...event, runId: this.currentRunId, createdAt: new Date() };
        await Promise.allSettled(this.notifiers.map(n => n.send(fullEvent)));
    }
    // ============================================================================
    // Core Evaluation Methods
    // ============================================================================
    /**
     * Evaluate a single project's health
     */
    async evaluateProject(projectId) {
        console.log(`\n📊 Evaluating project: ${projectId}`);
        console.log('─'.repeat(80));
        // 1. Get drift alerts
        const driftAlerts = await this.globalMetrics.getUnacknowledgedAlerts(projectId);
        console.log(`\n1️⃣  Drift Analysis:`);
        console.log(`   Found ${driftAlerts.length} unacknowledged alert(s)`);
        const mappedDriftAlerts = driftAlerts.map(alert => ({
            expertId: alert.expertId,
            severity: alert.severityLevel,
            driftType: alert.driftType,
            percentageChange: alert.percentageChange,
            recommendations: alert.recommendations
        }));
        // 2. Get prompt recommendations
        const projectMetrics = await this.globalMetrics.getProjectMetrics(projectId);
        console.log(`\n2️⃣  Prompt Analysis:`);
        console.log(`   Analyzing ${projectMetrics.length} expert(s)`);
        const promptRecommendations = [];
        for (const metric of projectMetrics) {
            // Check if there's a better version in prompt registry
            const evolution = await this.promptRegistry.getPromptEvolution(metric.expertId, projectId);
            if (evolution.versions.length > 1 && evolution.bestVersion !== metric.version) {
                const bestVersion = evolution.versions.find(v => v.version === evolution.bestVersion);
                const currentVersion = evolution.versions.find(v => v.version === metric.version);
                if (bestVersion && currentVersion) {
                    const improvement = bestVersion.accuracy - currentVersion.accuracy;
                    if (improvement > 0.05) {
                        // 5% improvement available
                        promptRecommendations.push({
                            expertId: metric.expertId,
                            currentVersion: metric.version,
                            recommendedVersion: evolution.bestVersion,
                            expectedImprovement: improvement,
                            reason: `Better version available with ${(improvement * 100).toFixed(1)}% higher accuracy`
                        });
                    }
                }
            }
        }
        console.log(`   Generated ${promptRecommendations.length} recommendation(s)`);
        // 3. Get reflexion status
        const reflexionStats = await this.reflexionMonitor.getStats(projectId);
        console.log(`\n3️⃣  Reflexion Analysis:`);
        console.log(`   Total: ${reflexionStats.totalReflexions}`);
        console.log(`   Stale: ${reflexionStats.staleReflexions}`);
        console.log(`   Avg Validity: ${(reflexionStats.avgValidity * 100).toFixed(1)}%`);
        // Find transferable reflexions
        const reflexions = await this.reflexionMonitor.getProjectReflexions(projectId, false);
        let transferableCount = 0;
        for (const reflexion of reflexions) {
            const comparison = await this.reflexionMonitor.findSimilarReflexions(reflexion.id, 0.7);
            if (comparison.transferPotential > 0.7) {
                transferableCount++;
            }
        }
        // 4. Get rotation recommendations
        const rotationRecommendations = await this.consensusTracker.generateRotationRecommendations(projectId);
        console.log(`\n4️⃣  Consensus Analysis:`);
        console.log(`   Generated ${rotationRecommendations.length} rotation recommendation(s)`);
        // 5. Find transferable patterns
        const projectPatterns = await this.patternDiscovery.getProjectPatterns(projectId);
        const transferablePatterns = projectPatterns
            .filter(p => p.reusable && p.performanceMetrics.successRate > 0.8)
            .map(p => ({
            patternId: p.patternId,
            name: p.name,
            sourceProject: p.project,
            transferPotential: p.performanceMetrics.successRate
        }));
        console.log(`\n5️⃣  Pattern Analysis:`);
        console.log(`   Found ${transferablePatterns.length} transferable pattern(s)`);
        // 6. Calculate overall health
        const healthScore = this.calculateHealthScore({
            driftAlerts: driftAlerts.length,
            staleReflexions: reflexionStats.staleReflexions,
            avgValidity: reflexionStats.avgValidity,
            highPriorityRotations: rotationRecommendations.filter(r => r.priority === 'high').length
        });
        const overallHealth = this.getHealthLevel(healthScore);
        // 7. Generate recommended actions
        const recommendedActions = this.generateRecommendedActions({
            driftAlerts,
            promptRecommendations,
            rotationRecommendations,
            reflexionStats,
            projectConfig: this.getProjectConfig(projectId)
        });
        console.log(`\n📈 Overall Health: ${overallHealth.toUpperCase()} (${healthScore}/100)`);
        console.log(`\n✅ Evaluation complete\n`);
        // 8. Persist to Supabase
        try {
            // Detect drift for each expert and persist to Supabase
            for (const metric of projectMetrics) {
                try {
                    const driftAnalysis = await detectDrift(metric.expertId, metric.version, {
                        recentWindow: 24,
                        thresholdPct: 10
                    });
                    if (driftAnalysis.driftDetected) {
                        console.log(`   📊 Drift detected for ${metric.expertId}: ${driftAnalysis.confidenceDrop.toFixed(1)}% drop`);
                    }
                }
                catch (err) {
                    // Silently skip if Supabase not initialized
                    if (!(err instanceof Error && err.message.includes('not initialized'))) {
                        console.warn(`   ⚠️  Failed to detect drift for ${metric.expertId}:`, err);
                    }
                }
            }
            // Log IRIS evaluation event to telemetry
            await logTelemetry({
                expertId: 'iris-prime',
                version: '1.0.0',
                runId: randomUUID(),
                outcome: 'success',
                metadata: {
                    eventType: 'IRIS_EVALUATE_PROJECT',
                    projectId,
                    healthScore,
                    overallHealth,
                    driftAlertsCount: driftAlerts.length,
                    promptRecommendationsCount: promptRecommendations.length,
                    rotationRecommendationsCount: rotationRecommendations.length,
                    transferablePatternsCount: transferablePatterns.length
                }
            });
        }
        catch (err) {
            // Don't fail evaluation if Supabase logging fails
            if (!(err instanceof Error && err.message.includes('not initialized'))) {
                console.warn('⚠️  Failed to persist evaluation to Supabase:', err);
            }
        }
        // Emit evaluation complete event
        await this.emit({
            project: projectId,
            eventType: 'HEALTH_CHECK',
            severity: overallHealth === 'critical' ? 'critical' :
                driftAlerts.length > 0 ? 'warning' : 'info',
            payload: {
                healthScore,
                overallHealth,
                driftAlertCount: driftAlerts.length,
                criticalAlerts: recommendedActions.filter(a => a.priority === 'critical').length,
                promptRecommendationsCount: promptRecommendations.length,
                rotationRecommendationsCount: rotationRecommendations.length,
                transferablePatternsCount: transferablePatterns.length
            }
        });
        return {
            projectId,
            timestamp: new Date(),
            overallHealth,
            healthScore,
            driftAlerts: mappedDriftAlerts,
            promptRecommendations,
            reflexionStatus: {
                totalReflexions: reflexionStats.totalReflexions,
                staleReflexions: reflexionStats.staleReflexions,
                avgValidity: reflexionStats.avgValidity,
                transferableReflexions: transferableCount
            },
            rotationRecommendations,
            transferablePatterns,
            recommendedActions
        };
    }
    /**
     * Evaluate all projects
     */
    async evaluateAllProjects() {
        console.log('\n🌐 Evaluating all projects...');
        console.log('='.repeat(80));
        // Get all unique projects from metrics
        const allMetrics = await this.globalMetrics.getProjectMetrics(''); // Assumes this returns all
        const projects = new Set(allMetrics.map(m => m.project));
        const projectReports = [];
        let totalDriftAlerts = 0;
        let transferOpportunities = 0;
        for (const projectId of projects) {
            const report = await this.evaluateProject(projectId);
            const criticalAlerts = report.driftAlerts.filter(a => a.severity === 'critical').length;
            projectReports.push({
                projectId,
                health: report.overallHealth,
                score: report.healthScore,
                criticalAlerts
            });
            totalDriftAlerts += report.driftAlerts.length;
            transferOpportunities += report.transferablePatterns.length;
        }
        // Get top performers across all projects
        const topPerformers = [];
        for (const metric of allMetrics.slice(0, 10)) {
            topPerformers.push({
                expertId: metric.expertId,
                project: metric.project,
                accuracy: metric.accuracy
            });
        }
        console.log('\n✅ Cross-project evaluation complete\n');
        return {
            timestamp: new Date(),
            projects: projectReports,
            topPerformers,
            transferOpportunities,
            totalDriftAlerts
        };
    }
    /**
     * Auto-promote better prompts after validation
     */
    async autoPromotePrompts(projectId) {
        console.log(`\n🚀 Auto-promoting prompts for ${projectId}...`);
        const projectConfig = this.getProjectConfig(projectId);
        if (!projectConfig.autoPromote) {
            console.log('   ⚠️  Auto-promotion disabled for this project');
            return [];
        }
        const promoted = [];
        const projectMetrics = await this.globalMetrics.getProjectMetrics(projectId);
        for (const metric of projectMetrics) {
            // Get best signature across all projects
            const best = await this.promptRegistry.getBestAcrossProjects(metric.expertId);
            if (!best)
                continue;
            // Check if it's better than current
            const improvement = best.accuracy - metric.accuracy;
            if (improvement >= projectConfig.promotionThreshold &&
                best.evaluations >= projectConfig.minEvaluations) {
                // TODO: Test in E2B sandbox before promoting
                // const e2bRunner = createE2BRunner({ apiKey: process.env.E2B_API_KEY })
                // const testResult = await e2bRunner.run(...)
                // if (testResult.success) { ... }
                // TODO: Validate via consensus
                // const validationResult = await computeConsensus(...)
                console.log(`   ✓ Promoting ${metric.expertId}:`);
                console.log(`     ${metric.version} → ${best.version}`);
                console.log(`     Expected improvement: +${(improvement * 100).toFixed(1)}%`);
                // Persist to Supabase
                try {
                    // Store promoted signature as active
                    await storeExpertSignature(metric.expertId, best.version, 'Promoted prompt from best-performing version', // Placeholder - actual prompt should be loaded
                    {}, // Placeholder signature - actual signature should be loaded from signatureId
                    {
                        performanceMetrics: {
                            accuracy: best.accuracy,
                            evaluations: best.evaluations,
                            improvement
                        },
                        metadata: {
                            promotedFrom: metric.version,
                            promotedAt: new Date().toISOString(),
                            promotionReason: 'Auto-promotion via IRIS',
                            signatureId: best.signatureId
                        },
                        setActive: true
                    });
                    // Log promotion event
                    await logTelemetry({
                        expertId: metric.expertId,
                        version: best.version,
                        runId: randomUUID(),
                        outcome: 'success',
                        metadata: {
                            eventType: 'IRIS_AUTO_PROMOTE',
                            projectId,
                            fromVersion: metric.version,
                            toVersion: best.version,
                            improvement
                        }
                    });
                }
                catch (err) {
                    if (!(err instanceof Error && err.message.includes('not initialized'))) {
                        console.warn(`   ⚠️  Failed to persist promotion to Supabase:`, err);
                    }
                }
                promoted.push({
                    expertId: metric.expertId,
                    promotedVersion: best.version,
                    previousVersion: metric.version,
                    improvement
                });
            }
        }
        console.log(`\n   Promoted ${promoted.length} expert(s)`);
        return promoted;
    }
    /**
     * Auto-retrain experts showing drift
     */
    async autoRetrainExperts(projectId) {
        console.log(`\n🔄 Auto-retraining experts for ${projectId}...`);
        const projectConfig = this.getProjectConfig(projectId);
        if (!projectConfig.autoRetrain) {
            console.log('   ⚠️  Auto-retraining disabled for this project');
            return [];
        }
        const retrained = [];
        // Get drift alerts that trigger retraining
        const alerts = await this.globalMetrics.getUnacknowledgedAlerts(projectId);
        const retrainingNeeded = alerts.filter(a => a.triggerRetraining && a.severityLevel === 'critical');
        if (retrainingNeeded.length === 0) {
            console.log('   ✓ No experts require retraining');
            return [];
        }
        console.log(`   Found ${retrainingNeeded.length} expert(s) requiring retraining`);
        for (const alert of retrainingNeeded) {
            console.log(`\n   Retraining ${alert.expertId}...`);
            // Load recent training data (stub)
            const trainingData = this.loadRecentTrainingData(projectId, alert.expertId);
            // Create training task
            const task = {
                expertId: alert.expertId,
                expertName: alert.expertId,
                trainingData,
                config: {
                    maxSteps: 100, // More thorough retraining
                    temperature: 0.7,
                    batchSize: 16
                }
            };
            // Train
            const results = await trainExpertsInParallel([task], {
                topology: 'star',
                maxAgents: 1,
                strategy: 'balanced'
            });
            if (results[0].success) {
                const improvement = (results[0].metrics.accuracy || 0) - alert.currentValue;
                console.log(`   ✓ Retraining successful`);
                console.log(`     Accuracy: ${alert.currentValue.toFixed(3)} → ${(results[0].metrics.accuracy || 0).toFixed(3)}`);
                console.log(`     Improvement: ${(improvement * 100).toFixed(1)}%`);
                // Generate new version
                const newVersion = this.incrementVersion(alert.version);
                // Register new signature
                await this.promptRegistry.registerSignature({
                    expertId: alert.expertId,
                    expertRole: alert.expertId, // Would normally get from metadata
                    project: projectId,
                    version: newVersion,
                    prompt: 'Retrained prompt', // Would get actual prompt
                    inputFields: ['data'],
                    outputFields: ['prediction'],
                    deployedAt: new Date()
                });
                // Retire old version
                await this.consensusTracker.retireVersion(alert.expertId, alert.version, projectId, newVersion);
                // Persist to Supabase
                try {
                    // Store new retrained signature
                    await storeExpertSignature(alert.expertId, newVersion, 'Retrained prompt via IRIS auto-retraining', {}, // Placeholder signature - actual signature should be extracted from training results
                    {
                        performanceMetrics: {
                            accuracy: results[0].metrics.accuracy || 0,
                            improvement,
                            previousAccuracy: alert.currentValue
                        },
                        metadata: {
                            retrainedFrom: alert.version,
                            retrainedAt: new Date().toISOString(),
                            retrainReason: alert.driftType,
                            alertId: alert.alertId
                        },
                        setActive: true
                    });
                    // Record the signature upgrade
                    await recordSignatureUpgrade(alert.expertId, alert.version, newVersion, `Auto-retrained due to ${alert.driftType} drift: ${(alert.percentageChange * 100).toFixed(1)}% change detected`, {
                        improvement,
                        previousAccuracy: alert.currentValue,
                        newAccuracy: results[0].metrics.accuracy || 0,
                        driftType: alert.driftType,
                        percentageChange: alert.percentageChange
                    });
                    // Log retraining event
                    await logTelemetry({
                        expertId: alert.expertId,
                        version: newVersion,
                        runId: randomUUID(),
                        outcome: 'success',
                        metadata: {
                            eventType: 'IRIS_AUTO_RETRAIN',
                            projectId,
                            fromVersion: alert.version,
                            toVersion: newVersion,
                            improvement,
                            driftType: alert.driftType
                        }
                    });
                }
                catch (err) {
                    if (!(err instanceof Error && err.message.includes('not initialized'))) {
                        console.warn(`   ⚠️  Failed to persist retraining to Supabase:`, err);
                    }
                }
                // Emit retraining completed event
                await this.emit({
                    project: projectId,
                    eventType: 'RETRAINING_COMPLETED',
                    severity: 'info',
                    payload: {
                        expertId: alert.expertId,
                        oldVersion: alert.version,
                        newVersion,
                        improvement,
                        driftType: alert.driftType,
                        percentageChange: alert.percentageChange
                    }
                });
                retrained.push({
                    expertId: alert.expertId,
                    oldVersion: alert.version,
                    newVersion,
                    improvement
                });
                // Acknowledge alert
                await this.globalMetrics.acknowledgeAlert(alert.alertId);
            }
            else {
                console.log(`   ✗ Retraining failed: ${results[0].error}`);
            }
        }
        console.log(`\n   Retrained ${retrained.length} expert(s)`);
        return retrained;
    }
    /**
     * Find reusable reflexions across projects
     */
    async findReusableReflexions(projectId) {
        console.log(`\n🧠 Finding reusable reflexions for ${projectId}...`);
        const reflexions = await this.reflexionMonitor.getProjectReflexions(projectId, false);
        const reusable = [];
        for (const reflexion of reflexions) {
            const comparison = await this.reflexionMonitor.findSimilarReflexions(reflexion.id, 0.7);
            for (const similar of comparison.similarReflexions) {
                if (similar.reusable && similar.project !== projectId) {
                    reusable.push({
                        reflexionId: similar.id,
                        sourceProject: similar.project,
                        targetProject: projectId,
                        transferPotential: comparison.transferPotential,
                        adaptationRequired: similar.validityScore > 0.9 ? 'minimal' : 'moderate'
                    });
                }
            }
        }
        console.log(`   Found ${reusable.length} reusable reflexion(s)`);
        return reusable;
    }
    /**
     * Find transferable patterns from other projects
     */
    async findTransferablePatterns(projectId, context) {
        console.log(`\n🔍 Finding transferable patterns for ${projectId}...`);
        const matches = await this.patternDiscovery.findSimilarPatterns(context, 0.7);
        // Filter out patterns from same project
        const crossProjectMatches = matches.filter(m => m.pattern.project !== projectId);
        console.log(`   Found ${crossProjectMatches.length} transferable pattern(s):`);
        crossProjectMatches.forEach((match, i) => {
            console.log(`   ${i + 1}. ${match.pattern.name} (from ${match.pattern.project})`);
            console.log(`      Transfer potential: ${(match.transferPotential * 100).toFixed(1)}%`);
            console.log(`      Adaptation: ${match.adaptationRequired}`);
        });
        // Emit pattern discovery event if patterns found
        if (crossProjectMatches.length > 0) {
            await this.emit({
                project: projectId,
                eventType: 'PATTERN_DISCOVERY',
                severity: 'info',
                payload: {
                    patternCount: crossProjectMatches.length,
                    topPattern: crossProjectMatches[0]?.pattern.name,
                    topPatternSource: crossProjectMatches[0]?.pattern.project,
                    topTransferPotential: crossProjectMatches[0]?.transferPotential,
                    patterns: crossProjectMatches.map(m => ({
                        name: m.pattern.name,
                        sourceProject: m.pattern.project,
                        transferPotential: m.transferPotential,
                        adaptationRequired: m.adaptationRequired
                    }))
                }
            });
        }
        return crossProjectMatches;
    }
    /**
     * Generate rotation report for experts
     */
    async generateRotationReport(projectId) {
        console.log(`\n🔄 Generating rotation report for ${projectId}...`);
        const recommendations = await this.consensusTracker.generateRotationRecommendations(projectId);
        const summary = {
            keep: recommendations.filter(r => r.recommendedAction === 'keep').length,
            update: recommendations.filter(r => r.recommendedAction === 'update').length,
            replace: recommendations.filter(r => r.recommendedAction === 'replace').length,
            addToEnsemble: recommendations.filter(r => r.recommendedAction === 'add_to_ensemble')
                .length
        };
        console.log(`   Summary:`);
        console.log(`   - Keep: ${summary.keep}`);
        console.log(`   - Update: ${summary.update}`);
        console.log(`   - Replace: ${summary.replace}`);
        console.log(`   - Add to ensemble: ${summary.addToEnsemble}`);
        return { recommendations, summary };
    }
    // ============================================================================
    // Health Calculation
    // ============================================================================
    /**
     * Calculate health score (0-100)
     */
    calculateHealthScore(factors) {
        let score = 100;
        // Deduct for drift alerts
        score -= factors.driftAlerts * 10;
        // Deduct for stale reflexions
        score -= factors.staleReflexions * 5;
        // Deduct for low reflexion validity
        score -= (1 - factors.avgValidity) * 20;
        // Deduct for high-priority rotations
        score -= factors.highPriorityRotations * 8;
        return Math.max(0, Math.min(100, score));
    }
    /**
     * Get health level from score
     */
    getHealthLevel(score) {
        if (score >= 90)
            return 'excellent';
        if (score >= 75)
            return 'good';
        if (score >= 60)
            return 'fair';
        if (score >= 40)
            return 'poor';
        return 'critical';
    }
    /**
     * Generate recommended actions
     */
    generateRecommendedActions(params) {
        const actions = [];
        // Critical drift alerts
        const criticalAlerts = params.driftAlerts.filter(a => a.severityLevel === 'critical');
        for (const alert of criticalAlerts) {
            actions.push({
                priority: 'critical',
                action: `Retrain ${alert.expertId}`,
                reason: `${alert.driftType} drift: ${(alert.percentageChange * 100).toFixed(1)}% change`,
                impact: 'Restore expert performance to baseline'
            });
        }
        // High-priority rotations
        const highPriorityRotations = params.rotationRecommendations.filter(r => r.priority === 'high');
        for (const rotation of highPriorityRotations) {
            actions.push({
                priority: 'high',
                action: `${rotation.recommendedAction} ${rotation.expertId}`,
                reason: rotation.reason,
                impact: 'Improve consensus quality'
            });
        }
        // Prompt upgrades
        for (const rec of params.promptRecommendations) {
            actions.push({
                priority: 'medium',
                action: `Upgrade ${rec.expertId} to ${rec.recommendedVersion}`,
                reason: rec.reason,
                impact: `Expected improvement: +${(rec.expectedImprovement * 100).toFixed(1)}%`
            });
        }
        // Stale reflexions
        if (params.reflexionStats.staleReflexions > 5) {
            actions.push({
                priority: 'medium',
                action: 'Review stale reflexions',
                reason: `${params.reflexionStats.staleReflexions} reflexions marked as stale`,
                impact: 'Update or remove outdated self-improvement strategies'
            });
        }
        // Low validity
        if (params.reflexionStats.avgValidity < 0.7) {
            actions.push({
                priority: 'high',
                action: 'Audit reflexion quality',
                reason: `Average validity: ${(params.reflexionStats.avgValidity * 100).toFixed(1)}%`,
                impact: 'Improve self-improvement effectiveness'
            });
        }
        return actions.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }
    // ============================================================================
    // Utilities
    // ============================================================================
    /**
     * Load recent training data (stub)
     */
    loadRecentTrainingData(projectId, expertId) {
        // TODO: Implement actual data loading from project-specific sources
        console.log(`   [STUB] Loading training data for ${projectId}/${expertId}`);
        return [
            {
                inputs: { data: 'sample input 1' },
                outputs: { prediction: 'sample output 1' }
            },
            {
                inputs: { data: 'sample input 2' },
                outputs: { prediction: 'sample output 2' }
            }
        ];
    }
    /**
     * Increment version string
     */
    incrementVersion(version) {
        const match = version.match(/v(\d+)\.(\d+)\.(\d+)/);
        if (!match)
            return 'v1.0.0';
        const [, major, minor, patch] = match;
        return `v${major}.${minor}.${parseInt(patch) + 1}`;
    }
    /**
     * Close all connections
     */
    close() {
        this.globalMetrics.close();
        this.promptRegistry.close();
        this.reflexionMonitor.close();
        this.consensusTracker.close();
        this.patternDiscovery.close();
        console.log('🔒 IRIS shutdown complete');
    }
}
/**
 * Create IRIS instance
 */
export function createIrisPrime(config) {
    return new IrisPrime(config);
}
// ============================================================================
// Convenience API
// ============================================================================
/**
 * Main IRIS API
 */
export const irisPrime = {
    /**
     * Evaluate a single project
     */
    async evaluateProject(projectId) {
        const iris = createIrisPrime();
        try {
            return await iris.evaluateProject(projectId);
        }
        finally {
            iris.close();
        }
    },
    /**
     * Evaluate all projects
     */
    async evaluateAllProjects() {
        const iris = createIrisPrime();
        try {
            return await iris.evaluateAllProjects();
        }
        finally {
            iris.close();
        }
    },
    /**
     * Auto-promote better prompts
     */
    async autoPromotePrompts(projectId) {
        const iris = createIrisPrime();
        try {
            return await iris.autoPromotePrompts(projectId);
        }
        finally {
            iris.close();
        }
    },
    /**
     * Auto-retrain drifting experts
     */
    async autoRetrainExperts(projectId) {
        const iris = createIrisPrime();
        iris.configureProject({
            projectId,
            autoRetrain: true,
            autoPromote: false,
            retrainingThreshold: 0.1,
            promotionThreshold: 0.1,
            minEvaluations: 10
        });
        try {
            return await iris.autoRetrainExperts(projectId);
        }
        finally {
            iris.close();
        }
    },
    /**
     * Find reusable reflexions
     */
    async findReusableReflexions(projectId) {
        const iris = createIrisPrime();
        try {
            return await iris.findReusableReflexions(projectId);
        }
        finally {
            iris.close();
        }
    },
    /**
     * Find transferable patterns
     */
    async findTransferablePatterns(projectId, context) {
        const iris = createIrisPrime();
        try {
            return await iris.findTransferablePatterns(projectId, context);
        }
        finally {
            iris.close();
        }
    },
    /**
     * Generate rotation report
     */
    async generateRotationReport(projectId) {
        const iris = createIrisPrime();
        try {
            return await iris.generateRotationReport(projectId);
        }
        finally {
            iris.close();
        }
    }
};
