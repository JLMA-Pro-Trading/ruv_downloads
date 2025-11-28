"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2BAgentRunner = exports.DEFAULT_E2B_RUNNER_CONFIG = void 0;
exports.createE2BRunner = createE2BRunner;
exports.isE2BAvailable = isE2BAvailable;
const code_interpreter_1 = require("@e2b/code-interpreter");
exports.DEFAULT_E2B_RUNNER_CONFIG = {
    maxConcurrency: 10,
    enableStreaming: true,
    timeout: 120000,
    verbose: false,
    templateId: 'base',
    autoScaling: {
        enabled: true,
        minInstances: 0,
        maxInstances: 100,
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
    },
    regions: ['us-east', 'eu-west'],
    agentdb: {
        enabled: true,
        cacheTTL: 3600,
    },
    swarm: {
        topology: 'mesh',
        maxAgents: 100,
        strategy: 'adaptive',
    },
};
class E2BAgentRunner {
    config;
    activeSandboxes = new Map();
    sandboxPool = [];
    executionCount = 0;
    totalExecutionTime = 0;
    errorCount = 0;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_E2B_RUNNER_CONFIG, ...config };
        if (!this.config.apiKey && !process.env.E2B_API_KEY) {
            console.warn('[E2BRunner] No API key provided. Set E2B_API_KEY environment variable.');
        }
        this.log('✅ E2B Agent Runner initialized', {
            maxConcurrency: this.config.maxConcurrency,
            autoScaling: this.config.autoScaling?.enabled,
            agentDBEnabled: this.config.agentdb?.enabled,
            swarmEnabled: !!this.config.swarm,
        });
    }
    async run(agent, context, tools) {
        const startTime = Date.now();
        try {
            const result = await this.executeInSandbox(agent, context, tools);
            this.executionCount++;
            this.totalExecutionTime += Date.now() - startTime;
            return result;
        }
        catch (error) {
            this.errorCount++;
            this.logError(`Agent ${agent.role} execution failed`, error);
            throw error;
        }
    }
    async runBatch(agents, context, toolsPerAgent) {
        this.log(`Running batch of ${agents.length} agents in parallel`);
        const results = [];
        const batchSize = this.config.maxConcurrency || 10;
        for (let i = 0; i < agents.length; i += batchSize) {
            const batch = agents.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map((agent) => this.run(agent, context, toolsPerAgent?.get(agent.role))));
            results.push(...batchResults);
        }
        return results;
    }
    async *runWithStreaming(agent, context) {
        const sandboxId = `${agent.role}-${Date.now()}`;
        try {
            yield { phase: 'init', message: 'Creating E2B sandbox...', progress: 0.1 };
            const sandbox = await this.createSandbox();
            yield { phase: 'deploy', message: 'Deploying agent code...', progress: 0.2 };
            yield { phase: 'execute', message: 'Executing agent analysis...', progress: 0.3 };
            const metadata = {
                sandboxId,
                agentRole: agent.role,
                startTime: Date.now(),
                status: 'running',
                sandbox,
                streamBuffer: [],
            };
            this.activeSandboxes.set(sandboxId, metadata);
            const result = await this.executeAgentInSandbox(sandbox, agent, context);
            yield { phase: 'complete', message: 'Analysis complete', progress: 1.0 };
            metadata.status = 'completed';
            metadata.result = result;
            await sandbox.kill();
            this.activeSandboxes.delete(sandboxId);
        }
        catch (error) {
            yield {
                phase: 'error',
                message: error instanceof Error ? error.message : 'Unknown error',
                progress: 0,
            };
            throw error;
        }
    }
    async createSandbox() {
        this.log(`  🔑 Using E2B_API_KEY from environment`);
        const sandbox = await code_interpreter_1.Sandbox.create();
        this.log(`  ✓ Created sandbox: ${sandbox.sandboxId}`);
        return sandbox;
    }
    async executeInSandbox(agent, context, tools) {
        const sandbox = await this.createSandbox();
        try {
            const result = await this.executeAgentInSandbox(sandbox, agent, context);
            return result;
        }
        finally {
            await sandbox.kill();
        }
    }
    async executeAgentInSandbox(sandbox, agent, context) {
        const startTime = Date.now();
        await sandbox.runCode('import subprocess; subprocess.check_call(["pip", "install", "-q", "anthropic"])');
        const contextJSON = JSON.stringify({
            sample: context.sample,
            clinical: context.clinical,
        });
        const metadata = agent.getMetadata();
        const systemPrompt = (metadata.systemPrompt || 'You are an expert analyst.').replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const model = metadata.model || 'claude-sonnet-4-20250514';
        const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
        if (!anthropicKey) {
            throw new Error('ANTHROPIC_API_KEY not found in environment');
        }
        const execution = await sandbox.runCode(`
import json
import os
from anthropic import Anthropic

client = Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))
context = ${contextJSON}

response = client.messages.create(
    model="${model}",
    max_tokens=4096,
    system="${systemPrompt}",
    messages=[{"role": "user", "content": json.dumps(context)}]
)

result = {
    "agent": "${metadata.role}",
    "role": "${metadata.role}", 
    "analysis": response.content[0].text if response.content else "No analysis",
    "keyFindings": [],
    "confidence": 0.85,
    "supportingEvidence": [],
    "citations": [],
    "mechanisticChains": [],
    "timestamp": "${new Date().toISOString()}",
    "executionTime": 0
}

print(json.dumps(result))
`, {
            envs: { ANTHROPIC_API_KEY: anthropicKey },
            timeoutMs: 180000
        });
        if (execution.error) {
            throw new Error(`Agent execution failed: ${JSON.stringify(execution.error)}`);
        }
        let stdout = execution.text || '';
        if ((!stdout || stdout.trim() === '') && execution.logs?.stdout && execution.logs.stdout.length > 0) {
            stdout = execution.logs.stdout.join('\n');
        }
        if (!stdout || stdout === 'undefined' || stdout.trim() === '') {
            throw new Error(`Agent execution returned no output`);
        }
        const result = JSON.parse(stdout);
        return {
            ...result,
            agent: agent.role,
            timestamp: new Date(),
            executionTime: Date.now() - startTime,
        };
    }
    getStatus() {
        const avgTime = this.executionCount > 0 ? this.totalExecutionTime / this.executionCount : 0;
        const errorRate = this.executionCount > 0 ? this.errorCount / this.executionCount : 0;
        return {
            activeSandboxes: this.activeSandboxes.size,
            totalExecutions: this.executionCount,
            averageExecutionTime: avgTime,
            errorRate,
        };
    }
    async cleanup() {
        this.log('Cleaning up E2B sandboxes...');
        const cleanupPromises = Array.from(this.activeSandboxes.values()).map(async (metadata) => {
            try {
                await metadata.sandbox.kill();
                this.log(`  ✓ Closed sandbox: ${metadata.sandboxId}`);
            }
            catch (error) {
                this.logError(`Failed to close sandbox ${metadata.sandboxId}`, error);
            }
        });
        await Promise.all(cleanupPromises);
        this.activeSandboxes.clear();
        this.log('✅ Cleanup complete');
    }
    log(message, data) {
        if (this.config.verbose) {
            console.log(`[E2BRunner] ${message}`, data || '');
        }
    }
    logError(message, error) {
        console.error(`[E2BRunner] ❌ ${message}:`, error);
    }
}
exports.E2BAgentRunner = E2BAgentRunner;
function createE2BRunner(config) {
    return new E2BAgentRunner({
        apiKey: process.env.E2B_API_KEY,
        templateId: process.env.E2B_TEMPLATE_ID || 'base',
        ...config,
    });
}
function isE2BAvailable() {
    return !!(process.env.E2B_API_KEY || process.env.E2B_TEMPLATE_ID);
}
//# sourceMappingURL=index.js.map