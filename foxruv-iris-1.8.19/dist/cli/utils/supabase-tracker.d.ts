/**
 * Supabase integration for MCP skill tracking
 */
export interface McpInvocationLog {
    skill_id: string;
    tool_name: string;
    args: Record<string, any>;
    success: boolean;
    latency_ms?: number;
    error_message?: string;
    result_summary?: string;
    project_name?: string;
    user_id?: string;
}
export declare class SupabaseMcpTracker {
    logInvocation(log: McpInvocationLog): Promise<void>;
    getSkillStats(skillId: string, projectName?: string): Promise<any>;
    getDriftDetection(skillId: string, windowDays?: number): Promise<any>;
}
export declare function getSupabaseMcpTracker(): SupabaseMcpTracker;
//# sourceMappingURL=supabase-tracker.d.ts.map