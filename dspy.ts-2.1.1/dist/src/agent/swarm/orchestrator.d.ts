/**
 * Swarm Orchestrator
 *
 * Coordinates execution of multiple agents with handoffs
 */
import { Agent, Task, TaskResult, SwarmConfig } from './types';
/**
 * Default swarm configuration
 */
export declare const DEFAULT_SWARM_CONFIG: SwarmConfig;
export declare class SwarmOrchestrator {
    private agents;
    private logger;
    private config;
    private activeTasks;
    constructor(config?: Partial<SwarmConfig>);
    /**
     * Register an agent with the swarm
     */
    addAgent(agent: Agent): void;
    /**
     * Remove an agent from the swarm
     */
    removeAgent(agentId: string): void;
    /**
     * Get an agent by ID
     */
    getAgent(agentId: string): Agent | undefined;
    /**
     * Execute a task through the swarm
     */
    execute(task: Task): Promise<TaskResult>;
    /**
     * Execute a single agent
     */
    private executeAgent;
    /**
     * Check if any handoff conditions are met
     */
    private checkHandoffs;
    /**
     * Transfer context variables for handoff
     */
    private transferContext;
    /**
     * Get default agent (first registered agent)
     */
    private getDefaultAgent;
    /**
     * Get orchestrator statistics
     */
    getStats(): {
        totalAgents: number;
        activeTasks: number;
        agents: Array<{
            id: string;
            name: string;
            handoffs: number;
        }>;
    };
}
