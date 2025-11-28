#!/usr/bin/env node
/**
 * IRIS MCP Server
 *
 * Model Context Protocol server for IRIS AI Operations Orchestrator
 * Follows FoxRev ReasoningBank pattern - runs programmatically, results loaded into model context
 *
 * Key Design:
 * - MCP tools are called PROGRAMMATICALLY (not directly by Claude)
 * - Results are loaded into model context as text
 * - Keeps heavy operations OUT of Claude's direct context
 * - Claude gets the RESULTS, not the direct MCP connection
 *
 * @author FoxRuv
 * @license MIT
 */
// CRITICAL: MCP servers need CLEAN stdout - suppress all console.log before imports
// Store original console.log and suppress it during module initialization
const originalConsoleLog = console.log;
if (process.env.IRIS_MCP_MODE === 'true') {
    console.log = () => { }; // Suppress stdout during imports
}
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { irisPrime } from '../orchestrators/iris-prime.js';
import { initSupabaseFromEnv } from '../supabase/index.js';
import { createReflexionMonitor } from '../reflexion/reflexion-monitor.js';
import { createPatternDiscovery } from '../patterns/pattern-discovery.js';
import { createConsensusLineageTracker } from '../consensus/lineage-tracker.js';
import { createGlobalMetrics } from '../telemetry/global-metrics.js';
// Restore console.log after imports (errors still go to stderr which is fine)
if (process.env.IRIS_MCP_MODE === 'true') {
    console.log = originalConsoleLog;
}
// ============================================================================
// Initialize Services
// ============================================================================
let initialized = false;
async function ensureInitialized() {
    if (!initialized) {
        await initSupabaseFromEnv();
        initialized = true;
    }
}
// ============================================================================
// MCP Server Setup
// ============================================================================
const server = new Server({
    name: 'iris-prime',
    version: '1.0.0'
}, {
    capabilities: {
        tools: {},
        resources: {}
    }
});
// ============================================================================
// Tool Request Handler
// ============================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await ensureInitialized();
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            // ======================================================================
            // IRIS Evaluation Tools
            // ======================================================================
            case 'iris_evaluate_project': {
                const { projectId } = args;
                if (!projectId) {
                    throw new McpError(ErrorCode.InvalidParams, 'projectId is required');
                }
                const report = await irisPrime.evaluateProject(projectId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(report, null, 2)
                        }
                    ]
                };
            }
            case 'iris_evaluate_all': {
                const crossReport = await irisPrime.evaluateAllProjects();
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(crossReport, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Drift Detection Tools
            // ======================================================================
            case 'iris_detect_drift': {
                const { reflexionId } = args;
                if (!reflexionId) {
                    throw new McpError(ErrorCode.InvalidParams, 'reflexionId is required');
                }
                const reflexionMonitor = createReflexionMonitor({});
                const driftResult = await reflexionMonitor.detectDrift(reflexionId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(driftResult, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Pattern Discovery Tools
            // ======================================================================
            case 'iris_find_patterns': {
                const { projectId } = args;
                const patternDiscovery = createPatternDiscovery({});
                const patterns = await patternDiscovery.getProjectPatterns(projectId || 'default');
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(patterns, null, 2)
                        }
                    ]
                };
            }
            case 'iris_recommend_transfers': {
                const { sourceProjectId, targetProjectId } = args;
                if (!sourceProjectId || !targetProjectId) {
                    throw new McpError(ErrorCode.InvalidParams, 'sourceProjectId and targetProjectId are required');
                }
                const recommendations = await irisPrime.findTransferablePatterns(sourceProjectId, { targetProject: targetProjectId });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(recommendations, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Expert Statistics Tools
            // ======================================================================
            case 'iris_get_expert_stats': {
                const { projectId, expertId, version } = args;
                if (!projectId || !expertId || !version) {
                    throw new McpError(ErrorCode.InvalidParams, 'projectId, expertId, and version are required');
                }
                const globalMetrics = createGlobalMetrics({});
                const stats = await globalMetrics.getExpertMetrics(projectId, expertId, version);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(stats, null, 2)
                        }
                    ]
                };
            }
            case 'iris_get_cross_project_metrics': {
                const { expertType } = args;
                const globalMetrics = createGlobalMetrics({});
                const metrics = await globalMetrics.getCrossProjectMetrics(expertType || 'all');
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(metrics, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Auto-Retraining Tools
            // ======================================================================
            case 'iris_auto_retrain': {
                const { projectId } = args;
                if (!projectId) {
                    throw new McpError(ErrorCode.InvalidParams, 'projectId is required');
                }
                const retrainReport = await irisPrime.autoRetrainExperts(projectId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(retrainReport, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Consensus Lineage Tools
            // ======================================================================
            case 'iris_consensus_lineage': {
                const { expertId, projectId } = args;
                if (!expertId) {
                    throw new McpError(ErrorCode.InvalidParams, 'expertId is required');
                }
                const lineageTracker = createConsensusLineageTracker({});
                const lineage = await lineageTracker.getVersionLineage(expertId, projectId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(lineage, null, 2)
                        }
                    ]
                };
            }
            case 'iris_rotation_recommendations': {
                const { projectId } = args;
                if (!projectId) {
                    throw new McpError(ErrorCode.InvalidParams, 'projectId is required');
                }
                const lineageTracker = createConsensusLineageTracker({});
                const recommendations = await lineageTracker.generateRotationRecommendations(projectId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(recommendations, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Reflexion Search Tools
            // ======================================================================
            case 'iris_reflexion_search': {
                const { query, limit } = args;
                if (!query) {
                    throw new McpError(ErrorCode.InvalidParams, 'query is required');
                }
                const reflexionMonitor = createReflexionMonitor({});
                const results = await reflexionMonitor.findSimilarReflexions(query, (limit || 10) / 100 // Convert limit to threshold
                );
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(results, null, 2)
                        }
                    ]
                };
            }
            case 'iris_compare_reflexions': {
                const { reflexionId1, reflexionId2 } = args;
                if (!reflexionId1 || !reflexionId2) {
                    throw new McpError(ErrorCode.InvalidParams, 'reflexionId1 and reflexionId2 are required');
                }
                const reflexionMonitor = createReflexionMonitor({});
                const [ref1, ref2] = await Promise.all([
                    reflexionMonitor.getReflexion(reflexionId1),
                    reflexionMonitor.getReflexion(reflexionId2)
                ]);
                const comparison = {
                    reflexion1: ref1,
                    reflexion2: ref2,
                    validityDifference: (ref1?.validityScore || 0) - (ref2?.validityScore || 0),
                    usageDifference: (ref1?.usageCount || 0) - (ref2?.usageCount || 0)
                };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(comparison, null, 2)
                        }
                    ]
                };
            }
            // ======================================================================
            // Health Check Tool
            // ======================================================================
            case 'iris_health_check': {
                const healthStatus = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        supabase: initialized,
                        irisPrime: !!irisPrime
                    }
                };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(healthStatus, null, 2)
                        }
                    ]
                };
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
    }
    catch (error) {
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
});
// ============================================================================
// List Tools Handler
// ============================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            // ======================================================================
            // IRIS Evaluation Tools
            // ======================================================================
            {
                name: 'iris_evaluate_project',
                description: 'Evaluate project health with IRIS - analyzes drift, patterns, and expert performance',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: {
                            type: 'string',
                            description: 'Project identifier to evaluate'
                        }
                    },
                    required: ['projectId']
                }
            },
            {
                name: 'iris_evaluate_all',
                description: 'Run cross-project evaluation across all projects',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            // ======================================================================
            // Drift Detection Tools
            // ======================================================================
            {
                name: 'iris_detect_drift',
                description: 'Detect reflexion drift for a specific reflexion ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        reflexionId: {
                            type: 'string',
                            description: 'Reflexion ID to check for drift'
                        }
                    },
                    required: ['reflexionId']
                }
            },
            // ======================================================================
            // Pattern Discovery Tools
            // ======================================================================
            {
                name: 'iris_find_patterns',
                description: 'Find learned patterns for a project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: {
                            type: 'string',
                            description: 'Project ID to find patterns for'
                        }
                    }
                }
            },
            {
                name: 'iris_recommend_transfers',
                description: 'Recommend pattern transfers between projects',
                inputSchema: {
                    type: 'object',
                    properties: {
                        sourceProjectId: {
                            type: 'string',
                            description: 'Source project ID'
                        },
                        targetProjectId: {
                            type: 'string',
                            description: 'Target project ID'
                        }
                    },
                    required: ['sourceProjectId', 'targetProjectId']
                }
            },
            // ======================================================================
            // Expert Statistics Tools
            // ======================================================================
            {
                name: 'iris_get_expert_stats',
                description: 'Get expert performance statistics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: {
                            type: 'string',
                            description: 'Project ID'
                        },
                        expertId: {
                            type: 'string',
                            description: 'Expert ID'
                        },
                        version: {
                            type: 'string',
                            description: 'Expert version'
                        }
                    },
                    required: ['projectId', 'expertId', 'version']
                }
            },
            {
                name: 'iris_get_cross_project_metrics',
                description: 'Get cross-project performance metrics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        expertType: {
                            type: 'string',
                            description: 'Expert type filter (optional)'
                        }
                    }
                }
            },
            // ======================================================================
            // Auto-Retraining Tools
            // ======================================================================
            {
                name: 'iris_auto_retrain',
                description: 'Trigger automatic retraining for a project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: {
                            type: 'string',
                            description: 'Project ID to retrain experts for'
                        }
                    },
                    required: ['projectId']
                }
            },
            // ======================================================================
            // Consensus Lineage Tools
            // ======================================================================
            {
                name: 'iris_consensus_lineage',
                description: 'Get version lineage and consensus history for an expert',
                inputSchema: {
                    type: 'object',
                    properties: {
                        expertId: {
                            type: 'string',
                            description: 'Expert ID to trace'
                        },
                        projectId: {
                            type: 'string',
                            description: 'Optional project ID filter'
                        }
                    },
                    required: ['expertId']
                }
            },
            {
                name: 'iris_rotation_recommendations',
                description: 'Get expert rotation recommendations based on consensus patterns',
                inputSchema: {
                    type: 'object',
                    properties: {
                        projectId: {
                            type: 'string',
                            description: 'Project ID'
                        }
                    },
                    required: ['projectId']
                }
            },
            // ======================================================================
            // Reflexion Search Tools
            // ======================================================================
            {
                name: 'iris_reflexion_search',
                description: 'Search for similar reflexions using vector similarity',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query'
                        },
                        projectId: {
                            type: 'string',
                            description: 'Optional project ID filter'
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum results (default: 10)',
                            default: 10
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'iris_compare_reflexions',
                description: 'Compare two reflexions and analyze differences',
                inputSchema: {
                    type: 'object',
                    properties: {
                        reflexionId1: {
                            type: 'string',
                            description: 'First reflexion ID'
                        },
                        reflexionId2: {
                            type: 'string',
                            description: 'Second reflexion ID'
                        }
                    },
                    required: ['reflexionId1', 'reflexionId2']
                }
            },
            // ======================================================================
            // Health Check Tool
            // ======================================================================
            {
                name: 'iris_health_check',
                description: 'Check IRIS server health and service status',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ]
    };
});
// ============================================================================
// Resource Handlers - Zero-context storage for MCPs, commands, patterns
// ============================================================================
// Prebuilt commands for common operations
const PREBUILT_COMMANDS = {
    'spawn-researchers': {
        description: 'Spawn 5 researcher agents to analyze codebase',
        command: 'npx agentic-flow spawn --type researcher --count 5 --topology mesh'
    },
    'spawn-coders': {
        description: 'Spawn 3 coder agents for implementation',
        command: 'npx agentic-flow spawn --type coder --count 3 --topology hierarchical'
    },
    'init-swarm': {
        description: 'Initialize a mesh swarm for collaborative work',
        command: 'npx claude-flow swarm init --topology mesh --max-agents 6'
    },
    'optimize-prompt': {
        description: 'Run Ax optimization on an expert prompt',
        command: 'npx iris optimize --trials 20 --method ax',
        args: { expert: 'Expert type to optimize (e.g., sentiment, classifier)' }
    },
    'discover-experts': {
        description: 'Scan codebase for AI functions to optimize',
        command: 'npx iris discover --deep'
    },
    'evaluate-health': {
        description: 'Check project health and drift',
        command: 'npx iris health'
    },
    'context-optimize': {
        description: 'Disable unused MCPs to free context tokens',
        command: 'npx iris mcp context optimize'
    },
    'scan-mcps': {
        description: 'Scan MCPs and document their tools',
        command: 'npx iris mcp scan'
    }
};
// Load MCP skills from .iris/mcp/skills/
async function loadMcpSkills() {
    const skills = {};
    const skillsDir = path.join(process.cwd(), '.iris', 'mcp', 'skills');
    try {
        const files = await fs.readdir(skillsDir);
        for (const file of files) {
            if (file.endsWith('.md')) {
                const id = file.replace('.md', '');
                const content = await fs.readFile(path.join(skillsDir, file), 'utf8');
                skills[id] = content;
            }
        }
    }
    catch {
        // No skills directory yet
    }
    return skills;
}
// Load Claude Code MCP configs
async function loadMcpConfigs() {
    const configPath = path.join(os.homedir(), '.claude.json');
    try {
        const content = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(content);
        const projectPath = process.cwd();
        // Check both old format (direct path key) and new format (under "projects")
        const projectConfig = config[projectPath] || config.projects?.[projectPath];
        return projectConfig?.mcpServers || {};
    }
    catch {
        return {};
    }
}
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const skills = await loadMcpSkills();
    const mcpConfigs = await loadMcpConfigs();
    const resources = [
        // Prebuilt commands
        ...Object.entries(PREBUILT_COMMANDS).map(([id, cmd]) => ({
            uri: `iris://commands/${id}`,
            name: id,
            description: cmd.description,
            mimeType: 'application/json'
        })),
        // MCP skills (scanned tool documentation)
        ...Object.keys(skills).map(id => ({
            uri: `iris://skills/${id}`,
            name: `${id} MCP Skill`,
            description: `Tool documentation for ${id} MCP`,
            mimeType: 'text/markdown'
        })),
        // Raw MCP configs
        ...Object.keys(mcpConfigs).map(id => ({
            uri: `iris://mcps/${id}`,
            name: `${id} MCP Config`,
            description: `Configuration and tools for ${id}`,
            mimeType: 'application/json'
        })),
        // Special resources
        {
            uri: 'iris://commands',
            name: 'All Commands',
            description: 'List of all prebuilt commands',
            mimeType: 'application/json'
        },
        {
            uri: 'iris://config',
            name: 'Iris Config',
            description: 'Current Iris configuration',
            mimeType: 'application/json'
        }
    ];
    return { resources };
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    // Parse URI
    const match = uri.match(/^iris:\/\/(\w+)(?:\/(.+))?$/);
    if (!match) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid URI: ${uri}`);
    }
    const [, category, id] = match;
    switch (category) {
        case 'commands': {
            if (!id) {
                // Return all commands
                return {
                    contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(PREBUILT_COMMANDS, null, 2)
                        }]
                };
            }
            const cmd = PREBUILT_COMMANDS[id];
            if (!cmd) {
                throw new McpError(ErrorCode.InvalidParams, `Unknown command: ${id}`);
            }
            return {
                contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(cmd, null, 2)
                    }]
            };
        }
        case 'skills': {
            const skills = await loadMcpSkills();
            const skill = skills[id];
            if (!skill) {
                throw new McpError(ErrorCode.InvalidParams, `Unknown skill: ${id}`);
            }
            return {
                contents: [{
                        uri,
                        mimeType: 'text/markdown',
                        text: skill
                    }]
            };
        }
        case 'mcps': {
            const configs = await loadMcpConfigs();
            const config = configs[id];
            if (!config) {
                throw new McpError(ErrorCode.InvalidParams, `Unknown MCP: ${id}`);
            }
            // Also try to load the skill if it exists
            const skills = await loadMcpSkills();
            const skill = skills[id];
            return {
                contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify({
                            id,
                            config,
                            skill: skill ? 'Available - read iris://skills/' + id : 'Not scanned yet - run: npx iris mcp scan'
                        }, null, 2)
                    }]
            };
        }
        case 'config': {
            const configPath = path.join(process.cwd(), '.iris', 'config', 'settings.json');
            try {
                const content = await fs.readFile(configPath, 'utf8');
                return {
                    contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: content
                        }]
                };
            }
            catch {
                return {
                    contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify({ error: 'No config found. Run: npx iris init --enhanced' })
                        }]
                };
            }
        }
        default:
            throw new McpError(ErrorCode.InvalidParams, `Unknown resource category: ${category}`);
    }
});
// ============================================================================
// Server Startup
// ============================================================================
export async function startMcpServer() {
    // Set env to suppress stdout logging (MCP needs clean stdout for protocol)
    process.env.IRIS_MCP_MODE = 'true';
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('IRIS MCP Server running on stdio');
}
// Auto-start if run directly
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
    startMcpServer().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}
