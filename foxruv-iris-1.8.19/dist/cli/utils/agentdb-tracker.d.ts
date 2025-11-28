/**
 * AgentDB integration for MCP skill tracking
 */
export interface McpInvocation {
    skillId: string;
    tool: string;
    args: Record<string, any>;
    timestamp: number;
    success: boolean;
    latency?: number;
    error?: string;
    result?: any;
}
export declare class McpTracker {
    private agentDb;
    private initialized;
    initialize(): Promise<void>;
    trackInvocation(invocation: McpInvocation): Promise<void>;
    getSkillMetrics(skillId: string): Promise<any>;
}
export declare function getMcpTracker(): McpTracker;
//# sourceMappingURL=agentdb-tracker.d.ts.map