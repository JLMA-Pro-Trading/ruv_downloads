/**
 * Project Connector
 *
 * Manages webhook connections to target projects:
 * - Pushes approved decisions to projects
 * - Handles authentication and retries
 * - Monitors delivery status
 * - Provides feedback loop
 *
 * @module ProjectConnector
 */
import { EventEmitter } from 'events';
import type { CouncilDecision } from '../council/types/index.js';
export interface ProjectConfig {
    /** Project identifier */
    id: string;
    /** Project name */
    name: string;
    /** Webhook URL for receiving updates */
    webhookUrl: string;
    /** Authentication token */
    authToken?: string;
    /** Custom headers */
    headers?: Record<string, string>;
    /** Timeout in seconds */
    timeout?: number;
    /** Retry configuration */
    retry?: {
        maxAttempts: number;
        backoffMs: number;
    };
    /** Feature flags */
    features?: {
        acceptPatterns?: boolean;
        acceptDecisions?: boolean;
        sendFeedback?: boolean;
    };
}
export interface DeliveryResult {
    projectId: string;
    success: boolean;
    statusCode?: number;
    error?: Error;
    attempts: number;
    duration: number;
    timestamp: Date;
}
export interface PatternDeployment {
    type: 'pattern_deployment';
    patternId: string;
    decision: CouncilDecision;
    testResults?: any;
    rolloutPercentage?: number;
    metadata?: Record<string, any>;
}
export declare class ProjectConnector extends EventEmitter {
    private projects;
    private deliveryHistory;
    constructor(projects?: ProjectConfig[]);
    /**
     * Register a new project
     */
    registerProject(project: ProjectConfig): void;
    /**
     * Unregister a project
     */
    unregisterProject(projectId: string): void;
    /**
     * Get project configuration
     */
    getProject(projectId: string): ProjectConfig | undefined;
    /**
     * List all registered projects
     */
    listProjects(): ProjectConfig[];
    /**
     * Push pattern deployment to project
     */
    pushPattern(projectId: string, deployment: PatternDeployment): Promise<DeliveryResult>;
    /**
     * Push decision notification to project
     */
    pushDecision(projectId: string, decision: CouncilDecision): Promise<DeliveryResult>;
    /**
     * Request feedback from project
     */
    requestFeedback(projectId: string, patternId: string): Promise<DeliveryResult>;
    /**
     * Core delivery method with retry logic
     */
    private deliver;
    /**
     * Get delivery history for a project
     */
    getDeliveryHistory(projectId: string, limit?: number): DeliveryResult[];
    /**
     * Get delivery statistics for a project
     */
    getDeliveryStats(projectId: string): {
        total: number;
        successful: number;
        failed: number;
        successRate: number;
        averageDuration: number;
        averageAttempts: number;
    };
    /**
     * Test webhook connectivity
     */
    testConnection(projectId: string): Promise<DeliveryResult>;
    /**
     * Broadcast message to all projects
     */
    broadcast(message: any): Promise<Map<string, DeliveryResult>>;
    /**
     * Get overall connector health
     */
    getHealth(): {
        totalProjects: number;
        reachableProjects: number;
        overallSuccessRate: number;
        averageDeliveryTime: number;
    };
}
export default ProjectConnector;
//# sourceMappingURL=ProjectConnector.d.ts.map