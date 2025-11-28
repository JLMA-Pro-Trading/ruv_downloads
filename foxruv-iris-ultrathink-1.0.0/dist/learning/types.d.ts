/**
 * Learning System Types
 *
 * Shared type definitions for the ultrathink learning and memory system
 */
export interface MCPInvocation {
    id: string;
    serverId: string;
    serverName: string;
    toolName: string;
    toolId: string;
    params: Record<string, any>;
    timestamp: number;
    duration: number;
    success: boolean;
    error?: string;
    result?: any;
    context: InvocationContext;
}
export interface InvocationContext {
    userId?: string;
    sessionId?: string;
    taskType?: string;
    parentInvocationId?: string;
    metadata?: Record<string, any>;
}
export interface ToolMetrics {
    toolId: string;
    toolName: string;
    serverId: string;
    totalInvocations: number;
    successCount: number;
    failureCount: number;
    avgLatency: number;
    minLatency: number;
    maxLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    lastInvocation: number;
    successRate: number;
    errorPatterns: ErrorPattern[];
}
export interface ErrorPattern {
    errorType: string;
    message: string;
    count: number;
    firstSeen: number;
    lastSeen: number;
    examples: string[];
}
export interface UsagePattern {
    pattern: string;
    description: string;
    frequency: number;
    tools: string[];
    avgSuccessRate: number;
    examples: PatternExample[];
}
export interface PatternExample {
    invocationId: string;
    timestamp: number;
    success: boolean;
    context: InvocationContext;
}
export interface DiscoveredPattern {
    id: string;
    type: PatternType;
    name: string;
    description: string;
    confidence: number;
    support: number;
    frequency: number;
    tools: string[];
    sequence?: string[];
    conditions?: PatternCondition[];
    outcomes: PatternOutcome;
    discovered: number;
    lastSeen: number;
    embedding?: number[];
}
export type PatternType = 'sequence' | 'combination' | 'conditional' | 'optimization' | 'anti-pattern' | 'success-pattern';
export interface PatternCondition {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'matches';
    value: any;
}
export interface PatternOutcome {
    successRate: number;
    avgLatency: number;
    reliability: number;
    impact: 'high' | 'medium' | 'low';
}
export interface PatternRecommendation {
    pattern: DiscoveredPattern;
    relevanceScore: number;
    reasoning: string;
    applicableContext: string[];
    expectedImpact: string;
}
export interface AntiPattern {
    id: string;
    name: string;
    description: string;
    occurrences: number;
    impact: 'critical' | 'high' | 'medium' | 'low';
    tools: string[];
    symptoms: string[];
    remediation: string;
    examples: string[];
}
export interface MCPServerMetadata {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: string[];
    tools: MCPToolMetadata[];
    added: number;
    lastUpdated: number;
    status: 'active' | 'inactive' | 'deprecated';
    embedding?: number[];
}
export interface MCPToolMetadata {
    id: string;
    serverId: string;
    name: string;
    description: string;
    inputSchema: any;
    outputSchema?: any;
    examples: ToolExample[];
    tags: string[];
    category?: string;
    complexity: 'simple' | 'moderate' | 'complex';
    reliability: number;
    avgLatency: number;
    embedding?: number[];
}
export interface ToolExample {
    description: string;
    input: Record<string, any>;
    expectedOutput?: any;
    notes?: string;
}
export interface GenerationTemplate {
    id: string;
    name: string;
    description: string;
    version: string;
    serverId: string;
    toolIds: string[];
    template: string;
    variables: TemplateVariable[];
    created: number;
    lastUsed: number;
    useCount: number;
    successRate: number;
    embedding?: number[];
}
export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    default?: any;
    description?: string;
}
export interface WrapperVersion {
    id: string;
    serverId: string;
    version: string;
    code: string;
    metadata: {
        tools: string[];
        features: string[];
        optimizations: string[];
    };
    created: number;
    deprecated?: boolean;
    deprecationReason?: string;
}
export interface SearchQuery {
    query: string;
    type: 'tool' | 'server' | 'template' | 'pattern';
    filters?: SearchFilter[];
    limit?: number;
    threshold?: number;
}
export interface SearchFilter {
    field: string;
    operator: 'eq' | 'ne' | 'in' | 'contains' | 'gt' | 'lt';
    value: any;
}
export interface SearchResult<T> {
    item: T;
    score: number;
    reason: string;
}
export interface AdaptiveStrategy {
    id: string;
    name: string;
    type: 'optimization' | 'error-handling' | 'performance' | 'quality';
    trigger: StrategyTrigger;
    action: StrategyAction;
    enabled: boolean;
    priority: number;
    conditions: AdaptiveCondition[];
    created: number;
    lastTriggered?: number;
    triggerCount: number;
}
export interface StrategyTrigger {
    type: 'threshold' | 'pattern' | 'error' | 'performance' | 'scheduled';
    metric?: string;
    threshold?: number;
    pattern?: string;
    schedule?: string;
}
export interface StrategyAction {
    type: 'regenerate' | 'optimize' | 'fallback' | 'notify' | 'learn';
    params: Record<string, any>;
}
export interface AdaptiveCondition {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
    value: number | string;
}
export interface OptimizationSuggestion {
    id: string;
    type: 'performance' | 'reliability' | 'cost' | 'quality';
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    confidence: number;
    applicableTo: string[];
    implementation: string;
    expectedGains: ExpectedGains;
    basedOn: string[];
}
export interface ExpectedGains {
    latencyReduction?: string;
    reliabilityIncrease?: string;
    costReduction?: string;
    qualityImprovement?: string;
}
export interface SelfHealingAction {
    id: string;
    trigger: string;
    action: string;
    serverId: string;
    toolId?: string;
    timestamp: number;
    success: boolean;
    details: string;
    impact: string;
}
export interface LearningFeedback {
    invocationId: string;
    rating: 1 | 2 | 3 | 4 | 5;
    issues?: string[];
    suggestions?: string[];
    userNotes?: string;
    timestamp: number;
}
export interface LearningSystemConfig {
    agentDbPath?: string;
    embeddingModel?: string;
    vectorDimensions?: number;
    trackingEnabled?: boolean;
    patternDiscoveryEnabled?: boolean;
    adaptiveOptimizationEnabled?: boolean;
    selfHealingEnabled?: boolean;
    learningRate?: number;
    confidenceThreshold?: number;
    minSupport?: number;
    maxPatterns?: number;
}
export interface SystemMetrics {
    totalInvocations: number;
    totalServers: number;
    totalTools: number;
    totalPatterns: number;
    totalTemplates: number;
    avgSuccessRate: number;
    avgLatency: number;
    lastUpdate: number;
    health: 'healthy' | 'degraded' | 'critical';
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'critical';
    issues: HealthIssue[];
    metrics: SystemMetrics;
    timestamp: number;
}
export interface HealthIssue {
    severity: 'critical' | 'warning' | 'info';
    component: string;
    message: string;
    details?: string;
    recommendation?: string;
}
//# sourceMappingURL=types.d.ts.map