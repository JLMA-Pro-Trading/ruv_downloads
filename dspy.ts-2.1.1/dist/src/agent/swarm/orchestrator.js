"use strict";
/**
 * Swarm Orchestrator
 *
 * Coordinates execution of multiple agents with handoffs
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwarmOrchestrator = exports.DEFAULT_SWARM_CONFIG = void 0;
const inversify_1 = require("inversify");
const pino_1 = __importDefault(require("pino"));
/**
 * Default swarm configuration
 */
exports.DEFAULT_SWARM_CONFIG = {
    defaultMaxHandoffs: 10,
    defaultTimeout: 60000, // 1 minute
    enableLogging: true,
    maxConcurrentTasks: 100,
};
let SwarmOrchestrator = class SwarmOrchestrator {
    constructor(config = {}) {
        this.agents = new Map();
        this.activeTasks = new Map();
        this.config = Object.assign(Object.assign({}, exports.DEFAULT_SWARM_CONFIG), config);
        this.logger = (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info',
            name: 'swarm-orchestrator',
            enabled: this.config.enableLogging,
        });
    }
    /**
     * Register an agent with the swarm
     */
    addAgent(agent) {
        this.agents.set(agent.id, agent);
        this.logger.info('Agent registered', {
            id: agent.id,
            name: agent.name,
            handoffs: agent.handoffs.length,
        });
    }
    /**
     * Remove an agent from the swarm
     */
    removeAgent(agentId) {
        this.agents.delete(agentId);
        this.logger.info('Agent removed', { id: agentId });
    }
    /**
     * Get an agent by ID
     */
    getAgent(agentId) {
        return this.agents.get(agentId);
    }
    /**
     * Execute a task through the swarm
     */
    async execute(task) {
        // Check concurrent task limit
        if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
            throw new Error('Maximum concurrent tasks reached');
        }
        const { id, input, startAgent, maxHandoffs = this.config.defaultMaxHandoffs, timeout = this.config.defaultTimeout, context = new Map(), } = task;
        this.logger.info('Executing task', {
            taskId: id,
            startAgent,
            maxHandoffs,
        });
        const startTime = Date.now();
        const trace = [];
        try {
            // Determine starting agent
            let currentAgentId = startAgent || this.getDefaultAgent();
            if (!currentAgentId) {
                throw new Error('No starting agent specified and no default available');
            }
            let currentInput = input;
            let handoffCount = 0;
            // Execute agent loop with handoffs
            while (handoffCount <= maxHandoffs) {
                const agent = this.agents.get(currentAgentId);
                if (!agent) {
                    throw new Error(`Agent not found: ${currentAgentId}`);
                }
                // Check timeout
                if (Date.now() - startTime > timeout) {
                    throw new Error('Task timeout exceeded');
                }
                // Execute agent
                const execution = await this.executeAgent(agent, currentInput, context);
                trace.push(execution);
                // Check if agent suggests handoff
                if (execution.handoffTo) {
                    currentAgentId = execution.handoffTo;
                    currentInput = execution.output;
                    handoffCount++;
                    this.logger.debug('Handoff', {
                        from: agent.id,
                        to: currentAgentId,
                        count: handoffCount,
                    });
                    continue;
                }
                // No handoff, task complete
                const duration = Date.now() - startTime;
                this.logger.info('Task completed', {
                    taskId: id,
                    duration,
                    handoffs: handoffCount,
                });
                return {
                    taskId: id,
                    output: execution.output,
                    success: execution.success,
                    trace,
                    duration,
                };
            }
            // Max handoffs exceeded
            throw new Error(`Maximum handoffs (${maxHandoffs}) exceeded`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Task failed', {
                taskId: id,
                duration,
                error,
            });
            return {
                taskId: id,
                output: null,
                success: false,
                trace,
                duration,
                error: error,
            };
        }
        finally {
            this.activeTasks.delete(id);
        }
    }
    /**
     * Execute a single agent
     */
    async executeAgent(agent, input, context) {
        const startTime = Date.now();
        try {
            this.logger.debug('Executing agent', {
                id: agent.id,
                name: agent.name,
            });
            // Merge agent context with task context
            const mergedContext = new Map([...context, ...agent.context]);
            // Execute routine
            const result = await agent.routine.execute(input, mergedContext);
            // Update agent context
            agent.context = result.context;
            // Check for handoff conditions
            const handoffTo = await this.checkHandoffs(agent, input, result.context);
            const duration = Date.now() - startTime;
            return {
                agentId: agent.id,
                agentName: agent.name,
                input,
                output: result.output,
                success: result.success,
                duration,
                handoffTo: handoffTo || result.handoff,
                timestamp: new Date(),
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Agent execution failed', {
                agentId: agent.id,
                error,
            });
            return {
                agentId: agent.id,
                agentName: agent.name,
                input,
                output: null,
                success: false,
                duration,
                timestamp: new Date(),
            };
        }
    }
    /**
     * Check if any handoff conditions are met
     */
    async checkHandoffs(agent, input, context) {
        for (const handoff of agent.handoffs) {
            try {
                if (handoff.condition(context, input)) {
                    this.logger.debug('Handoff condition met', {
                        from: agent.id,
                        to: handoff.targetAgent,
                    });
                    // Transfer context variables
                    this.transferContext(context, handoff.transferContext);
                    return handoff.targetAgent;
                }
            }
            catch (error) {
                this.logger.error('Handoff condition check failed', {
                    from: agent.id,
                    to: handoff.targetAgent,
                    error,
                });
            }
        }
        return undefined;
    }
    /**
     * Transfer context variables for handoff
     */
    transferContext(context, variables) {
        // In this implementation, context is shared,
        // but we could filter to only transfer specified variables
        this.logger.debug('Transferring context', { variables });
    }
    /**
     * Get default agent (first registered agent)
     */
    getDefaultAgent() {
        const agents = Array.from(this.agents.values());
        return agents.length > 0 ? agents[0].id : undefined;
    }
    /**
     * Get orchestrator statistics
     */
    getStats() {
        return {
            totalAgents: this.agents.size,
            activeTasks: this.activeTasks.size,
            agents: Array.from(this.agents.values()).map((a) => ({
                id: a.id,
                name: a.name,
                handoffs: a.handoffs.length,
            })),
        };
    }
};
exports.SwarmOrchestrator = SwarmOrchestrator;
exports.SwarmOrchestrator = SwarmOrchestrator = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [Object])
], SwarmOrchestrator);
//# sourceMappingURL=orchestrator.js.map