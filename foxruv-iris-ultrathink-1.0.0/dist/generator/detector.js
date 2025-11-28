/**
 * MCP Server Detector
 * Auto-detects MCP servers from project configuration
 *
 * @package ultrathink
 * @standalone Fully standalone implementation with no iris-core dependencies
 */
import { readFile, access } from 'fs/promises';
import { resolve, join } from 'path';
import { homedir } from 'os';
export class MCPDetector {
    projectRoot;
    options;
    constructor(projectRoot = process.cwd(), options = {}) {
        this.projectRoot = projectRoot;
        this.options = options;
    }
    /**
     * Detect all MCP servers from various config sources
     * Priority order (highest to lowest):
     * 1. Project config (./.mcp.json)
     * 2. User config (~/.claude.json)
     * 3. Legacy config (~/.config/claude/claude_desktop_config.json)
     * 4. Package.json
     * 5. Environment file
     */
    async detectServers() {
        const startTime = Date.now();
        await this.emitCoordination({
            type: 'generation:start',
            agentId: this.options.agentId,
            timestamp: new Date().toISOString(),
        });
        const serverMap = new Map();
        // Try config sources in reverse priority order (so higher priority overwrites)
        const configSources = [
            { name: 'env', servers: await this.detectFromEnvFile() },
            { name: 'package.json', servers: await this.detectFromPackageJson() },
            { name: 'legacy', servers: await this.detectFromLegacyConfig() },
            { name: 'user', servers: await this.detectFromUserConfig() },
            { name: 'project', servers: await this.detectFromProjectConfig() },
        ];
        // Process in order, later sources override earlier ones
        for (const source of configSources) {
            for (const server of source.servers) {
                serverMap.set(server.name, server);
            }
        }
        const servers = Array.from(serverMap.values());
        await this.emitCoordination({
            type: 'generation:complete',
            agentId: this.options.agentId,
            progress: servers.length,
            total: servers.length,
            timestamp: new Date().toISOString(),
        });
        await this.emitTracking({
            id: `detect-${Date.now()}`,
            agentId: this.options.agentId,
            operation: 'detect',
            filesAffected: [],
            success: true,
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            metadata: { serversFound: servers.length },
        });
        return servers;
    }
    /**
     * Get detailed server information including available tools
     */
    async getServerInfo(server) {
        // This would normally introspect the MCP server
        // For now, return basic info with placeholder tools
        return {
            ...server,
            tools: await this.introspectTools(server),
            resources: [],
        };
    }
    /**
     * Detect from project config (./.mcp.json)
     * Highest priority - project-specific MCP servers
     */
    async detectFromProjectConfig() {
        try {
            const configPath = resolve(this.projectRoot, '.mcp.json');
            const content = await readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            return this.parseServerConfig(config);
        }
        catch {
            return [];
        }
    }
    /**
     * Detect from user config (~/.claude.json)
     * Second priority - user-wide MCP servers
     */
    async detectFromUserConfig() {
        try {
            const configPath = join(homedir(), '.claude.json');
            const content = await readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            return this.parseServerConfig(config);
        }
        catch {
            return [];
        }
    }
    /**
     * Detect from legacy Claude Desktop config (~/.config/claude/claude_desktop_config.json)
     * Third priority - legacy compatibility
     */
    async detectFromLegacyConfig() {
        try {
            const configPath = join(homedir(), '.config', 'claude', 'claude_desktop_config.json');
            const content = await readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            return this.parseServerConfig(config);
        }
        catch {
            return [];
        }
    }
    /**
     * Detect from package.json (custom mcp field)
     */
    async detectFromPackageJson() {
        try {
            const pkgPath = resolve(this.projectRoot, 'package.json');
            const content = await readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(content);
            if (pkg.mcp?.servers) {
                return this.parseServerConfig({ mcpServers: pkg.mcp.servers });
            }
            return [];
        }
        catch {
            return [];
        }
    }
    /**
     * Detect from .env file (MCP_SERVERS variable)
     */
    async detectFromEnvFile() {
        try {
            const envPath = resolve(this.projectRoot, '.env');
            const content = await readFile(envPath, 'utf-8');
            const mcpServersLine = content
                .split('\n')
                .find(line => line.startsWith('MCP_SERVERS='));
            if (mcpServersLine) {
                const serversJson = mcpServersLine.split('=')[1];
                const servers = JSON.parse(serversJson);
                return this.parseServerConfig({ mcpServers: servers });
            }
            return [];
        }
        catch {
            return [];
        }
    }
    /**
     * Parse server configuration from various formats
     */
    parseServerConfig(config) {
        const servers = [];
        const serverConfig = config.mcpServers || config.servers || {};
        for (const [name, serverDef] of Object.entries(serverConfig)) {
            if (typeof serverDef === 'object' && serverDef.command) {
                servers.push({
                    name,
                    command: serverDef.command,
                    args: serverDef.args,
                    env: serverDef.env,
                    description: serverDef.description,
                });
            }
        }
        return servers;
    }
    /**
     * Introspect MCP server to get available tools
     * This is a placeholder - actual implementation would need to start the server
     * and query its capabilities via the MCP protocol
     */
    async introspectTools(server) {
        // For now, return common tool patterns based on server name
        const commonTools = this.getCommonToolsForServer(server.name);
        // TODO: Implement actual MCP introspection via stdio
        // This would involve:
        // 1. Starting the server process
        // 2. Sending initialize request
        // 3. Calling tools/list
        // 4. Parsing the response
        // 5. Shutting down the server
        return commonTools;
    }
    /**
     * Get common tools for well-known MCP servers
     */
    getCommonToolsForServer(serverName) {
        const commonPatterns = {
            'claude-flow': [
                {
                    name: 'swarm_init',
                    description: 'Initialize swarm with topology',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topology: { type: 'string', enum: ['hierarchical', 'mesh', 'ring', 'star'] },
                            maxAgents: { type: 'number', default: 8 },
                            strategy: { type: 'string', default: 'auto' },
                        },
                        required: ['topology'],
                    },
                },
                {
                    name: 'agent_spawn',
                    description: 'Create specialized AI agents',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            type: { type: 'string' },
                            name: { type: 'string' },
                            capabilities: { type: 'array' },
                        },
                        required: ['type'],
                    },
                },
                {
                    name: 'task_orchestrate',
                    description: 'Orchestrate complex task workflows',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            task: { type: 'string' },
                            strategy: { type: 'string' },
                            priority: { type: 'string' },
                        },
                        required: ['task'],
                    },
                },
            ],
            'ruv-swarm': [
                {
                    name: 'swarm_init',
                    description: 'Initialize a new swarm with specified topology',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            topology: { type: 'string' },
                            maxAgents: { type: 'number' },
                            strategy: { type: 'string' },
                        },
                        required: ['topology'],
                    },
                },
            ],
            'flow-nexus': [
                {
                    name: 'sandbox_create',
                    description: 'Create new code execution sandbox',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            template: { type: 'string' },
                            name: { type: 'string' },
                            env_vars: { type: 'object' },
                        },
                        required: ['template'],
                    },
                },
            ],
        };
        // Check for partial matches
        for (const [pattern, tools] of Object.entries(commonPatterns)) {
            if (serverName.toLowerCase().includes(pattern.toLowerCase())) {
                return tools;
            }
        }
        // Return generic tools if no match
        return [
            {
                name: 'execute',
                description: 'Execute a generic operation',
                inputSchema: {
                    type: 'object',
                    properties: {
                        operation: { type: 'string' },
                        params: { type: 'object' },
                    },
                    required: ['operation'],
                },
            },
        ];
    }
    /**
     * Check if config file exists
     */
    async hasConfig(configPath) {
        try {
            await access(configPath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Emit coordination event for agentic-flow integration
     */
    async emitCoordination(event) {
        if (this.options.enableCoordination && this.options.onCoordinationEvent) {
            await this.options.onCoordinationEvent(event);
        }
    }
    /**
     * Emit tracking record for agentdb integration
     */
    async emitTracking(record) {
        if (this.options.onTrackingRecord) {
            await this.options.onTrackingRecord(record);
        }
    }
}
//# sourceMappingURL=detector.js.map