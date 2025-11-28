/**
 * Iris Orchestrator - Simplified core for @iris/core package
 */
import { calculateHealthScore, getHealthLevel } from './utils.js';
export class IrisOrchestrator {
    config;
    projectConfigs = new Map();
    constructor(config = {}) {
        this.config = {
            dbBasePath: config.dbBasePath || './data/iris',
            defaultAutoRetrain: config.defaultAutoRetrain ?? false,
            defaultAutoPromote: config.defaultAutoPromote ?? false,
            scheduleIntervalMs: config.scheduleIntervalMs ?? 24 * 60 * 60 * 1000,
            logPath: config.logPath || './logs',
            notifiers: config.notifiers || []
        };
    }
    configureProject(config) {
        this.projectConfigs.set(config.projectId, config);
    }
    getProjectConfig(projectId) {
        return (this.projectConfigs.get(projectId) || {
            projectId,
            autoRetrain: this.config.defaultAutoRetrain,
            autoPromote: this.config.defaultAutoPromote,
            retrainingThreshold: 0.1,
            promotionThreshold: 0.1,
            minEvaluations: 10
        });
    }
    calculateProjectHealth(factors) {
        const healthScore = calculateHealthScore(factors);
        const healthLevel = getHealthLevel(healthScore);
        return { healthScore, healthLevel };
    }
    async evaluateProject(projectId) {
        // Simplified evaluation for core package
        const health = this.calculateProjectHealth({
            driftAlerts: 0,
            staleReflexions: 0,
            avgValidity: 1.0,
            highPriorityRotations: 0
        });
        return {
            projectId,
            timestamp: new Date(),
            overallHealth: health.healthLevel,
            healthScore: health.healthScore,
            driftAlerts: [],
            promptRecommendations: [],
            reflexionStatus: {
                totalReflexions: 0,
                staleReflexions: 0,
                avgValidity: 1.0,
                transferableReflexions: 0
            },
            rotationRecommendations: [],
            transferablePatterns: [],
            recommendedActions: []
        };
    }
}
export function createIrisOrchestrator(config) {
    return new IrisOrchestrator(config);
}
//# sourceMappingURL=orchestrator.js.map