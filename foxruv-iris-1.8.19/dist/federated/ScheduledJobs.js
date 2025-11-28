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
export class ScheduledJobs extends EventEmitter {
    config;
    controlPlane;
    intervalHandle;
    timeoutHandle;
    isRunning = false;
    currentExecution;
    executionHistory = [];
    constructor(controlPlane, config) {
        super();
        this.config = config;
        this.controlPlane = controlPlane;
    }
    /**
     * Start scheduled job execution
     */
    start() {
        if (this.isRunning) {
            throw new Error('Scheduled jobs already running');
        }
        if (this.config.enabled === false) {
            this.emit('disabled');
            return;
        }
        this.isRunning = true;
        const intervalMs = this.config.intervalMinutes * 60 * 1000;
        this.emit('started', {
            interval: this.config.intervalMinutes,
            nextRun: new Date(Date.now() + intervalMs),
        });
        // Run immediately on start
        this.executeJob();
        // Schedule periodic execution
        this.intervalHandle = setInterval(() => {
            this.executeJob();
        }, intervalMs);
    }
    /**
     * Stop scheduled job execution
     */
    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = undefined;
        }
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }
        this.isRunning = false;
        this.emit('stopped');
    }
    /**
     * Execute a single job with retry logic
     */
    async executeJob(retryCount = 0) {
        const execution = {
            id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            startTime: new Date(),
            status: 'running',
            retryCount,
        };
        this.currentExecution = execution;
        this.emit('job:start', execution);
        // Set timeout
        const timeoutMs = (this.config.timeoutMinutes || 10) * 60 * 1000;
        this.timeoutHandle = setTimeout(() => {
            this.handleTimeout(execution);
        }, timeoutMs);
        try {
            // Run control plane cycle
            await this.controlPlane.runCycle();
            // Get metrics from control plane
            const metrics = this.controlPlane.getMetrics();
            // Mark execution as completed
            execution.endTime = new Date();
            execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
            execution.status = 'completed';
            execution.metrics = metrics;
            this.executionHistory.push(execution);
            this.currentExecution = undefined;
            if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle);
                this.timeoutHandle = undefined;
            }
            this.emit('job:complete', execution);
            // Trim history to last 100 executions
            if (this.executionHistory.length > 100) {
                this.executionHistory = this.executionHistory.slice(-100);
            }
        }
        catch (error) {
            execution.error = error;
            execution.status = 'failed';
            execution.endTime = new Date();
            execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
            this.emit('job:error', { execution, error });
            // Retry logic
            const maxRetries = this.config.maxRetries || 3;
            if (retryCount < maxRetries) {
                const retryDelay = (this.config.retryDelaySeconds || 30) * 1000;
                this.emit('job:retry', {
                    execution,
                    retryCount: retryCount + 1,
                    maxRetries,
                    retryDelay,
                });
                setTimeout(() => {
                    this.executeJob(retryCount + 1);
                }, retryDelay);
            }
            else {
                this.executionHistory.push(execution);
                this.currentExecution = undefined;
                this.emit('job:failed', execution);
            }
            if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle);
                this.timeoutHandle = undefined;
            }
        }
    }
    /**
     * Handle job timeout
     */
    handleTimeout(execution) {
        execution.status = 'timeout';
        execution.endTime = new Date();
        execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
        this.executionHistory.push(execution);
        this.currentExecution = undefined;
        this.emit('job:timeout', execution);
    }
    /**
     * Get current job status
     */
    getCurrentStatus() {
        return this.currentExecution || null;
    }
    /**
     * Get execution history
     */
    getHistory(limit = 10) {
        return this.executionHistory.slice(-limit);
    }
    /**
     * Get job statistics
     */
    getStats() {
        const total = this.executionHistory.length;
        const successful = this.executionHistory.filter(e => e.status === 'completed').length;
        const failed = this.executionHistory.filter(e => e.status === 'failed').length;
        const timeout = this.executionHistory.filter(e => e.status === 'timeout').length;
        const durations = this.executionHistory
            .filter(e => e.duration)
            .map(e => e.duration);
        const averageDuration = durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0;
        const successRate = total > 0 ? successful / total : 0;
        return {
            totalExecutions: total,
            successful,
            failed,
            timeout,
            averageDuration,
            successRate,
            lastExecution: this.executionHistory[this.executionHistory.length - 1],
        };
    }
    /**
     * Manually trigger a job execution
     */
    async trigger() {
        if (this.currentExecution) {
            throw new Error('Job already running');
        }
        await this.executeJob();
    }
    /**
     * Update schedule configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        // Restart if running
        if (this.isRunning) {
            this.stop();
            this.start();
        }
        this.emit('config:updated', this.config);
    }
    /**
     * Check if scheduler is healthy
     */
    isHealthy() {
        // Consider healthy if success rate > 80% in last 10 executions
        const recent = this.getHistory(10);
        if (recent.length === 0)
            return true;
        const recentSuccess = recent.filter(e => e.status === 'completed').length;
        const recentSuccessRate = recentSuccess / recent.length;
        return recentSuccessRate >= 0.8;
    }
}
export default ScheduledJobs;
