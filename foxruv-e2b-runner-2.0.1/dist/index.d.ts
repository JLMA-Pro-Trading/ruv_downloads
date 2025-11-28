export interface AgentAnalysis {
    agent: string;
    role: string;
    timestamp: Date;
    analysis: string;
    keyFindings: string[];
    confidence: number;
    supportingEvidence: any[];
    citations: number[];
    mechanisticChains?: string[];
    executionTime: number;
    toolsUsed?: string[];
}
export interface AnalysisContext {
    sample: any;
    clinical: any;
    episodic?: any[];
    claim?: any;
    options: any;
    literature?: any;
    domainKnowledge?: any;
}
export interface CouncilAgent {
    role: string;
    analyze(context: AnalysisContext): Promise<AgentAnalysis>;
    getMetadata(): {
        role: string;
        systemPrompt: string;
        model: string;
    };
}
export interface SwarmConfig {
    topology?: 'mesh' | 'hierarchical' | 'ring' | 'star';
    maxAgents?: number;
    strategy?: 'parallel' | 'sequential' | 'adaptive' | 'balanced';
}
export interface ReasoningPattern {
    id: number;
    trajectory: string;
    verdict: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
    reasoning: string;
    confidence: number;
    executionTimeMs: number;
    agentId: string;
    timestamp: string;
}
export interface E2BRunnerConfig {
    apiKey?: string;
    templateId?: string;
    maxConcurrency?: number;
    enableStreaming?: boolean;
    timeout?: number;
    verbose?: boolean;
    autoScaling?: {
        enabled: boolean;
        minInstances: number;
        maxInstances: number;
        scaleUpThreshold: number;
        scaleDownThreshold: number;
    };
    regions?: ('us-east' | 'us-west' | 'eu-west' | 'ap-southeast')[];
    agentdb?: {
        enabled: boolean;
        endpoint?: string;
        cacheTTL?: number;
    };
    swarm?: SwarmConfig;
}
export declare const DEFAULT_E2B_RUNNER_CONFIG: Partial<E2BRunnerConfig>;
export declare class E2BAgentRunner {
    private config;
    private activeSandboxes;
    private sandboxPool;
    private executionCount;
    private totalExecutionTime;
    private errorCount;
    constructor(config?: E2BRunnerConfig);
    run(agent: CouncilAgent, context: AnalysisContext, tools?: string[]): Promise<AgentAnalysis>;
    runBatch(agents: CouncilAgent[], context: AnalysisContext, toolsPerAgent?: Map<string, string[]>): Promise<AgentAnalysis[]>;
    runWithStreaming(agent: CouncilAgent, context: AnalysisContext): AsyncIterableIterator<{
        phase: string;
        message: string;
        progress: number;
    }>;
    private createSandbox;
    private executeInSandbox;
    private executeAgentInSandbox;
    getStatus(): {
        activeSandboxes: number;
        totalExecutions: number;
        averageExecutionTime: number;
        errorRate: number;
    };
    cleanup(): Promise<void>;
    private log;
    private logError;
}
export declare function createE2BRunner(config?: Partial<E2BRunnerConfig>): E2BAgentRunner;
export declare function isE2BAvailable(): boolean;
//# sourceMappingURL=index.d.ts.map