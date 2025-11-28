/**
 * Swarm Coordinator for Parallel Expert Training
 *
 * Orchestrates multi-expert optimization using swarm patterns. Enables:
 * - Parallel training of multiple experts
 * - Load balancing across training resources
 * - Coordinated optimization with shared learning
 * - Fault-tolerant training pipelines
 *
 * @module swarm-coordinator
 * @version 1.0.0
 */
// ============================================================================
// Swarm Coordinator
// ============================================================================
export class SwarmCoordinator {
    optimizer;
    storage;
    reasoningBank;
    config;
    activeWorkers = 0;
    queue = [];
    results = new Map();
    constructor(optimizer, storage, config, reasoningBank) {
        this.optimizer = optimizer;
        this.storage = storage;
        this.reasoningBank = reasoningBank;
        this.config = {
            max_concurrent: config?.max_concurrent || 3,
            retry_on_failure: config?.retry_on_failure ?? true,
            max_retries: config?.max_retries || 2,
            share_learning: config?.share_learning ?? true,
            load_balance: config?.load_balance ?? true
        };
    }
    /**
     * Train multiple experts in parallel
     */
    async trainExperts(tasks) {
        console.log(`\n🤖 Swarm Coordinator: Training ${tasks.length} experts`);
        console.log(`   Max concurrent: ${this.config.max_concurrent}`);
        console.log(`   Retry enabled: ${this.config.retry_on_failure}`);
        console.log(`   Share learning: ${this.config.share_learning}\n`);
        // Sort by priority
        if (this.config.load_balance) {
            tasks = this.sortByPriority(tasks);
        }
        // Add to queue
        this.queue = [...tasks];
        this.results.clear();
        // Process queue with concurrency control
        await this.processQueue();
        // Return results in original order
        return tasks.map(task => this.results.get(task.expert_role));
    }
    /**
     * Process training queue with concurrency control
     */
    async processQueue() {
        const promises = [];
        while (this.queue.length > 0 || this.activeWorkers > 0) {
            // Start new workers if under limit
            while (this.queue.length > 0 && this.activeWorkers < this.config.max_concurrent) {
                const task = this.queue.shift();
                this.activeWorkers++;
                const promise = this.trainExpert(task)
                    .finally(() => {
                    this.activeWorkers--;
                });
                promises.push(promise);
            }
            // Wait a bit before checking again
            if (this.queue.length > 0 || this.activeWorkers > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        // Wait for all to complete
        await Promise.all(promises);
    }
    /**
     * Train a single expert with retry logic
     */
    async trainExpert(task) {
        const startTime = Date.now();
        let retries = 0;
        while (retries <= this.config.max_retries) {
            try {
                console.log(`🔧 Training ${task.expert_role} (attempt ${retries + 1})`);
                // Apply shared learning if enabled
                if (this.config.share_learning && this.reasoningBank) {
                    task.request = await this.applySharedLearning(task);
                }
                // Run optimization
                const result = await this.optimizer.optimize(task.request);
                // Store result
                await this.storage.storeOptimization(result);
                // Store learning trajectory
                if (this.reasoningBank) {
                    await this.reasoningBank.storeOptimizationTrajectory(task.expert_role, result);
                }
                const duration = Date.now() - startTime;
                this.results.set(task.expert_role, {
                    expert_role: task.expert_role,
                    success: true,
                    result,
                    duration_ms: duration,
                    retries
                });
                console.log(`✅ ${task.expert_role} completed in ${duration}ms`);
                return;
            }
            catch (error) {
                retries++;
                if (retries > this.config.max_retries || !this.config.retry_on_failure) {
                    const duration = Date.now() - startTime;
                    this.results.set(task.expert_role, {
                        expert_role: task.expert_role,
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        duration_ms: duration,
                        retries: retries - 1
                    });
                    console.error(`❌ ${task.expert_role} failed after ${retries} attempts:`, error);
                    return;
                }
                console.warn(`⚠️  ${task.expert_role} failed, retrying (${retries}/${this.config.max_retries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            }
        }
    }
    /**
     * Apply shared learning from other experts
     */
    async applySharedLearning(task) {
        if (!this.reasoningBank)
            return task.request;
        // Get success patterns from all experts
        const insights = await this.reasoningBank.getInsights(task.expert_role);
        if (insights.total_trajectories === 0) {
            return task.request;
        }
        // Get successful configurations
        const successPatterns = await this.reasoningBank.getSuccessPatterns(task.expert_role);
        // Adjust config based on learned patterns
        const enhancedConfig = {
            ...task.request.config,
            // If previous optimizations succeeded with fewer trials, use that
            num_trials: Math.max(task.request.config?.num_trials || 30, Math.floor(30 * (1 + successPatterns.avg_improvement)))
        };
        console.log(`   📚 Applied shared learning: avg_improvement=${successPatterns.avg_improvement.toFixed(2)}`);
        return {
            ...task.request,
            config: enhancedConfig
        };
    }
    /**
     * Sort tasks by priority
     */
    sortByPriority(tasks) {
        const priorityMap = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1
        };
        return tasks.sort((a, b) => {
            const aPriority = priorityMap[a.priority || 'medium'];
            const bPriority = priorityMap[b.priority || 'medium'];
            return bPriority - aPriority;
        });
    }
    /**
     * Get swarm statistics
     */
    getStats() {
        const results = Array.from(this.results.values());
        const completed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const avgDuration = results.length > 0
            ? results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length
            : 0;
        const successRate = results.length > 0
            ? completed / results.length
            : 0;
        return {
            total_experts: results.length,
            completed,
            failed,
            in_progress: this.activeWorkers,
            avg_duration_ms: avgDuration,
            success_rate: successRate
        };
    }
    /**
     * Get detailed results
     */
    getResults() {
        return Array.from(this.results.values());
    }
}
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Create swarm coordinator instance
 */
export function createSwarmCoordinator(optimizer, storage, config, reasoningBank) {
    return new SwarmCoordinator(optimizer, storage, config, reasoningBank);
}
/**
 * Quick parallel training helper
 */
export async function trainExpertsParallel(experts, requestBuilder, optimizer, storage, maxConcurrent = 3) {
    const coordinator = createSwarmCoordinator(optimizer, storage, { max_concurrent: maxConcurrent });
    const tasks = experts.map(expert => ({
        expert_role: expert,
        request: requestBuilder(expert)
    }));
    return await coordinator.trainExperts(tasks);
}
