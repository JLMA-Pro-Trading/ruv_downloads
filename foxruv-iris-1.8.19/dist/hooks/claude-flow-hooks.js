/**
 * Claude Flow Integration Hooks for Iris Optimizer
 *
 * Provides intelligent coordination between Claude Flow's swarm orchestration
 * and Iris's self-improving optimization capabilities using ReasoningBank learning.
 */
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
export class ClaudeFlowHooks {
    memoryDir;
    sessionFile;
    config;
    constructor(rootPath = process.cwd()) {
        this.memoryDir = join(rootPath, '.swarm');
        this.sessionFile = join(this.memoryDir, 'session-state.json');
        // Load claude-flow config
        const configPath = join(rootPath, '.claude-flow.json');
        this.config = existsSync(configPath)
            ? JSON.parse(readFileSync(configPath, 'utf-8'))
            : {};
        // Ensure memory directory exists
        if (!existsSync(this.memoryDir)) {
            mkdirSync(this.memoryDir, { recursive: true });
        }
    }
    /**
     * Pre-Task Hook: Load optimization context from ReasoningBank
     * Runs before any optimization task to warm-start with learned patterns
     */
    async preTask(taskDescription, taskId) {
        const id = taskId || `task-${Date.now()}`;
        console.log(`[Claude Flow] Pre-task hook: ${id}`);
        try {
            // Initialize session state
            const sessionState = this.loadSessionState();
            sessionState.contexts.push({
                taskId: id,
                timestamp: Date.now(),
            });
            this.saveSessionState(sessionState);
            // Run claude-flow pre-task hook
            this.runClaudeFlowCommand('hooks pre-task', [
                '--description', taskDescription,
                '--session-id', sessionState.sessionId
            ]);
            // Load warm-start patterns from ReasoningBank if enabled
            if (this.config.reasoningbank?.warmStart?.enabled) {
                await this.loadWarmStartPatterns(taskDescription);
            }
            // Restore session context
            this.runClaudeFlowCommand('hooks session-restore', [
                '--session-id', sessionState.sessionId
            ]);
        }
        catch (error) {
            console.error('[Claude Flow] Pre-task hook error:', error);
            // Don't fail the task if hooks fail
        }
    }
    /**
     * Post-Edit Hook: Store optimization configuration in memory
     * Runs after file edits to track successful configurations
     */
    async postEdit(filePath, context) {
        console.log(`[Claude Flow] Post-edit hook: ${filePath}`);
        try {
            const sessionState = this.loadSessionState();
            const memoryKey = `swarm/iris/optimization/${context.taskId}`;
            // Store context in memory
            const memoryData = {
                file: filePath,
                context,
                timestamp: Date.now(),
                sessionId: sessionState.sessionId,
            };
            // Run claude-flow post-edit hook
            this.runClaudeFlowCommand('hooks post-edit', [
                '--file', filePath,
                '--memory-key', memoryKey
            ]);
            // Store in ReasoningBank for learning
            if (this.config.reasoningbank?.enabled) {
                await this.storeInReasoningBank(memoryKey, memoryData);
            }
            // Notify swarm of optimization update
            this.runClaudeFlowCommand('hooks notify', [
                '--message', `Optimization configuration updated: ${filePath}`
            ]);
        }
        catch (error) {
            console.error('[Claude Flow] Post-edit hook error:', error);
        }
    }
    /**
     * Post-Task Hook: Record task completion and outcomes
     * Trains ReasoningBank with success/failure patterns
     */
    async postTask(taskId, success, metrics) {
        console.log(`[Claude Flow] Post-task hook: ${taskId} (${success ? 'success' : 'failure'})`);
        try {
            const sessionState = this.loadSessionState();
            // Update context with results
            const context = sessionState.contexts.find(c => c.taskId === taskId);
            if (context) {
                context.metrics = metrics;
            }
            // Record decision outcome
            sessionState.decisions.push({
                decision: taskId,
                confidence: metrics?.confidence || 0.5,
                outcome: success ? 'success' : 'failure'
            });
            this.saveSessionState(sessionState);
            // Run claude-flow post-task hook
            this.runClaudeFlowCommand('hooks post-task', [
                '--task-id', taskId,
                '--success', success.toString()
            ]);
            // Train neural patterns if enabled
            if (this.config.neural?.enabled && this.config.neural?.training?.autoTrain) {
                await this.trainNeuralPatterns(taskId, success);
            }
            // Update ReasoningBank confidence
            if (this.config.reasoningbank?.enabled) {
                await this.updateReasoningBankConfidence(taskId, success);
            }
        }
        catch (error) {
            console.error('[Claude Flow] Post-task hook error:', error);
        }
    }
    /**
     * Session End Hook: Export metrics and persist learnings
     */
    async sessionEnd() {
        console.log('[Claude Flow] Session end hook');
        try {
            const sessionState = this.loadSessionState();
            // Calculate session metrics
            const metrics = {
                duration: Date.now() - sessionState.startTime,
                totalTasks: sessionState.contexts.length,
                successRate: this.calculateSuccessRate(sessionState),
                avgConfidence: this.calculateAverageConfidence(sessionState),
            };
            console.log('[Claude Flow] Session metrics:', metrics);
            // Run claude-flow session-end hook
            this.runClaudeFlowCommand('hooks session-end', [
                '--session-id', sessionState.sessionId,
                '--export-metrics', 'true'
            ]);
            // Persist session learnings
            await this.persistSessionLearnings(sessionState, metrics);
            // Clear session state
            this.clearSessionState();
        }
        catch (error) {
            console.error('[Claude Flow] Session end hook error:', error);
        }
    }
    /**
     * Load warm-start patterns from ReasoningBank
     */
    async loadWarmStartPatterns(taskDescription) {
        const { maxPatterns = 5, similarityThreshold = 0.75 } = this.config.reasoningbank?.warmStart || {};
        // Use claude-flow to retrieve similar patterns
        try {
            const result = this.runClaudeFlowCommand('memory retrieve', [
                '--namespace', this.config.reasoningbank.namespace,
                '--query', taskDescription,
                '--limit', maxPatterns.toString(),
                '--similarity', similarityThreshold.toString()
            ], true);
            if (result) {
                console.log(`[Claude Flow] Loaded ${maxPatterns} warm-start patterns`);
            }
        }
        catch (error) {
            console.warn('[Claude Flow] Could not load warm-start patterns:', error);
        }
    }
    /**
     * Store optimization data in ReasoningBank
     */
    async storeInReasoningBank(key, data) {
        try {
            this.runClaudeFlowCommand('memory store', [
                '--namespace', this.config.reasoningbank.namespace,
                '--key', key,
                '--value', JSON.stringify(data)
            ]);
        }
        catch (error) {
            console.warn('[Claude Flow] Could not store in ReasoningBank:', error);
        }
    }
    /**
     * Update confidence scores in ReasoningBank based on outcomes
     */
    async updateReasoningBankConfidence(taskId, success) {
        const { successBonus = 0.20, failurePenalty = 0.15 } = this.config.reasoningbank?.confidence || {};
        const adjustment = success ? successBonus : -failurePenalty;
        try {
            this.runClaudeFlowCommand('reasoningbank adjust-confidence', [
                '--task-id', taskId,
                '--adjustment', adjustment.toString()
            ]);
        }
        catch (error) {
            console.warn('[Claude Flow] Could not update confidence:', error);
        }
    }
    /**
     * Train neural patterns from task outcomes
     */
    async trainNeuralPatterns(taskId, success) {
        try {
            this.runClaudeFlowCommand('neural train', [
                '--task-id', taskId,
                '--outcome', success ? 'success' : 'failure',
                '--auto', 'true'
            ]);
        }
        catch (error) {
            console.warn('[Claude Flow] Could not train neural patterns:', error);
        }
    }
    /**
     * Persist session learnings for cross-session memory
     */
    async persistSessionLearnings(sessionState, metrics) {
        const learningsFile = join(this.memoryDir, 'learnings.jsonl');
        const learning = {
            sessionId: sessionState.sessionId,
            timestamp: Date.now(),
            metrics,
            decisions: sessionState.decisions,
            contexts: sessionState.contexts,
        };
        try {
            const line = JSON.stringify(learning) + '\n';
            writeFileSync(learningsFile, line, { flag: 'a' });
            console.log('[Claude Flow] Persisted session learnings');
        }
        catch (error) {
            console.warn('[Claude Flow] Could not persist learnings:', error);
        }
    }
    /**
     * Run claude-flow CLI command
     */
    runClaudeFlowCommand(command, args = [], returnOutput = false) {
        try {
            const cmd = `npx claude-flow@alpha ${command} ${args.join(' ')}`;
            const result = execSync(cmd, {
                encoding: 'utf-8',
                stdio: returnOutput ? 'pipe' : 'inherit'
            });
            return returnOutput ? result : null;
        }
        catch (error) {
            // Claude-flow might not be installed yet, that's okay
            if (!error.message?.includes('not found')) {
                console.warn(`[Claude Flow] Command failed: ${command}`, error.message);
            }
            return null;
        }
    }
    /**
     * Session state management
     */
    loadSessionState() {
        if (existsSync(this.sessionFile)) {
            try {
                return JSON.parse(readFileSync(this.sessionFile, 'utf-8'));
            }
            catch {
                // Invalid state, create new
            }
        }
        return {
            sessionId: `iris-${Date.now()}`,
            startTime: Date.now(),
            contexts: [],
            decisions: [],
        };
    }
    saveSessionState(state) {
        writeFileSync(this.sessionFile, JSON.stringify(state, null, 2));
    }
    clearSessionState() {
        if (existsSync(this.sessionFile)) {
            try {
                const state = this.loadSessionState();
                const archiveFile = join(this.memoryDir, `session-${state.sessionId}.json`);
                writeFileSync(archiveFile, JSON.stringify(state, null, 2));
                writeFileSync(this.sessionFile, JSON.stringify({
                    sessionId: `iris-${Date.now()}`,
                    startTime: Date.now(),
                    contexts: [],
                    decisions: [],
                }, null, 2));
            }
            catch (error) {
                console.warn('[Claude Flow] Could not archive session state:', error);
            }
        }
    }
    /**
     * Calculate metrics
     */
    calculateSuccessRate(state) {
        const successful = state.decisions.filter(d => d.outcome === 'success').length;
        return state.decisions.length > 0 ? successful / state.decisions.length : 0;
    }
    calculateAverageConfidence(state) {
        if (state.decisions.length === 0)
            return 0;
        const sum = state.decisions.reduce((acc, d) => acc + d.confidence, 0);
        return sum / state.decisions.length;
    }
}
// Export singleton instance
export const hooks = new ClaudeFlowHooks();
// Export convenience functions
export const preTask = (desc, id) => hooks.preTask(desc, id);
export const postEdit = (file, ctx) => hooks.postEdit(file, ctx);
export const postTask = (id, success, metrics) => hooks.postTask(id, success, metrics);
export const sessionEnd = () => hooks.sessionEnd();
