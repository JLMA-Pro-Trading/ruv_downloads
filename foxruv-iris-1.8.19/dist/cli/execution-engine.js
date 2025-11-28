/**
 * Smart Execution Engine
 *
 * Automatically uses agentic-flow + AgentDB for all operations
 * Configurable via .iris/config/settings.json
 */
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
/**
 * Smart Execution Engine
 */
export class SmartExecutionEngine {
    config = null;
    irisRoot;
    constructor(projectRoot = process.cwd()) {
        this.irisRoot = path.join(projectRoot, '.iris');
    }
    /**
     * Load execution configuration
     */
    async loadConfig() {
        if (this.config)
            return this.config;
        try {
            const settingsPath = path.join(this.irisRoot, 'config', 'settings.json');
            const content = await readFile(settingsPath, 'utf8');
            const settings = JSON.parse(content);
            this.config = {
                use_agentic_flow: settings.execution?.use_agentic_flow ?? true,
                use_agentdb: settings.execution?.use_agentdb ?? true,
                swarm_topology: settings.execution?.swarm_topology ?? 'mesh',
                max_agents: settings.execution?.max_agents ?? 5,
                enable_learning: settings.execution?.enable_learning ?? true,
                enable_caching: settings.execution?.enable_caching ?? true,
                track_all_operations: settings.execution?.track_all_operations ?? true
            };
            return this.config;
        }
        catch (error) {
            // Defaults if no config exists
            this.config = {
                use_agentic_flow: true,
                use_agentdb: true,
                swarm_topology: 'mesh',
                max_agents: 5,
                enable_learning: true,
                enable_caching: true,
                track_all_operations: true
            };
            return this.config;
        }
    }
    /**
     * Execute with smart defaults (automatically uses agentic-flow + AgentDB)
     */
    async execute(context) {
        const config = await this.loadConfig();
        const startTime = Date.now();
        console.log(chalk.gray(`🔧 Using: ${config.use_agentic_flow ? 'agentic-flow' : 'direct'} + ${config.use_agentdb ? 'AgentDB' : 'no tracking'}`));
        try {
            let result;
            if (config.use_agentic_flow) {
                // Use agentic-flow for execution
                result = await this.executeWithAgenticFlow(context, config);
            }
            else {
                // Direct execution (no swarm)
                result = await this.executeDirect(context);
            }
            // Track in AgentDB if enabled
            if (config.use_agentdb && config.track_all_operations) {
                await this.trackInAgentDB(context, result, Date.now() - startTime);
            }
            return {
                success: true,
                result,
                metrics: {
                    duration_ms: Date.now() - startTime,
                    agents_used: config.use_agentic_flow ? config.max_agents : 1
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                metrics: {
                    duration_ms: Date.now() - startTime
                }
            };
        }
    }
    /**
     * Execute using agentic-flow swarm
     */
    async executeWithAgenticFlow(context, config) {
        // Import agentic-flow dynamically
        const { initSwarm, executeTask } = await this.loadAgenticFlow();
        // Initialize swarm
        const swarm = await initSwarm({
            topology: config.swarm_topology,
            maxAgents: config.max_agents,
            enableLearning: config.enable_learning
        });
        // Execute task
        const result = await executeTask(swarm, {
            command: context.command,
            args: context.args,
            workingDir: context.workingDir
        });
        return result;
    }
    /**
     * Direct execution (no swarm)
     */
    async executeDirect(context) {
        // Direct execution logic
        return {
            command: context.command,
            args: context.args,
            executed: 'direct'
        };
    }
    /**
     * Track operation in AgentDB
     */
    async trackInAgentDB(context, result, duration) {
        try {
            const { getMcpTracker } = await import('./utils/agentdb-tracker.js');
            const tracker = getMcpTracker();
            await tracker.initialize();
            await tracker.trackInvocation({
                skillId: 'cli-execution',
                tool: context.command,
                args: context.args,
                timestamp: context.timestamp,
                success: true,
                latency: duration,
                result
            });
        }
        catch (error) {
            // AgentDB tracking is optional
            console.warn(chalk.yellow('⚠️  AgentDB tracking failed (non-fatal)'));
        }
    }
    /**
     * Load agentic-flow dynamically
     */
    async loadAgenticFlow() {
        try {
            // Try to import agentic-flow package
            const agenticFlow = await import('agentic-flow');
            return {
                initSwarm: agenticFlow.initSwarm || this.mockInitSwarm,
                executeTask: agenticFlow.executeTask || this.mockExecuteTask
            };
        }
        catch (error) {
            console.warn(chalk.yellow('⚠️  agentic-flow not available, using fallback'));
            return {
                initSwarm: this.mockInitSwarm,
                executeTask: this.mockExecuteTask
            };
        }
    }
    /**
     * Mock implementations (fallback when agentic-flow not available)
     */
    mockInitSwarm = async (options) => {
        console.log(chalk.gray(`  Mock swarm: ${options.topology} with ${options.maxAgents} agents`));
        return { id: 'mock-swarm', topology: options.topology };
    };
    mockExecuteTask = async (_swarm, task) => {
        console.log(chalk.gray(`  Mock execution: ${task.command}`));
        return { executed: true, mock: true, command: task.command };
    };
    /**
     * Update execution configuration
     */
    async updateConfig(updates) {
        const config = await this.loadConfig();
        const newConfig = { ...config, ...updates };
        // Save to settings.json
        const settingsPath = path.join(this.irisRoot, 'config', 'settings.json');
        try {
            const content = await readFile(settingsPath, 'utf8');
            const settings = JSON.parse(content);
            settings.execution = newConfig;
            await writeFile(settingsPath, JSON.stringify(settings, null, 2));
            this.config = newConfig;
            console.log(chalk.green('✓ Execution configuration updated'));
        }
        catch (error) {
            throw new Error(`Failed to update config: ${error}`);
        }
    }
    /**
     * Toggle agentic-flow on/off
     */
    async toggleAgenticFlow(enable) {
        await this.updateConfig({ use_agentic_flow: enable });
        console.log(chalk.blue(`agentic-flow ${enable ? chalk.green('enabled') : chalk.red('disabled')}`));
    }
    /**
     * Toggle AgentDB tracking on/off
     */
    async toggleAgentDB(enable) {
        await this.updateConfig({ use_agentdb: enable });
        console.log(chalk.blue(`AgentDB tracking ${enable ? chalk.green('enabled') : chalk.red('disabled')}`));
    }
    /**
     * Show current configuration
     */
    async showConfig() {
        const config = await this.loadConfig();
        console.log(chalk.blue('\n📋 Execution Configuration:\n'));
        console.log(`  ${config.use_agentic_flow ? chalk.green('✓') : chalk.gray('○')} agentic-flow`);
        console.log(`  ${config.use_agentdb ? chalk.green('✓') : chalk.gray('○')} AgentDB tracking`);
        console.log(`  ${config.enable_learning ? chalk.green('✓') : chalk.gray('○')} Learning enabled`);
        console.log(`  ${config.enable_caching ? chalk.green('✓') : chalk.gray('○')} Caching enabled`);
        console.log(chalk.gray('\nSwarm Configuration:'));
        console.log(`  Topology: ${config.swarm_topology}`);
        console.log(`  Max Agents: ${config.max_agents}`);
        console.log();
    }
}
/**
 * Global execution engine instance
 */
let globalEngine = null;
export function getExecutionEngine(projectRoot) {
    if (!globalEngine || projectRoot) {
        globalEngine = new SmartExecutionEngine(projectRoot);
    }
    return globalEngine;
}
/**
 * Convenient wrapper for executing with smart defaults
 */
export async function executeWithDefaults(command, args = [], workingDir = process.cwd()) {
    const engine = getExecutionEngine();
    return engine.execute({
        command,
        args,
        workingDir,
        timestamp: Date.now()
    });
}
