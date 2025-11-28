/**
 * UltraThink MCP Server Type Definitions
 *
 * Standalone type definitions for the UltraThink MCP server
 * with agentic-flow and agentdb integration
 *
 * @module types
 */
export interface ServerConfig {
    name: string;
    version: string;
    enableMetrics?: boolean;
    enableLearning?: boolean;
    dbPath?: string;
}
export interface ServerCapabilities {
    tools: Record<string, unknown>;
    resources?: Record<string, unknown>;
    prompts?: Record<string, unknown>;
}
export interface ToolInvocation {
    id: string;
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: Date;
    duration?: number;
    success: boolean;
    result?: unknown;
    error?: string;
}
export interface ToolMetrics {
    toolName: string;
    totalInvocations: number;
    successCount: number;
    errorCount: number;
    avgDuration: number;
    lastInvoked: Date;
}
export interface SwarmConfig {
    swarmId: string;
    topology: 'mesh' | 'hierarchical' | 'ring' | 'star';
    maxAgents?: number;
    transport?: 'quic' | 'http2' | 'auto';
}
export interface AgentConfig {
    id: string;
    type: string;
    role: string;
    capabilities: string[];
    metadata?: Record<string, unknown>;
}
export interface TaskConfig {
    taskId: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    strategy?: 'parallel' | 'sequential' | 'adaptive';
    agentIds?: string[];
}
export interface SwarmInstance {
    swarmId: string;
    topology: string;
    agents: AgentConfig[];
    activeTasksCount: number;
    createdAt: Date;
}
export interface MemoryEntry {
    id: string;
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
    timestamp: Date;
    tags?: string[];
}
export interface PatternData {
    id: string;
    pattern: string;
    frequency: number;
    successRate: number;
    context: string;
    learnedAt: Date;
}
export interface LearningMetrics {
    totalPatterns: number;
    successfulPatterns: number;
    failedPatterns: number;
    avgConfidence: number;
    lastUpdated: Date;
}
export interface ReflexionEntry {
    id: string;
    query: string;
    response: string;
    outcome: 'success' | 'failure';
    reflection: string;
    timestamp: Date;
}
export interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    services: {
        mcp: boolean;
        agenticFlow: boolean;
        agentdb: boolean;
        swarm?: boolean;
    };
    metrics: {
        uptime: number;
        totalRequests: number;
        activeSwarms: number;
        activeAgents: number;
    };
}
export interface PerformanceMetrics {
    requestsPerSecond: number;
    avgResponseTime: number;
    errorRate: number;
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
    };
}
export interface ToolHandler {
    (args: Record<string, unknown>): Promise<ToolResult>;
}
export interface ToolResult {
    content: Array<{
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
}
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
    };
    handler: ToolHandler;
}
export interface TaskResult {
    taskId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: unknown;
    error?: string;
    startedAt: Date;
    completedAt?: Date;
    agentsUsed: string[];
}
export interface OrchestrationResult {
    tasks: TaskResult[];
    totalDuration: number;
    successRate: number;
    patternsLearned: number;
}
export declare class UltraThinkError extends Error {
    code: string;
    details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
export declare class SwarmError extends UltraThinkError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class LearningError extends UltraThinkError {
    constructor(message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=types.d.ts.map