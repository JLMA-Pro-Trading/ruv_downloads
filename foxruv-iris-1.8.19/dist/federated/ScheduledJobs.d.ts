/**
 * Scheduled Jobs Manager
 *
 * Manages automated execution of AI Council and telemetry analysis:
 * - Runs every 5 minutes (configurable)
 * - Aggregates telemetry
 * - Triggers AI Council
 * - Executes decisions
 * - Handles failures and retries
 *
 * @module ScheduledJobs
 */
import { EventEmitter } from 'events';
import { FederatedControlPlane } from './FederatedControlPlane.js';
export interface ScheduleConfig {
    /** Interval in minutes between job executions */
    intervalMinutes: number;
    /** Maximum execution time before timeout (minutes) */
    timeoutMinutes?: number;
    /** Number of retries on failure */
    maxRetries?: number;
    /** Delay between retries (seconds) */
    retryDelaySeconds?: number;
    /** Enable/disable job execution */
    enabled?: boolean;
    /** Cron expression for custom scheduling */
    cronExpression?: string;
    /** Time zone for scheduling */
    timezone?: string;
}
export interface JobExecution {
    id: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    status: 'running' | 'completed' | 'failed' | 'timeout';
    error?: Error;
    metrics?: any;
    retryCount?: number;
}
export declare class ScheduledJobs extends EventEmitter {
    private config;
    private controlPlane;
    private intervalHandle?;
    private timeoutHandle?;
    private isRunning;
    private currentExecution?;
    private executionHistory;
    constructor(controlPlane: FederatedControlPlane, config: ScheduleConfig);
    /**
     * Start scheduled job execution
     */
    start(): void;
    /**
     * Stop scheduled job execution
     */
    stop(): void;
    /**
     * Execute a single job with retry logic
     */
    private executeJob;
    /**
     * Handle job timeout
     */
    private handleTimeout;
    /**
     * Get current job status
     */
    getCurrentStatus(): JobExecution | null;
    /**
     * Get execution history
     */
    getHistory(limit?: number): JobExecution[];
    /**
     * Get job statistics
     */
    getStats(): {
        totalExecutions: number;
        successful: number;
        failed: number;
        timeout: number;
        averageDuration: number;
        successRate: number;
        lastExecution?: JobExecution;
    };
    /**
     * Manually trigger a job execution
     */
    trigger(): Promise<void>;
    /**
     * Update schedule configuration
     */
    updateConfig(config: Partial<ScheduleConfig>): void;
    /**
     * Check if scheduler is healthy
     */
    isHealthy(): boolean;
}
export default ScheduledJobs;
//# sourceMappingURL=ScheduledJobs.d.ts.map