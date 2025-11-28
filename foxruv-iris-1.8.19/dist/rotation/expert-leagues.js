/**
 * Expert League and Rotation Management System
 *
 * Performance-based expert leagues across projects with automated rotation,
 * promotion/demotion, and strategy transfer from top performers to struggling experts.
 *
 * Features:
 * - Cross-project league tables by expert type
 * - Performance ranking (accuracy, confidence, contribution)
 * - Drift detection and alerts
 * - Automated rotation recommendations
 * - Strategy extraction and transfer
 * - Promotion/demotion history tracking
 */
export class ExpertLeagueManager {
    agentDB;
    metricsCollector;
    leagueConfigs;
    constructor(agentDB, metricsCollector) {
        this.agentDB = agentDB;
        this.metricsCollector = metricsCollector;
        this.leagueConfigs = new Map();
        this.initializeDefaultLeagues();
    }
    async getValue(key) {
        return this.agentDB.getKeyValue(key);
    }
    async setValue(key, value) {
        await this.agentDB.setKeyValue(key, value);
    }
    /**
     * Initialize default league configurations
     */
    initializeDefaultLeagues() {
        const defaultConfigs = [
            {
                expertType: 'analyst',
                minimumContributions: 50,
                driftThreshold: 0.15, // 15% accuracy drop triggers alert
                promotionThreshold: 0.2, // Top 20%
                demotionThreshold: 0.2, // Bottom 20%
                rotationInterval: 24, // Check daily
            },
            {
                expertType: 'predictor',
                minimumContributions: 100,
                driftThreshold: 0.10,
                promotionThreshold: 0.15,
                demotionThreshold: 0.25,
                rotationInterval: 12,
            },
            {
                expertType: 'coordinator',
                minimumContributions: 30,
                driftThreshold: 0.20,
                promotionThreshold: 0.25,
                demotionThreshold: 0.20,
                rotationInterval: 48,
            },
            {
                expertType: 'optimizer',
                minimumContributions: 40,
                driftThreshold: 0.12,
                promotionThreshold: 0.20,
                demotionThreshold: 0.20,
                rotationInterval: 24,
            },
        ];
        defaultConfigs.forEach(config => {
            this.leagueConfigs.set(config.expertType, config);
        });
    }
    /**
     * Calculate league tables for all expert types
     */
    async calculateLeagueTables() {
        const leagues = new Map();
        // Get all experts grouped by type
        const expertsByType = await this.getExpertsByType();
        for (const [expertType, experts] of expertsByType.entries()) {
            const leagueTable = await this.calculateLeagueForType(expertType, experts);
            leagues.set(expertType, leagueTable);
        }
        // Store league tables in AgentDB
        await this.storeLeagueTables(leagues);
        return leagues;
    }
    /**
     * Get all experts grouped by type
     */
    async getExpertsByType() {
        const expertsByType = new Map();
        // Query metrics collector for all expert performances
        const allExperts = await this.metricsCollector.getExpertPerformances();
        allExperts.forEach((expert) => {
            if (!expertsByType.has(expert.expertType)) {
                expertsByType.set(expert.expertType, []);
            }
            expertsByType.get(expert.expertType).push(expert);
        });
        return expertsByType;
    }
    /**
     * Calculate league table for specific expert type
     */
    async calculateLeagueForType(expertType, experts) {
        const config = this.leagueConfigs.get(expertType) || this.getDefaultConfig();
        // Filter experts with minimum contributions
        const qualifiedExperts = experts.filter(e => e.contributionCount >= config.minimumContributions);
        // Calculate composite scores
        const scoredExperts = qualifiedExperts.map(expert => ({
            expert,
            score: this.calculateCompositeScore(expert),
        }));
        // Sort by score descending
        scoredExperts.sort((a, b) => b.score - a.score);
        // Create league entries with ranks and status
        const leagueEntries = scoredExperts.map((item, index) => {
            const rank = index + 1;
            const percentile = rank / scoredExperts.length;
            return {
                rank,
                expertId: item.expert.expertId,
                projectId: item.expert.projectId,
                score: item.score,
                accuracy: item.expert.accuracy,
                confidence: item.expert.confidence,
                contributionCount: item.expert.contributionCount,
                trend: item.expert.trend,
                status: this.determineStatus(percentile, item.expert.trend, config),
            };
        });
        return leagueEntries;
    }
    /**
     * Calculate composite performance score
     * Weighted combination of accuracy, confidence, and contribution
     */
    calculateCompositeScore(expert) {
        const weights = {
            accuracy: 0.50,
            recentAccuracy: 0.25,
            confidence: 0.15,
            contribution: 0.10,
        };
        // Normalize contribution count (log scale to prevent domination)
        const normalizedContribution = Math.log10(expert.contributionCount + 1) / 3;
        // Apply trend modifier
        const trendModifier = {
            'improving': 1.05,
            'stable': 1.0,
            'declining': 0.95,
            'drifting': 0.85,
        }[expert.trend];
        const baseScore = expert.accuracy * weights.accuracy +
            expert.recentAccuracy * weights.recentAccuracy +
            expert.confidence * weights.confidence +
            Math.min(normalizedContribution, 1.0) * weights.contribution;
        return baseScore * trendModifier;
    }
    /**
     * Determine expert status based on rank percentile and trend
     */
    determineStatus(percentile, trend, config) {
        if (trend === 'drifting') {
            return 'critical';
        }
        if (percentile <= config.promotionThreshold) {
            return 'champion';
        }
        if (percentile <= 0.4) {
            return 'performer';
        }
        if (percentile <= (1 - config.demotionThreshold)) {
            return 'average';
        }
        if (trend === 'declining') {
            return 'critical';
        }
        return 'struggling';
    }
    /**
     * Identify drifting experts across all leagues
     */
    async identifyDriftingExperts() {
        const leagues = await this.calculateLeagueTables();
        const driftingExperts = [];
        for (const [expertType, leagueTable] of leagues.entries()) {
            const config = this.leagueConfigs.get(expertType) || this.getDefaultConfig();
            for (const entry of leagueTable) {
                // Get full expert performance data
                const expert = await this.getExpertPerformance(entry.expertId, entry.projectId);
                if (!expert)
                    continue;
                // Calculate drift magnitude
                const driftMagnitude = expert.accuracy - expert.recentAccuracy;
                if (driftMagnitude >= config.driftThreshold || expert.trend === 'drifting') {
                    driftingExperts.push({
                        expert,
                        leagueEntry: entry,
                        driftMagnitude,
                    });
                }
            }
        }
        // Sort by drift magnitude descending (worst first)
        driftingExperts.sort((a, b) => b.driftMagnitude - a.driftMagnitude);
        return driftingExperts;
    }
    /**
     * Generate rotation recommendations
     */
    async generateRotationRecommendations() {
        const recommendations = [];
        const leagues = await this.calculateLeagueTables();
        const driftingExperts = await this.identifyDriftingExperts();
        // Handle drifting/struggling experts
        for (const { expert, leagueEntry, driftMagnitude } of driftingExperts) {
            const leagueTable = leagues.get(expert.expertType);
            if (!leagueTable)
                continue;
            // Find top performer in same league (mentor)
            const champion = leagueTable.find(e => e.status === 'champion');
            if (!champion)
                continue;
            // Don't recommend rotation if already in progress
            const existingRotation = await this.hasActiveRotation(expert.expertId);
            if (existingRotation)
                continue;
            const recommendation = await this.createRotationRecommendation(expert, leagueEntry, champion, driftMagnitude);
            recommendations.push(recommendation);
        }
        // Store recommendations
        await this.storeRotationRecommendations(recommendations);
        return recommendations;
    }
    /**
     * Create rotation recommendation
     */
    async createRotationRecommendation(targetExpert, targetEntry, championEntry, driftMagnitude) {
        // Get champion's performance data
        const championExpert = await this.getExpertPerformance(championEntry.expertId, championEntry.projectId);
        if (!championExpert) {
            throw new Error(`Champion expert not found: ${championEntry.expertId}`);
        }
        // Determine rotation strategy based on drift severity
        const strategy = await this.determineRotationStrategy(targetExpert, championExpert, driftMagnitude);
        // Estimate impact
        const estimatedImpact = this.estimateRotationImpact(targetExpert, championExpert, strategy);
        // Determine priority
        const priority = this.determineRotationPriority(targetEntry.status, driftMagnitude);
        return {
            id: `rotation-${Date.now()}-${targetExpert.expertId}`,
            targetExpertId: targetExpert.expertId,
            targetProjectId: targetExpert.projectId,
            mentorExpertId: championExpert.expertId,
            mentorProjectId: championExpert.projectId,
            reason: this.generateRotationReason(targetExpert, championExpert, driftMagnitude),
            priority,
            strategy,
            estimatedImpact,
            createdAt: new Date(),
            status: 'pending',
            monitoringPeriod: 48, // Monitor for 48 hours after rotation
        };
    }
    /**
     * Determine rotation strategy based on drift severity
     */
    async determineRotationStrategy(targetExpert, mentorExpert, driftMagnitude) {
        // Critical drift requires full retrain
        if (driftMagnitude > 0.25 || targetExpert.trend === 'drifting') {
            return {
                type: 'full_retrain',
                retrainingSamples: 200,
                monitoringMetrics: ['accuracy', 'confidence', 'trend'],
            };
        }
        // Moderate drift uses hybrid approach
        if (driftMagnitude > 0.15) {
            const mentorStrategy = await this.extractMentorStrategy(mentorExpert);
            return {
                type: 'hybrid',
                extractedPrompt: mentorStrategy.prompt,
                fewShotExamples: mentorStrategy.examples,
                retrainingSamples: 100,
                monitoringMetrics: ['accuracy', 'recent_accuracy', 'confidence'],
            };
        }
        // Minor drift uses prompt and few-shot transfer
        const mentorStrategy = await this.extractMentorStrategy(mentorExpert);
        return {
            type: 'few_shot_transfer',
            extractedPrompt: mentorStrategy.prompt,
            fewShotExamples: mentorStrategy.examples,
            monitoringMetrics: ['accuracy', 'recent_accuracy'],
        };
    }
    /**
     * Extract mentor's successful strategy
     */
    async extractMentorStrategy(mentorExpert) {
        // Query AgentDB for mentor's configuration and successful examples
        const mentorConfig = await this.getValue(`expert_configs.${mentorExpert.projectId}.${mentorExpert.expertId}`);
        const successfulRuns = await this.getValue(`expert_runs.${mentorExpert.projectId}.${mentorExpert.expertId}.successful`);
        // Extract prompt from configuration
        const prompt = mentorConfig?.systemPrompt || mentorConfig?.prompt || '';
        // Convert successful runs to few-shot examples
        const examples = successfulRuns.map((run) => ({
            input: run.input || run.query || '',
            output: run.output || run.result || '',
            context: run.context || {},
        }));
        return { prompt, examples };
    }
    /**
     * Estimate rotation impact (expected accuracy improvement)
     */
    estimateRotationImpact(targetExpert, mentorExpert, strategy) {
        // Base impact is difference between mentor and target
        const accuracyGap = mentorExpert.accuracy - targetExpert.accuracy;
        // Adjust by strategy effectiveness
        const strategyMultiplier = {
            'prompt_transfer': 0.3,
            'few_shot_transfer': 0.5,
            'full_retrain': 0.7,
            'hybrid': 0.6,
        }[strategy.type];
        // Conservative estimate: achieve 30-70% of gap closure
        return accuracyGap * strategyMultiplier;
    }
    /**
     * Determine rotation priority
     */
    determineRotationPriority(status, driftMagnitude) {
        if (status === 'critical' || driftMagnitude > 0.25) {
            return 'critical';
        }
        if (status === 'struggling' || driftMagnitude > 0.15) {
            return 'high';
        }
        if (driftMagnitude > 0.10) {
            return 'medium';
        }
        return 'low';
    }
    /**
     * Generate human-readable rotation reason
     */
    generateRotationReason(targetExpert, mentorExpert, driftMagnitude) {
        const reasons = [];
        if (driftMagnitude > 0.20) {
            reasons.push(`Critical accuracy drift detected (${(driftMagnitude * 100).toFixed(1)}% drop)`);
        }
        else if (driftMagnitude > 0.10) {
            reasons.push(`Significant accuracy decline (${(driftMagnitude * 100).toFixed(1)}% drop)`);
        }
        if (targetExpert.trend === 'drifting') {
            reasons.push('Expert showing drift pattern');
        }
        else if (targetExpert.trend === 'declining') {
            reasons.push('Declining performance trend');
        }
        reasons.push(`Learn from ${mentorExpert.expertId} (${(mentorExpert.accuracy * 100).toFixed(1)}% accuracy)`);
        return reasons.join('. ');
    }
    /**
     * Execute approved rotation
     */
    async executeRotation(rotationId) {
        // Get rotation recommendation
        const rotation = await this.getRotationRecommendation(rotationId);
        if (!rotation) {
            throw new Error(`Rotation not found: ${rotationId}`);
        }
        if (rotation.status !== 'approved') {
            throw new Error(`Rotation not approved: ${rotationId}`);
        }
        const appliedChanges = [];
        try {
            // Update rotation status
            rotation.status = 'in_progress';
            await this.updateRotationStatus(rotation);
            // Apply rotation strategy
            switch (rotation.strategy.type) {
                case 'prompt_transfer':
                    await this.applyPromptTransfer(rotation);
                    appliedChanges.push('Prompt updated');
                    break;
                case 'few_shot_transfer':
                    await this.applyFewShotTransfer(rotation);
                    appliedChanges.push('Prompt updated', 'Few-shot examples added');
                    break;
                case 'full_retrain':
                    await this.triggerFullRetrain(rotation);
                    appliedChanges.push('Full retraining initiated');
                    break;
                case 'hybrid':
                    await this.applyPromptTransfer(rotation);
                    await this.applyFewShotTransfer(rotation);
                    await this.triggerPartialRetrain(rotation);
                    appliedChanges.push('Prompt updated', 'Few-shot examples added', 'Partial retraining initiated');
                    break;
            }
            // Start monitoring period
            const monitoringStarted = await this.startRotationMonitoring(rotation);
            // Record in history
            await this.recordRotationExecution(rotation);
            // Update status to completed (will be verified after monitoring)
            rotation.status = 'completed';
            await this.updateRotationStatus(rotation);
            return {
                success: true,
                rotation,
                appliedChanges,
                monitoringStarted,
            };
        }
        catch (error) {
            rotation.status = 'rejected';
            await this.updateRotationStatus(rotation);
            throw error;
        }
    }
    /**
     * Apply prompt transfer
     */
    async applyPromptTransfer(rotation) {
        if (!rotation.strategy.extractedPrompt) {
            throw new Error('No prompt to transfer');
        }
        // Update target expert's configuration
        await this.setValue(`expert_configs.${rotation.targetProjectId}.${rotation.targetExpertId}.systemPrompt`, rotation.strategy.extractedPrompt);
        // Store backup of old prompt
        const oldPrompt = await this.getValue(`expert_configs.${rotation.targetProjectId}.${rotation.targetExpertId}.systemPrompt`);
        await this.setValue(`expert_configs.${rotation.targetProjectId}.${rotation.targetExpertId}.backup.prompt`, oldPrompt);
    }
    /**
     * Apply few-shot transfer
     */
    async applyFewShotTransfer(rotation) {
        if (!rotation.strategy.fewShotExamples || rotation.strategy.fewShotExamples.length === 0) {
            throw new Error('No few-shot examples to transfer');
        }
        // Update target expert's few-shot examples
        await this.setValue(`expert_configs.${rotation.targetProjectId}.${rotation.targetExpertId}.fewShotExamples`, rotation.strategy.fewShotExamples);
        // Optionally update prompt if provided
        if (rotation.strategy.extractedPrompt) {
            await this.applyPromptTransfer(rotation);
        }
    }
    /**
     * Trigger full retrain
     */
    async triggerFullRetrain(rotation) {
        // Queue retraining job
        await this.setValue(`retraining_queue.${rotation.targetProjectId}.${rotation.targetExpertId}`, {
            rotationId: rotation.id,
            sampleCount: rotation.strategy.retrainingSamples || 200,
            priority: rotation.priority,
            queuedAt: new Date(),
        });
    }
    /**
     * Trigger partial retrain
     */
    async triggerPartialRetrain(rotation) {
        // Queue partial retraining job (hybrid approach)
        await this.setValue(`retraining_queue.${rotation.targetProjectId}.${rotation.targetExpertId}`, {
            rotationId: rotation.id,
            sampleCount: rotation.strategy.retrainingSamples || 100,
            priority: rotation.priority,
            type: 'partial',
            queuedAt: new Date(),
        });
    }
    /**
     * Start rotation monitoring
     */
    async startRotationMonitoring(rotation) {
        const monitoringConfig = {
            rotationId: rotation.id,
            expertId: rotation.targetExpertId,
            projectId: rotation.targetProjectId,
            startTime: new Date(),
            endTime: new Date(Date.now() + rotation.monitoringPeriod * 60 * 60 * 1000),
            metrics: rotation.strategy.monitoringMetrics,
            baselineAccuracy: await this.getCurrentAccuracy(rotation.targetExpertId, rotation.targetProjectId),
            expectedImprovement: rotation.estimatedImpact,
        };
        await this.setValue(`rotation_monitoring.${rotation.id}`, monitoringConfig);
        return true;
    }
    /**
     * Get rotation monitoring results
     */
    async getRotationMonitoringResults(rotationId) {
        const rotation = await this.getRotationRecommendation(rotationId);
        if (!rotation) {
            throw new Error(`Rotation not found: ${rotationId}`);
        }
        const monitoringConfig = await this.getValue(`rotation_monitoring.${rotationId}`);
        if (!monitoringConfig) {
            throw new Error(`Monitoring not found for rotation: ${rotationId}`);
        }
        const currentAccuracy = await this.getCurrentAccuracy(rotation.targetExpertId, rotation.targetProjectId);
        const improvement = currentAccuracy - monitoringConfig.baselineAccuracy;
        const success = improvement >= (monitoringConfig.expectedImprovement * 0.5); // 50% of expected
        return {
            rotation,
            monitoring: {
                startTime: monitoringConfig.startTime,
                endTime: monitoringConfig.endTime,
                currentAccuracy,
                baselineAccuracy: monitoringConfig.baselineAccuracy,
                improvement,
                expectedImprovement: monitoringConfig.expectedImprovement,
                success,
                metrics: await this.getMonitoringMetrics(rotation, monitoringConfig),
            },
        };
    }
    /**
     * Get current monitoring metrics
     */
    async getMonitoringMetrics(rotation, monitoringConfig) {
        const metrics = {};
        for (const metric of monitoringConfig.metrics) {
            const value = await this.metricsCollector.getMetric(rotation.targetProjectId, rotation.targetExpertId, metric);
            metrics[metric] = value;
        }
        return metrics;
    }
    /**
     * Track promotion/demotion history
     */
    async recordRankingChange(expertId, projectId, previousRank, newRank, previousStatus, newStatus, trigger, notes) {
        const historyEntry = {
            expertId,
            projectId,
            timestamp: new Date(),
            previousRank,
            newRank,
            previousStatus,
            newStatus,
            trigger,
            notes,
        };
        await this.setValue(`ranking_history.${projectId}.${expertId}.${Date.now()}`, historyEntry);
    }
    /**
     * Get promotion/demotion history for expert
     */
    async getRankingHistory(expertId, projectId) {
        const history = await this.getValue(`ranking_history.${projectId}.${expertId}`);
        if (!history)
            return [];
        const entries = Object.values(history);
        return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    /**
     * Generate league report
     */
    async generateLeagueReport(expertType) {
        const leagues = await this.calculateLeagueTables();
        const report = [];
        report.push('='.repeat(80));
        report.push('EXPERT LEAGUE TABLES');
        report.push('='.repeat(80));
        report.push('');
        const typesToReport = expertType
            ? [expertType]
            : Array.from(leagues.keys());
        for (const type of typesToReport) {
            const leagueTable = leagues.get(type);
            if (!leagueTable)
                continue;
            report.push(`${type.toUpperCase()} LEAGUE`);
            report.push('-'.repeat(80));
            report.push(`${'Rank'.padEnd(6)} ${'Expert@Project'.padEnd(35)} ${'Score'.padEnd(8)} ${'Acc'.padEnd(8)} ${'Conf'.padEnd(8)} ${'Runs'.padEnd(8)} ${'Status'.padEnd(12)}`);
            report.push('-'.repeat(80));
            for (const entry of leagueTable.slice(0, 20)) { // Top 20
                const expertLabel = `${entry.expertId}@${entry.projectId}`.substring(0, 35);
                const statusEmoji = {
                    'champion': '🏆',
                    'performer': '⭐',
                    'average': '➖',
                    'struggling': '⚠️',
                    'critical': '🚨',
                }[entry.status];
                report.push(`${String(entry.rank).padEnd(6)} ${expertLabel.padEnd(35)} ` +
                    `${entry.score.toFixed(3).padEnd(8)} ` +
                    `${(entry.accuracy * 100).toFixed(1).padEnd(8)} ` +
                    `${(entry.confidence * 100).toFixed(1).padEnd(8)} ` +
                    `${String(entry.contributionCount).padEnd(8)} ` +
                    `${statusEmoji} ${entry.status.padEnd(10)}`);
            }
            report.push('');
        }
        return report.join('\n');
    }
    // Helper methods
    getDefaultConfig() {
        return {
            expertType: 'unknown',
            minimumContributions: 50,
            driftThreshold: 0.15,
            promotionThreshold: 0.2,
            demotionThreshold: 0.2,
            rotationInterval: 24,
        };
    }
    async getExpertPerformance(expertId, projectId) {
        const performance = await this.getValue(`expert_performance.${projectId}.${expertId}`);
        return performance || null;
    }
    async getCurrentAccuracy(expertId, projectId) {
        const performance = await this.getExpertPerformance(expertId, projectId);
        return performance?.recentAccuracy || performance?.accuracy || 0;
    }
    async hasActiveRotation(expertId) {
        const rotations = await this.getValue('rotation_recommendations');
        if (!rotations)
            return false;
        return Object.values(rotations).some((r) => r.targetExpertId === expertId && r.status === 'in_progress');
    }
    async getRotationRecommendation(rotationId) {
        const rotation = await this.getValue(`rotation_recommendations.${rotationId}`);
        return rotation || null;
    }
    async storeLeagueTables(leagues) {
        for (const [type, table] of leagues.entries()) {
            await this.setValue(`league_tables.${type}`, {
                updatedAt: new Date(),
                entries: table,
            });
        }
    }
    async storeRotationRecommendations(recommendations) {
        for (const recommendation of recommendations) {
            await this.setValue(`rotation_recommendations.${recommendation.id}`, recommendation);
        }
    }
    async updateRotationStatus(rotation) {
        await this.setValue(`rotation_recommendations.${rotation.id}`, rotation);
    }
    async recordRotationExecution(rotation) {
        await this.setValue(`rotation_history.${rotation.targetProjectId}.${rotation.targetExpertId}.${Date.now()}`, {
            rotationId: rotation.id,
            mentorExpertId: rotation.mentorExpertId,
            mentorProjectId: rotation.mentorProjectId,
            strategy: rotation.strategy.type,
            executedAt: new Date(),
            estimatedImpact: rotation.estimatedImpact,
        });
    }
}
/**
 * Example usage and rotation scenarios
 */
export const ROTATION_EXAMPLES = {
    /**
     * Example 1: Critical drift detected
     */
    criticalDrift: {
        scenario: 'MarketAnalyst@nfl showing 25% accuracy drop',
        league: {
            type: 'analyst',
            entries: [
                { rank: 1, expert: 'TheAnalyst@nfl', accuracy: 0.95, runs: 500, status: 'champion' },
                { rank: 2, expert: 'HealthAnalyst@microbiome', accuracy: 0.92, runs: 300, status: 'performer' },
                { rank: 8, expert: 'MarketAnalyst@nfl', accuracy: 0.75, runs: 100, status: 'critical' },
            ],
        },
        rotation: {
            target: 'MarketAnalyst@nfl',
            mentor: 'TheAnalyst@nfl',
            strategy: 'full_retrain',
            reason: 'Critical accuracy drift detected (25% drop). Learn from TheAnalyst (95% accuracy)',
            expectedImpact: 0.14, // 70% of 0.20 gap
            priority: 'critical',
        },
    },
    /**
     * Example 2: Moderate performance decline
     */
    moderateDecline: {
        scenario: 'PredictorBot@sports declining from 0.88 to 0.80',
        rotation: {
            target: 'PredictorBot@sports',
            mentor: 'TopPredictor@sports',
            strategy: 'hybrid',
            actions: [
                'Transfer TopPredictor\'s system prompt',
                'Add 10 few-shot examples from successful predictions',
                'Partial retrain with 100 samples',
            ],
            monitoring: {
                period: '48 hours',
                metrics: ['accuracy', 'recent_accuracy', 'confidence'],
                successCriteria: 'Accuracy improvement >= 0.04 (50% of 0.08 gap)',
            },
        },
    },
    /**
     * Example 3: New expert underperforming
     */
    newExpertStruggling: {
        scenario: 'NewOptimizer@fintech at 0.65 accuracy after 60 runs',
        rotation: {
            target: 'NewOptimizer@fintech',
            mentor: 'SeniorOptimizer@fintech',
            strategy: 'few_shot_transfer',
            actions: [
                'Extract SeniorOptimizer\'s prompt and configuration',
                'Transfer 15 few-shot examples covering key patterns',
                'No retraining needed (expert still learning)',
            ],
            expectedImpact: 0.10,
            monitoring: {
                period: '48 hours',
                checkpoints: ['After 10 runs', 'After 25 runs', 'After 48 hours'],
            },
        },
    },
    /**
     * Example 4: Cross-project knowledge transfer
     */
    crossProjectTransfer: {
        scenario: 'HealthAnalyst@microbiome learns from similar analysis patterns',
        rotation: {
            target: 'HealthAnalyst@microbiome',
            mentor: 'BioAnalyst@genomics',
            strategy: 'prompt_transfer',
            reason: 'Both projects involve biological data analysis. BioAnalyst uses proven patterns.',
            actions: [
                'Adapt BioAnalyst\'s analysis framework to microbiome domain',
                'Transfer domain-agnostic reasoning patterns',
                'Customize few-shot examples for microbiome context',
            ],
            expectedImpact: 0.06,
        },
    },
};
export default ExpertLeagueManager;
