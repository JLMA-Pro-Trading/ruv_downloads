/**
 * UltraThink MCP Server Tool Handlers
 *
 * Implementation of tool handlers with agentic-flow and agentdb integration
 *
 * @module handlers
 */
import type { ToolHandler } from './types.js';
export declare const handleSwarmInit: ToolHandler;
export declare const handleSwarmStatus: ToolHandler;
export declare const handleSwarmDestroy: ToolHandler;
export declare const handleAgentSpawn: ToolHandler;
export declare const handleAgentList: ToolHandler;
export declare const handleAgentMetrics: ToolHandler;
export declare const handleTaskOrchestrate: ToolHandler;
export declare const handleTaskStatus: ToolHandler;
export declare const handleTaskResults: ToolHandler;
export declare const handlePatternDiscover: ToolHandler;
export declare const handlePatternApply: ToolHandler;
export declare const handleReflexionRecord: ToolHandler;
export declare const handleReflexionSearch: ToolHandler;
export declare const handleMemoryStore: ToolHandler;
export declare const handleMemorySearch: ToolHandler;
export declare const handleMemoryConsolidate: ToolHandler;
export declare const handleHealthCheck: ToolHandler;
export declare const handleMetricsGet: ToolHandler;
export declare const handleToolStats: ToolHandler;
export declare const handlers: {
    ultrathink_swarm_init: ToolHandler;
    ultrathink_swarm_status: ToolHandler;
    ultrathink_swarm_destroy: ToolHandler;
    ultrathink_agent_spawn: ToolHandler;
    ultrathink_agent_list: ToolHandler;
    ultrathink_agent_metrics: ToolHandler;
    ultrathink_task_orchestrate: ToolHandler;
    ultrathink_task_status: ToolHandler;
    ultrathink_task_results: ToolHandler;
    ultrathink_pattern_discover: ToolHandler;
    ultrathink_pattern_apply: ToolHandler;
    ultrathink_reflexion_record: ToolHandler;
    ultrathink_reflexion_search: ToolHandler;
    ultrathink_memory_store: ToolHandler;
    ultrathink_memory_search: ToolHandler;
    ultrathink_memory_consolidate: ToolHandler;
    ultrathink_health_check: ToolHandler;
    ultrathink_metrics_get: ToolHandler;
    ultrathink_tool_stats: ToolHandler;
};
export default handlers;
//# sourceMappingURL=handlers.d.ts.map