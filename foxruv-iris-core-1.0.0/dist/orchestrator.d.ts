/**
 * Iris Orchestrator - Simplified core for @iris/core package
 */
import type { ProjectConfig, IrisPrimeConfig, IrisReport } from './types.js';
export declare class IrisOrchestrator {
    private config;
    private projectConfigs;
    constructor(config?: IrisPrimeConfig);
    configureProject(config: ProjectConfig): void;
    getProjectConfig(projectId: string): ProjectConfig;
    calculateProjectHealth(factors: {
        driftAlerts: number;
        staleReflexions: number;
        avgValidity: number;
        highPriorityRotations: number;
    }): {
        healthScore: number;
        healthLevel: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    };
    evaluateProject(projectId: string): Promise<IrisReport>;
}
export declare function createIrisOrchestrator(config?: IrisPrimeConfig): IrisOrchestrator;
//# sourceMappingURL=orchestrator.d.ts.map