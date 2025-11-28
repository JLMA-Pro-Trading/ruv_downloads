/**
 * Agentic Robotics integration for workflow automation
 */
export interface WorkflowConfig {
    name: string;
    steps: WorkflowStep[];
    triggers?: WorkflowTrigger[];
    schedule?: string;
}
export interface WorkflowStep {
    id: string;
    action: string;
    params: Record<string, any>;
    condition?: string;
    retry?: RetryConfig;
}
export interface WorkflowTrigger {
    type: 'manual' | 'scheduled' | 'event';
    config: Record<string, any>;
}
export interface RetryConfig {
    maxAttempts: number;
    backoff: 'linear' | 'exponential';
    delay: number;
}
/**
 * Agentic Robotics client for workflow automation
 */
export declare class RoboticsClient {
    private isAvailable;
    private workflows;
    constructor();
    /**
     * Check if agentic-robotics is available
     */
    private checkAvailability;
    /**
     * Register a workflow
     */
    registerWorkflow(config: WorkflowConfig): void;
    /**
     * Execute a workflow
     */
    executeWorkflow(name: string, context?: Record<string, any>): Promise<any>;
    /**
     * Fallback workflow execution
     */
    private fallbackExecute;
    /**
     * Execute a single workflow step
     */
    private executeStep;
    /**
     * Calculate backoff delay
     */
    private calculateBackoff;
    /**
     * List registered workflows
     */
    listWorkflows(): string[];
    /**
     * Get workflow configuration
     */
    getWorkflow(name: string): WorkflowConfig | undefined;
    /**
     * Check if robotics is available
     */
    available(): boolean;
    /**
     * Utility delay
     */
    private delay;
}
/**
 * Create robotics client with default workflows
 */
export declare function createRoboticsClient(): RoboticsClient;
//# sourceMappingURL=robotics.d.ts.map