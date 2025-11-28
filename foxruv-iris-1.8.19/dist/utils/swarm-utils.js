/**
 * Swarm Coordination Utilities
 *
 * Utilities for coordinating multi-agent training using claude-flow MCP tools.
 * Enables parallel expert optimization, distributed learning, and fault-tolerant workflows.
 *
 * @module swarm-utils
 * @version 1.0.0
 */
/**
 * Train multiple experts in parallel using swarm coordination
 */
export async function trainExpertsInParallel(tasks, config) {
    const results = [];
    // MCP coordination setup (if available)
    try {
        // Optional: Initialize swarm topology via MCP
        // This is coordination setup only - actual training happens in spawned agents
        // await mcp_swarm_init({ topology: config.topology, maxAgents: config.maxAgents })
    }
    catch (err) {
        console.warn('MCP swarm coordination unavailable, using local execution:', err);
    }
    // Process tasks in batches to avoid overwhelming resources
    const batchSize = Math.min(config.maxAgents, tasks.length);
    for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        // Execute batch in parallel
        const batchResults = await Promise.all(batch.map(task => trainSingleExpert(task)));
        results.push(...batchResults);
    }
    return results;
}
/**
 * Train a single expert (mock implementation - replace with real training)
 */
async function trainSingleExpert(task) {
    const startTime = Date.now();
    try {
        // Mock training - replace with real DSPy/optimizer calls
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        const mockMetrics = {
            accuracy: Math.random() * 0.3 + 0.7, // 0.7-1.0
            f1: Math.random() * 0.3 + 0.7,
            loss: Math.random() * 0.5
        };
        return {
            expertId: task.expertId,
            success: true,
            metrics: mockMetrics,
            duration: Date.now() - startTime
        };
    }
    catch (error) {
        return {
            expertId: task.expertId,
            success: false,
            metrics: {},
            duration: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
/**
 * Calculate swarm statistics from training results
 */
export function calculateSwarmStats(results) {
    const completed = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length || 0;
    return {
        totalTasks: results.length,
        completedTasks: completed.length,
        failedTasks: failed.length,
        avgDuration,
        peakMemoryMB: 0 // Would need actual memory tracking
    };
}
/**
 * Retry failed training tasks with exponential backoff
 */
export async function retryFailedTasks(results, originalTasks, maxRetries = 3) {
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length === 0)
        return results;
    const failedTasks = failedResults
        .map(r => originalTasks.find(t => t.expertId === r.expertId))
        .filter((t) => t !== undefined);
    console.log(`Retrying ${failedTasks.length} failed tasks...`);
    const retryResults = [];
    for (const task of failedTasks) {
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            // Exponential backoff
            if (attempt > 0) {
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            const result = await trainSingleExpert(task);
            if (result.success) {
                retryResults.push(result);
                break;
            }
            lastError = result.error;
        }
        // If all retries failed, add the last error
        if (!retryResults.find(r => r.expertId === task.expertId)) {
            retryResults.push({
                expertId: task.expertId,
                success: false,
                metrics: {},
                duration: 0,
                error: lastError || 'All retries failed'
            });
        }
    }
    // Merge with successful results
    return [
        ...results.filter(r => r.success),
        ...retryResults
    ];
}
/**
 * Shard large training dataset for distributed processing
 */
export function shardTrainingData(data, numShards) {
    const shards = Array.from({ length: numShards }, () => []);
    data.forEach((item, idx) => {
        shards[idx % numShards].push(item);
    });
    return shards;
}
/**
 * Aggregate metrics from multiple training runs
 */
export function aggregateMetrics(results) {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) {
        return {};
    }
    const allMetricKeys = new Set();
    successfulResults.forEach(r => {
        Object.keys(r.metrics).forEach(k => allMetricKeys.add(k));
    });
    const aggregated = {};
    allMetricKeys.forEach(key => {
        const values = successfulResults
            .map(r => r.metrics[key])
            .filter((v) => v !== undefined);
        if (values.length > 0) {
            aggregated[`avg_${key}`] = values.reduce((a, b) => a + b, 0) / values.length;
            aggregated[`max_${key}`] = Math.max(...values);
            aggregated[`min_${key}`] = Math.min(...values);
        }
    });
    return aggregated;
}
/**
 * Load balancing strategy for distributing tasks across agents
 */
export function loadBalanceTasks(tasks, agentCapacities) {
    const numAgents = agentCapacities.length;
    const totalCapacity = agentCapacities.reduce((a, b) => a + b, 0);
    const assignment = agentCapacities.map(() => []);
    // Sort tasks by estimated complexity (if available)
    const sortedTasks = [...tasks];
    let taskIdx = 0;
    let agentIdx = 0;
    while (taskIdx < sortedTasks.length) {
        const agent = agentIdx % numAgents;
        const capacity = agentCapacities[agent];
        // Assign tasks proportional to capacity
        const tasksToAssign = Math.ceil((sortedTasks.length - taskIdx) * (capacity / totalCapacity));
        for (let i = 0; i < tasksToAssign && taskIdx < sortedTasks.length; i++) {
            assignment[agent].push(sortedTasks[taskIdx++]);
        }
        agentIdx++;
    }
    return assignment;
}
/**
 * Create a fault-tolerant training wrapper
 */
export async function faultTolerantTrain(task, maxRetries = 3, timeout = 300000 // 5 minutes
) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Race between training and timeout
            const result = await Promise.race([
                trainSingleExpert(task),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Training timeout')), timeout))
            ]);
            if (result.success) {
                return result;
            }
            // If training failed but didn't throw, retry
            console.warn(`Training attempt ${attempt + 1} failed for ${task.expertId}:`, result.error);
        }
        catch (error) {
            console.error(`Training attempt ${attempt + 1} threw error for ${task.expertId}:`, error);
            if (attempt === maxRetries - 1) {
                return {
                    expertId: task.expertId,
                    success: false,
                    metrics: {},
                    duration: 0,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
            // Exponential backoff before retry
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
    }
    return {
        expertId: task.expertId,
        success: false,
        metrics: {},
        duration: 0,
        error: 'Max retries exceeded'
    };
}
/**
 * Monitor training progress with real-time updates
 */
export class TrainingMonitor {
    totalTasks = 0;
    completedTasks = 0;
    startTime = 0;
    callbacks = [];
    constructor(totalTasks) {
        this.totalTasks = totalTasks;
        this.startTime = Date.now();
    }
    onProgress(callback) {
        this.callbacks.push(callback);
    }
    reportComplete() {
        this.completedTasks++;
        const progress = this.completedTasks / this.totalTasks;
        this.callbacks.forEach(cb => cb(progress));
    }
    getETA() {
        if (this.completedTasks === 0)
            return Infinity;
        const elapsed = Date.now() - this.startTime;
        const avgTimePerTask = elapsed / this.completedTasks;
        const remaining = this.totalTasks - this.completedTasks;
        return remaining * avgTimePerTask;
    }
    getStats() {
        return {
            progress: this.completedTasks / this.totalTasks,
            completed: this.completedTasks,
            total: this.totalTasks,
            eta: this.getETA(),
            elapsed: Date.now() - this.startTime
        };
    }
}
