/**
 * Core type definitions for @iris/core
 */
export type ModelProvider = 'anthropic' | 'openai' | 'lmstudio';
export interface LMProviderConfig {
    provider: ModelProvider;
    model: string;
    apiKey?: string;
    baseURL?: string;
    debug?: boolean;
    trackPerformance?: boolean;
}
export interface PerformanceMetrics {
    provider: ModelProvider;
    model: string;
    averageLatencyMs: number;
    totalRequests: number;
    successRate: number;
    qualityScore?: number;
}
export interface Signature {
    instructions: string;
    input: Record<string, string>;
    output: Record<string, string>;
}
export interface ProjectConfig {
    projectId: string;
    autoRetrain: boolean;
    autoPromote: boolean;
    retrainingThreshold: number;
    promotionThreshold: number;
    minEvaluations: number;
}
export interface IrisPrimeConfig {
    dbBasePath?: string;
    defaultAutoRetrain?: boolean;
    defaultAutoPromote?: boolean;
    scheduleIntervalMs?: number;
    logPath?: string;
    notifiers?: any[];
}
export interface IrisReport {
    projectId: string;
    timestamp: Date;
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    healthScore: number;
    driftAlerts: any[];
    promptRecommendations: any[];
    reflexionStatus: {
        totalReflexions: number;
        staleReflexions: number;
        avgValidity: number;
        transferableReflexions: number;
    };
    rotationRecommendations: any[];
    transferablePatterns: any[];
    recommendedActions: any[];
}
export interface HealthFactors {
    driftAlerts: number;
    staleReflexions: number;
    avgValidity: number;
    highPriorityRotations: number;
}
export interface RecommendedAction {
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    reason: string;
    impact: string;
}
export interface RecommendedActionParams {
    driftAlerts: Array<{
        severityLevel: string;
        expertId: string;
        driftType: string;
        percentageChange: number;
    }>;
    rotationRecommendations: Array<{
        priority: string;
        expertId: string;
        recommendedAction: string;
        reason: string;
    }>;
    promptRecommendations: any[];
    staleReflexionsCount: number;
    reflexionStats: {
        staleReflexions: number;
        avgValidity: number;
    };
}
export interface IrisOrchestratorConfig {
    dbBasePath?: string;
    defaultAutoRetrain?: boolean;
    defaultAutoPromote?: boolean;
    scheduleIntervalMs?: number;
    logPath?: string;
    notifiers?: any[];
}
//# sourceMappingURL=types.d.ts.map