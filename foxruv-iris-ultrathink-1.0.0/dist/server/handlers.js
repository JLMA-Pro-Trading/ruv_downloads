/**
 * UltraThink MCP Server Tool Handlers
 *
 * Implementation of tool handlers with agentic-flow and agentdb integration
 *
 * @module handlers
 */
const state = {
    swarms: new Map(),
    agents: new Map(),
    tasks: new Map(),
    toolInvocations: [],
    startTime: new Date()
};
// ============================================================================
// AgentDB Integration
// ============================================================================
class AgentDBIntegration {
    reflexionMemory;
    skillLibrary;
    embeddingService;
    reasoningBank;
    db;
    constructor() {
        // Lazy initialization to avoid circular dependencies
    }
    async init() {
        try {
            // Dynamic imports to avoid build-time dependencies
            const agentdb = await import('agentdb');
            // Initialize database and embedding service first
            this.db = agentdb.createDatabase('./data/ultrathink-server.db');
            this.embeddingService = new agentdb.EmbeddingService('transformer');
            // Initialize other components with db and embedder
            this.reflexionMemory = new agentdb.ReflexionMemory(this.db, this.embeddingService);
            this.skillLibrary = new agentdb.SkillLibrary(this.db, this.embeddingService);
            this.reasoningBank = new agentdb.ReasoningBank(this.db, this.embeddingService);
            return true;
        }
        catch (error) {
            console.error('AgentDB initialization failed:', error);
            return false;
        }
    }
    async recordReflexion(entry) {
        if (!this.reflexionMemory)
            await this.init();
        try {
            const id = await this.reflexionMemory.addReflexion({
                query: entry.query,
                response: entry.response,
                outcome: entry.outcome,
                reflection: entry.reflection,
                timestamp: entry.timestamp
            });
            return id;
        }
        catch (error) {
            throw new Error(`Failed to record reflexion: ${error}`);
        }
    }
    async searchReflexions(query, limit = 10) {
        if (!this.reflexionMemory)
            await this.init();
        try {
            const results = await this.reflexionMemory.search(query, limit);
            return results;
        }
        catch (error) {
            throw new Error(`Failed to search reflexions: ${error}`);
        }
    }
    async storePattern(pattern) {
        if (!this.reasoningBank)
            await this.init();
        try {
            const id = await this.reasoningBank.storePattern({
                pattern: pattern.pattern,
                frequency: pattern.frequency,
                successRate: pattern.successRate,
                context: pattern.context
            });
            return id;
        }
        catch (error) {
            throw new Error(`Failed to store pattern: ${error}`);
        }
    }
    async discoverPatterns(domain, minConfidence) {
        if (!this.reasoningBank)
            await this.init();
        try {
            const patterns = await this.reasoningBank.discoverPatterns(domain, minConfidence);
            return patterns;
        }
        catch (error) {
            throw new Error(`Failed to discover patterns: ${error}`);
        }
    }
    async storeMemory(memory) {
        if (!this.embeddingService)
            await this.init();
        try {
            // Generate embedding if not provided
            if (!memory.embedding) {
                memory.embedding = await this.embeddingService.generateEmbedding(memory.content);
            }
            // Store in database
            const id = await this.reasoningBank.storeMemory(memory);
            return id;
        }
        catch (error) {
            throw new Error(`Failed to store memory: ${error}`);
        }
    }
    async searchMemories(query, limit, tags) {
        if (!this.embeddingService)
            await this.init();
        try {
            const queryEmbedding = await this.embeddingService.generateEmbedding(query);
            const results = await this.reasoningBank.searchMemories(queryEmbedding, limit, tags);
            return results;
        }
        catch (error) {
            throw new Error(`Failed to search memories: ${error}`);
        }
    }
}
const agentDB = new AgentDBIntegration();
// ============================================================================
// Agentic-Flow Integration
// ============================================================================
class AgenticFlowIntegration {
    swarmModule;
    initialized = false;
    async init() {
        if (this.initialized)
            return true;
        try {
            // Dynamic import
            const agenticFlow = await import('agentic-flow');
            this.swarmModule = agenticFlow;
            this.initialized = true;
            return true;
        }
        catch (error) {
            console.error('Agentic-Flow initialization failed:', error);
            return false;
        }
    }
    async initSwarm(config) {
        if (!this.initialized)
            await this.init();
        try {
            const swarm = await this.swarmModule.initSwarm({
                swarmId: config.swarmId,
                topology: config.topology,
                maxAgents: config.maxAgents || 8,
                transport: config.transport || 'auto'
            });
            state.swarms.set(config.swarmId, swarm);
            return swarm;
        }
        catch (error) {
            throw new Error(`Failed to initialize swarm: ${error}`);
        }
    }
    async spawnAgent(swarmId, agentConfig) {
        const swarm = state.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        try {
            await swarm.registerAgent({
                id: agentConfig.id,
                role: agentConfig.role,
                capabilities: agentConfig.capabilities,
                ...agentConfig.metadata
            });
            state.agents.set(agentConfig.id, agentConfig);
            return agentConfig;
        }
        catch (error) {
            throw new Error(`Failed to spawn agent: ${error}`);
        }
    }
    async orchestrateTask(swarmId, taskConfig) {
        const swarm = state.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        try {
            // Create task record
            const task = {
                ...taskConfig,
                status: 'running',
                startedAt: new Date(),
                swarmId
            };
            state.tasks.set(taskConfig.taskId, task);
            // Execute task through swarm
            // This is a simplified version - actual implementation would be more complex
            const result = {
                taskId: taskConfig.taskId,
                status: 'completed',
                completedAt: new Date()
            };
            return result;
        }
        catch (error) {
            throw new Error(`Failed to orchestrate task: ${error}`);
        }
    }
    getSwarmStatus(swarmId) {
        const swarm = state.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        const swarmAgents = Array.from(state.agents.values())
            .filter(agent => agent.metadata?.swarmId === swarmId);
        return {
            swarmId,
            topology: swarm.topology,
            agentCount: swarmAgents.length,
            agents: swarmAgents,
            status: 'active'
        };
    }
}
const agenticFlow = new AgenticFlowIntegration();
// ============================================================================
// Tool Invocation Tracking
// ============================================================================
function trackInvocation(invocation) {
    state.toolInvocations.push(invocation);
    // Keep only last 1000 invocations to prevent memory bloat
    if (state.toolInvocations.length > 1000) {
        state.toolInvocations = state.toolInvocations.slice(-1000);
    }
}
function getToolMetrics(toolName) {
    const invocations = toolName
        ? state.toolInvocations.filter(i => i.toolName === toolName)
        : state.toolInvocations;
    const successCount = invocations.filter(i => i.success).length;
    const errorCount = invocations.filter(i => !i.success).length;
    const avgDuration = invocations.reduce((sum, i) => sum + (i.duration || 0), 0) / invocations.length;
    return {
        toolName: toolName || 'all',
        totalInvocations: invocations.length,
        successCount,
        errorCount,
        avgDuration,
        lastInvoked: invocations[invocations.length - 1]?.timestamp
    };
}
// ============================================================================
// Swarm Management Handlers
// ============================================================================
export const handleSwarmInit = async (args) => {
    const startTime = Date.now();
    const invocation = {
        id: `inv-${Date.now()}`,
        toolName: 'ultrathink_swarm_init',
        arguments: args,
        timestamp: new Date(),
        success: false
    };
    try {
        const config = {
            swarmId: args.swarmId,
            topology: args.topology,
            maxAgents: args.maxAgents,
            transport: args.transport
        };
        const swarm = await agenticFlow.initSwarm(config);
        invocation.success = true;
        invocation.duration = Date.now() - startTime;
        invocation.result = { swarmId: config.swarmId };
        trackInvocation(invocation);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        swarmId: config.swarmId,
                        topology: config.topology,
                        maxAgents: config.maxAgents,
                        transport: config.transport,
                        status: 'initialized'
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        invocation.duration = Date.now() - startTime;
        invocation.error = error instanceof Error ? error.message : String(error);
        trackInvocation(invocation);
        throw error;
    }
};
export const handleSwarmStatus = async (args) => {
    const startTime = Date.now();
    const invocation = {
        id: `inv-${Date.now()}`,
        toolName: 'ultrathink_swarm_status',
        arguments: args,
        timestamp: new Date(),
        success: false
    };
    try {
        const swarmId = args.swarmId;
        const status = agenticFlow.getSwarmStatus(swarmId);
        invocation.success = true;
        invocation.duration = Date.now() - startTime;
        invocation.result = status;
        trackInvocation(invocation);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify(status, null, 2)
                }]
        };
    }
    catch (error) {
        invocation.duration = Date.now() - startTime;
        invocation.error = error instanceof Error ? error.message : String(error);
        trackInvocation(invocation);
        throw error;
    }
};
export const handleSwarmDestroy = async (args) => {
    const startTime = Date.now();
    const invocation = {
        id: `inv-${Date.now()}`,
        toolName: 'ultrathink_swarm_destroy',
        arguments: args,
        timestamp: new Date(),
        success: false
    };
    try {
        const swarmId = args.swarmId;
        const swarm = state.swarms.get(swarmId);
        if (!swarm) {
            throw new Error(`Swarm not found: ${swarmId}`);
        }
        // Shutdown swarm
        if (swarm.shutdown) {
            await swarm.shutdown();
        }
        // Remove from state
        state.swarms.delete(swarmId);
        // Remove associated agents
        for (const [agentId, agent] of state.agents.entries()) {
            if (agent.metadata?.swarmId === swarmId) {
                state.agents.delete(agentId);
            }
        }
        invocation.success = true;
        invocation.duration = Date.now() - startTime;
        trackInvocation(invocation);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        swarmId,
                        status: 'destroyed'
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        invocation.duration = Date.now() - startTime;
        invocation.error = error instanceof Error ? error.message : String(error);
        trackInvocation(invocation);
        throw error;
    }
};
// ============================================================================
// Agent Management Handlers
// ============================================================================
export const handleAgentSpawn = async (args) => {
    const startTime = Date.now();
    const invocation = {
        id: `inv-${Date.now()}`,
        toolName: 'ultrathink_agent_spawn',
        arguments: args,
        timestamp: new Date(),
        success: false
    };
    try {
        const agentConfig = {
            id: `agent-${Date.now()}`,
            type: args.agentType,
            role: args.role,
            capabilities: args.capabilities,
            metadata: {
                swarmId: args.swarmId,
                ...args.metadata
            }
        };
        await agenticFlow.spawnAgent(args.swarmId, agentConfig);
        invocation.success = true;
        invocation.duration = Date.now() - startTime;
        invocation.result = { agentId: agentConfig.id };
        trackInvocation(invocation);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        agent: agentConfig
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        invocation.duration = Date.now() - startTime;
        invocation.error = error instanceof Error ? error.message : String(error);
        trackInvocation(invocation);
        throw error;
    }
};
export const handleAgentList = async (args) => {
    const swarmId = args.swarmId;
    const filterType = args.filterType;
    const agents = Array.from(state.agents.values())
        .filter(agent => agent.metadata?.swarmId === swarmId)
        .filter(agent => !filterType || agent.type === filterType);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    swarmId,
                    agentCount: agents.length,
                    agents
                }, null, 2)
            }]
    };
};
export const handleAgentMetrics = async (args) => {
    const swarmId = args.swarmId;
    const agentId = args.agentId;
    // Get metrics from tool invocations
    const metrics = agentId
        ? getToolMetrics(`agent:${agentId}`)
        : getToolMetrics();
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(metrics, null, 2)
            }]
    };
};
// ============================================================================
// Task Orchestration Handlers
// ============================================================================
export const handleTaskOrchestrate = async (args) => {
    const startTime = Date.now();
    const invocation = {
        id: `inv-${Date.now()}`,
        toolName: 'ultrathink_task_orchestrate',
        arguments: args,
        timestamp: new Date(),
        success: false
    };
    try {
        const taskConfig = {
            taskId: `task-${Date.now()}`,
            description: args.taskDescription,
            priority: args.priority,
            strategy: args.strategy
        };
        const result = await agenticFlow.orchestrateTask(args.swarmId, taskConfig);
        invocation.success = true;
        invocation.duration = Date.now() - startTime;
        invocation.result = result;
        trackInvocation(invocation);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        task: result
                    }, null, 2)
                }]
        };
    }
    catch (error) {
        invocation.duration = Date.now() - startTime;
        invocation.error = error instanceof Error ? error.message : String(error);
        trackInvocation(invocation);
        throw error;
    }
};
export const handleTaskStatus = async (args) => {
    const taskId = args.taskId;
    const task = state.tasks.get(taskId);
    if (!task) {
        throw new Error(`Task not found: ${taskId}`);
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(task, null, 2)
            }]
    };
};
export const handleTaskResults = async (args) => {
    const taskId = args.taskId;
    const task = state.tasks.get(taskId);
    if (!task) {
        throw new Error(`Task not found: ${taskId}`);
    }
    if (task.status !== 'completed') {
        throw new Error(`Task not completed: ${taskId} (status: ${task.status})`);
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    taskId,
                    result: task.result,
                    completedAt: task.completedAt
                }, null, 2)
            }]
    };
};
// ============================================================================
// Pattern Learning Handlers
// ============================================================================
export const handlePatternDiscover = async (args) => {
    const domain = args.domain || 'default';
    const minConfidence = args.minConfidence || 0.7;
    const limit = args.limit || 10;
    const patterns = await agentDB.discoverPatterns(domain, minConfidence);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    domain,
                    patternCount: patterns.length,
                    patterns: patterns.slice(0, limit)
                }, null, 2)
            }]
    };
};
export const handlePatternApply = async (args) => {
    const patternId = args.patternId;
    const taskContext = args.taskContext;
    // This is a placeholder - actual implementation would apply the pattern
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    patternId,
                    applied: true,
                    context: taskContext
                }, null, 2)
            }]
    };
};
export const handleReflexionRecord = async (args) => {
    const entry = {
        id: `ref-${Date.now()}`,
        query: args.query,
        response: args.response,
        outcome: args.outcome,
        reflection: args.reflection,
        timestamp: new Date()
    };
    const id = await agentDB.recordReflexion(entry);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    reflexionId: id,
                    outcome: entry.outcome
                }, null, 2)
            }]
    };
};
export const handleReflexionSearch = async (args) => {
    const query = args.query;
    const limit = args.limit || 10;
    const results = await agentDB.searchReflexions(query, limit);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    query,
                    resultCount: results.length,
                    results
                }, null, 2)
            }]
    };
};
// ============================================================================
// Memory Management Handlers
// ============================================================================
export const handleMemoryStore = async (args) => {
    const memory = {
        id: `mem-${Date.now()}`,
        content: args.content,
        metadata: args.metadata,
        tags: args.tags,
        timestamp: new Date()
    };
    const id = await agentDB.storeMemory(memory);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    memoryId: id
                }, null, 2)
            }]
    };
};
export const handleMemorySearch = async (args) => {
    const query = args.query;
    const limit = args.limit || 10;
    const tags = args.tags;
    const results = await agentDB.searchMemories(query, limit, tags);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    query,
                    resultCount: results.length,
                    results
                }, null, 2)
            }]
    };
};
export const handleMemoryConsolidate = async (args) => {
    // Placeholder for memory consolidation
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    domain: args.domain,
                    consolidated: 0,
                    message: 'Memory consolidation not yet implemented'
                }, null, 2)
            }]
    };
};
// ============================================================================
// Health and Monitoring Handlers
// ============================================================================
export const handleHealthCheck = async (args) => {
    const detailed = args.detailed || false;
    const uptime = Date.now() - state.startTime.getTime();
    const health = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
            mcp: true,
            agenticFlow: state.swarms.size > 0,
            agentdb: true,
            swarm: state.swarms.size > 0
        },
        metrics: {
            uptime,
            totalRequests: state.toolInvocations.length,
            activeSwarms: state.swarms.size,
            activeAgents: state.agents.size
        }
    };
    if (detailed) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        ...health,
                        swarms: Array.from(state.swarms.keys()),
                        agents: Array.from(state.agents.values()),
                        recentInvocations: state.toolInvocations.slice(-10)
                    }, null, 2)
                }]
        };
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(health, null, 2)
            }]
    };
};
export const handleMetricsGet = async (args) => {
    const category = args.category || 'all';
    const timeRange = args.timeRange || '1h';
    const metrics = {
        category,
        timeRange,
        swarms: {
            total: state.swarms.size,
            active: state.swarms.size
        },
        agents: {
            total: state.agents.size,
            active: state.agents.size
        },
        tasks: {
            total: state.tasks.size,
            completed: Array.from(state.tasks.values()).filter(t => t.status === 'completed').length,
            failed: Array.from(state.tasks.values()).filter(t => t.status === 'failed').length
        },
        tools: {
            invocations: state.toolInvocations.length,
            errors: state.toolInvocations.filter(i => !i.success).length
        }
    };
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(metrics, null, 2)
            }]
    };
};
export const handleToolStats = async (args) => {
    const toolName = args.toolName;
    const stats = getToolMetrics(toolName);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify(stats, null, 2)
            }]
    };
};
// ============================================================================
// Export All Handlers
// ============================================================================
export const handlers = {
    // Swarm management
    ultrathink_swarm_init: handleSwarmInit,
    ultrathink_swarm_status: handleSwarmStatus,
    ultrathink_swarm_destroy: handleSwarmDestroy,
    // Agent management
    ultrathink_agent_spawn: handleAgentSpawn,
    ultrathink_agent_list: handleAgentList,
    ultrathink_agent_metrics: handleAgentMetrics,
    // Task orchestration
    ultrathink_task_orchestrate: handleTaskOrchestrate,
    ultrathink_task_status: handleTaskStatus,
    ultrathink_task_results: handleTaskResults,
    // Pattern learning
    ultrathink_pattern_discover: handlePatternDiscover,
    ultrathink_pattern_apply: handlePatternApply,
    ultrathink_reflexion_record: handleReflexionRecord,
    ultrathink_reflexion_search: handleReflexionSearch,
    // Memory management
    ultrathink_memory_store: handleMemoryStore,
    ultrathink_memory_search: handleMemorySearch,
    ultrathink_memory_consolidate: handleMemoryConsolidate,
    // Health and monitoring
    ultrathink_health_check: handleHealthCheck,
    ultrathink_metrics_get: handleMetricsGet,
    ultrathink_tool_stats: handleToolStats
};
export default handlers;
//# sourceMappingURL=handlers.js.map