/**
 * AgentDB Optimizer Storage
 *
 * Persistent storage layer for DSPy optimizations using AgentDB's ReasoningBank.
 * Stores optimized signatures, few-shot examples, and performance metrics for
 * continuous learning and self-improvement.
 *
 * Architecture:
 * - Training: Python MIPROv2 → Store in AgentDB
 * - Production: Load optimized prompts from AgentDB (zero Python)
 * - Learning: Track quality improvements over time
 *
 * @module agentdb-optimizer-storage
 * @version 1.0.0
 */
import { ReasoningBankManager } from './reasoning-bank.js';
import path from 'path';
import fs from 'fs/promises';
// ============================================================================
// AgentDB Optimizer Storage
// ============================================================================
export class AgentDBOptimizerStorage {
    reasoningBank = null;
    storagePath;
    initialized = false;
    constructor(options = {}) {
        this.storagePath = options.agentdbPath || './data/dspy-optimizations.agentdb';
        if (options.autoInit) {
            this.initialize().catch(error => {
                console.error('Failed to initialize AgentDB:', error);
            });
        }
    }
    /**
     * Initialize AgentDB and ReasoningBank
     */
    async initialize() {
        if (this.initialized)
            return;
        console.log(`🔌 Initializing AgentDB Optimizer Storage...`);
        console.log(`   Path: ${this.storagePath}`);
        try {
            // Ensure directory exists
            const dir = path.dirname(this.storagePath);
            await fs.mkdir(dir, { recursive: true });
            // Initialize ReasoningBank with AgentDB
            this.reasoningBank = new ReasoningBankManager(this.storagePath);
            this.initialized = true;
            console.log(`✅ AgentDB Optimizer Storage initialized with ReasoningBank\n`);
        }
        catch (error) {
            console.error(`❌ AgentDB initialization failed: ${error}`);
            throw error;
        }
    }
    /**
     * Store optimization result in AgentDB
     */
    async storeOptimization(optimization, metadata) {
        if (!this.initialized) {
            await this.initialize();
        }
        const expertRole = optimization.expert_role;
        const version = optimization.version;
        const storagePath = `experts/${expertRole}/optimizations/${version}`;
        console.log(`💾 Storing optimization in AgentDB...`);
        console.log(`   Expert: ${expertRole}`);
        console.log(`   Version: ${version}`);
        console.log(`   Path: ${storagePath}`);
        try {
            const stored = {
                expert_role: expertRole,
                version: version,
                signature: optimization.optimized_signature,
                few_shot_examples: optimization.few_shot_examples,
                performance_metrics: {
                    quality_score: optimization.quality_after,
                    baseline_quality: optimization.quality_before,
                    improvement: optimization.improvement,
                    num_examples: optimization.performance_metrics.num_examples,
                    num_demos: optimization.performance_metrics.num_demos
                },
                metadata: {
                    training_timestamp: optimization.timestamp,
                    trials_completed: optimization.trials_completed,
                    lm_provider: metadata?.lm_provider || 'anthropic',
                    lm_model: metadata?.lm_model || 'claude-sonnet-4-5-20250929',
                    storage_timestamp: new Date().toISOString()
                }
            };
            // Store in ReasoningBank or fallback to file-based storage
            if (this.reasoningBank) {
                try {
                    // Store optimization trajectory in AgentDB
                    await this.reasoningBank.storeOptimizationTrajectory(expertRole, optimization);
                    // Also store as file for backward compatibility
                    await this.storeToFile(storagePath, stored);
                }
                catch (error) {
                    console.warn(`⚠️ ReasoningBank storage failed, using file fallback: ${error}`);
                    await this.storeToFile(storagePath, stored);
                }
            }
            else {
                await this.storeToFile(storagePath, stored);
            }
            // Update learning trajectory (if LearningSystem is available)
            await this.updateLearningTrajectory(expertRole, optimization);
            console.log(`✅ Optimization stored successfully`);
            console.log(`   Quality: ${(optimization.quality_before * 100).toFixed(1)}% → ${(optimization.quality_after * 100).toFixed(1)}%`);
            console.log(`   Improvement: ${(optimization.improvement * 100).toFixed(1)}%`);
            console.log(`   Demos: ${optimization.few_shot_examples.length}\n`);
            return {
                stored: true,
                version: version,
                storage_path: storagePath
            };
        }
        catch (error) {
            console.error(`❌ Storage failed: ${error}`);
            return {
                stored: false,
                version: version,
                storage_path: storagePath
            };
        }
    }
    /**
     * Load optimization from AgentDB
     */
    async loadOptimization(expertRole, version) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            // If no version specified, load latest
            if (!version) {
                const history = await this.getOptimizationHistory(expertRole);
                if (!history)
                    return null;
                version = history.latest_version;
            }
            const storagePath = `experts/${expertRole}/optimizations/${version}`;
            if (this.reasoningBank) {
                // return await this.reasoningBank.load(storagePath)
                return await this.loadFromFile(storagePath);
            }
            else {
                return await this.loadFromFile(storagePath);
            }
        }
        catch (error) {
            console.error(`Failed to load optimization: ${error}`);
            return null;
        }
    }
    /**
     * Get optimization history for an expert
     */
    async getOptimizationHistory(expertRole) {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            // Scan file directory for versions
            const versions = await this.listVersions(expertRole);
            if (versions.length === 0)
                return null;
            // Sort by version number (1.x.0 format)
            versions.sort((a, b) => {
                const aNum = parseInt(a.version.split('.')[1]);
                const bNum = parseInt(b.version.split('.')[1]);
                return bNum - aNum;
            });
            const bestVersion = versions.reduce((best, current) => current.quality_score > best.quality_score ? current : best);
            const totalImprovements = versions.reduce((sum, v) => sum + v.improvement, 0);
            return {
                expert_role: expertRole,
                versions: versions,
                best_version: bestVersion.version,
                latest_version: versions[0].version,
                total_improvements: totalImprovements
            };
        }
        catch (error) {
            console.error(`Failed to get optimization history: ${error}`);
            return null;
        }
    }
    /**
     * Update learning trajectory in AgentDB (if ReasoningBank is available)
     */
    async updateLearningTrajectory(expertRole, optimization) {
        if (!this.reasoningBank)
            return;
        try {
            // Learning trajectory tracking with ReasoningBank
            const trajectory = {
                id: `opt-${expertRole}-${Date.now()}`,
                timestamp: new Date().toISOString(),
                expert_role: expertRole,
                context: {
                    expert_role: expertRole,
                    version: optimization.version,
                    trials: optimization.trials_completed
                },
                action: 'mipro_optimization',
                outcome: {
                    quality_improvement: optimization.improvement,
                    quality_before: optimization.quality_before,
                    quality_after: optimization.quality_after,
                    num_demos: optimization.few_shot_examples.length
                },
                verdict: (optimization.improvement > 0.10 ? 'success' : 'partial'),
                confidence: optimization.quality_after,
                metadata: {
                    timestamp: optimization.timestamp,
                    num_examples: optimization.performance_metrics.num_examples
                }
            };
            // Store trajectory in ReasoningBank
            await this.reasoningBank.storeTrajectory(trajectory);
            console.log(`   📈 Learning trajectory updated in ReasoningBank`);
        }
        catch (error) {
            console.warn(`   ⚠️ Failed to update learning trajectory: ${error}`);
        }
    }
    /**
     * File-based storage fallback
     */
    async storeToFile(path, data) {
        const fullPath = `${this.storagePath}/${path}.json`;
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
    }
    /**
     * File-based loading fallback
     */
    async loadFromFile(path) {
        try {
            const fullPath = `${this.storagePath}/${path}.json`;
            const content = await fs.readFile(fullPath, 'utf-8');
            return JSON.parse(content);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * List versions for an expert (file-based)
     */
    async listVersions(expertRole) {
        try {
            const expertPath = `${this.storagePath}/experts/${expertRole}/optimizations`;
            const files = await fs.readdir(expertPath);
            const versions = [];
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                const content = await fs.readFile(`${expertPath}/${file}`, 'utf-8');
                const optimization = JSON.parse(content);
                versions.push({
                    version: optimization.version,
                    quality_score: optimization.performance_metrics.quality_score,
                    improvement: optimization.performance_metrics.improvement,
                    timestamp: optimization.metadata.training_timestamp
                });
            }
            return versions;
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Close ReasoningBank database connections
     */
    close() {
        if (this.reasoningBank) {
            this.reasoningBank.close();
        }
    }
    /**
     * Get statistics across all experts
     */
    async getGlobalStats() {
        if (!this.initialized) {
            await this.initialize();
        }
        try {
            const expertsPath = `${this.storagePath}/experts`;
            const experts = await fs.readdir(expertsPath);
            let totalOptimizations = 0;
            let totalImprovement = 0;
            let bestExpert = { role: '', improvement: 0 };
            let latestTimestamp = '';
            for (const expertRole of experts) {
                const history = await this.getOptimizationHistory(expertRole);
                if (!history)
                    continue;
                totalOptimizations += history.versions.length;
                totalImprovement += history.total_improvements;
                const bestVersion = history.versions.find(v => v.version === history.best_version);
                if (bestVersion && bestVersion.improvement > bestExpert.improvement) {
                    bestExpert = { role: expertRole, improvement: bestVersion.improvement };
                }
                const latest = history.versions[0];
                if (latest.timestamp > latestTimestamp) {
                    latestTimestamp = latest.timestamp;
                }
            }
            return {
                total_experts_trained: experts.length,
                total_optimizations: totalOptimizations,
                avg_improvement: totalImprovement / totalOptimizations,
                best_expert: bestExpert.role,
                latest_training: latestTimestamp
            };
        }
        catch (error) {
            console.error(`Failed to get global stats: ${error}`);
            return {
                total_experts_trained: 0,
                total_optimizations: 0,
                avg_improvement: 0,
                best_expert: 'none',
                latest_training: ''
            };
        }
    }
}
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Create AgentDB optimizer storage instance
 */
export function createOptimizerStorage(agentdbPath) {
    return new AgentDBOptimizerStorage({
        agentdbPath,
        autoInit: true
    });
}
/**
 * Store optimization with automatic initialization
 */
export async function storeOptimization(optimization, agentdbPath) {
    const storage = createOptimizerStorage(agentdbPath);
    const result = await storage.storeOptimization(optimization);
    return result.stored;
}
/**
 * Load latest optimization for expert
 */
export async function loadOptimization(expertRole, agentdbPath) {
    const storage = createOptimizerStorage(agentdbPath);
    return await storage.loadOptimization(expertRole);
}
