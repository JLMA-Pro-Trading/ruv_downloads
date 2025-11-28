/**
 * Federated Control Plane - Main Orchestrator
 *
 * Coordinates the entire federated learning system:
 * - Aggregates telemetry from all projects
 * - Runs AI Council analysis
 * - Executes approved decisions
 * - Pushes improvements back to projects
 *
 * @module FederatedControlPlane
 */
import { EventEmitter } from 'events';
import { VectorStore } from '../core/VectorStore.js';
export interface ControlPlaneConfig {
    /** AgentDB vector store for pattern storage */
    vectorStore: VectorStore;
    /** Supabase for telemetry and decisions */
    supabaseUrl: string;
    supabaseKey: string;
    /** Scheduling configuration */
    intervalMinutes?: number;
    /** AI Council configuration */
    councilSize?: number;
    quorumThreshold?: number;
    /** Pattern testing configuration */
    testTrafficPercentage?: number;
    testDurationMinutes?: number;
    successThreshold?: number;
    /** Project webhooks for pushing decisions */
    projectWebhooks: Map<string, string>;
    /** Enable/disable automatic execution */
    autoExecute?: boolean;
}
export interface ControlPlaneMetrics {
    totalTelemetryEvents: number;
    patternsDetected: number;
    decisionsProposed: number;
    decisionsApproved: number;
    decisionsExecuted: number;
    patternsTransferred: number;
    averageConsensus: number;
    lastRunTime: Date;
    healthStatus: 'healthy' | 'degraded' | 'error';
}
export declare class FederatedControlPlane extends EventEmitter {
    private config;
    private aggregator;
    private council;
    private testRunner;
    private supabase;
    private telemetry;
    private advisor?;
    private replayInterval?;
    private drafts;
    private intervalHandle?;
    private isRunning;
    private metrics;
    constructor(config: ControlPlaneConfig);
    /**
     * Start the control plane with scheduled execution
     */
    start(): Promise<void>;
    /**
     * Stop the control plane
     */
    stop(): Promise<void>;
    /**
     * Execute one complete cycle of the control plane
     */
    runCycle(): Promise<void>;
    /**
     * Execute an approved AI Council decision
     */
    private executeDecision;
    /**
     * Push approved pattern to target project via webhook
     */
    private pushToProject;
    /**
     * Get eligible target projects for pattern transfer
     */
    private getEligibleTargets;
    /**
     * Mark pattern as universal (successful on all projects)
     */
    private markPatternAsUniversal;
    /**
     * Store cycle results in Supabase for analytics
     */
    private storeCycleResults;
    /**
     * Get current control plane metrics
     */
    getMetrics(): ControlPlaneMetrics;
    /**
     * Get control plane health status
     */
    getHealth(): Promise<{
        status: 'healthy' | 'degraded' | 'error';
        uptime: number;
        lastCycle: Date;
        components: Record<string, boolean>;
    }>;
    /**
     * Manually trigger a decision analysis
     */
    analyzePattern(patternId: string, targetProjects: string[]): Promise<any>;
    private buildAdvisorDecisions;
    /**
     * Manually test a pattern on target projects
     */
    testPattern(patternId: string, targetProjects: string[]): Promise<any[]>;
}
export default FederatedControlPlane;
//# sourceMappingURL=FederatedControlPlane.d.ts.map