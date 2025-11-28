/**
 * MCP Wrapper Generator
 * Universal tool for generating TypeScript wrappers for MCP servers
 *
 * @package ultrathink
 * @standalone Fully standalone implementation with agentic-flow coordination and agentdb tracking
 */
import { resolve } from 'path';
import { MCPDetector } from './detector.js';
import { TemplateGenerator } from './templates.js';
import { FileWriter } from './writer.js';
export class MCPWrapperGenerator {
    projectRoot;
    detector;
    templateGen;
    writer;
    tracking = {};
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
        this.detector = new MCPDetector(projectRoot);
        this.templateGen = new TemplateGenerator();
        this.writer = new FileWriter();
    }
    /**
     * Generate MCP wrappers
     */
    async generate(options = {}) {
        const { outputDir = './servers', target = 'both', dryRun = false, force = false, servers: serverFilter = [], enableCoordination = false, enableTracking = false, coordinationNamespace = 'mcp-generator', agentId, } = options;
        // Initialize tracking
        const startTime = Date.now();
        this.tracking = {
            startTime: new Date().toISOString(),
            serversProcessed: 0,
            toolsGenerated: 0,
            agentId,
        };
        this.writer.reset();
        // Set up coordination and tracking handlers
        const coordinationHandler = enableCoordination ? this.createCoordinationHandler(coordinationNamespace) : undefined;
        const trackingHandler = enableTracking ? this.createTrackingHandler() : undefined;
        // Configure detector with handlers
        this.detector = new MCPDetector(this.projectRoot, {
            enableCoordination,
            agentId,
            onCoordinationEvent: coordinationHandler,
            onTrackingRecord: trackingHandler,
        });
        // Configure writer with handlers
        this.writer.setOptions({
            enableCoordination,
            agentId,
            onCoordinationEvent: coordinationHandler,
            onTrackingRecord: trackingHandler,
        });
        try {
            // Emit start event
            await this.emitCoordination({
                type: 'generation:start',
                agentId,
                timestamp: new Date().toISOString(),
            }, coordinationHandler);
            // Detect available MCP servers
            const servers = await this.detector.detectServers();
            if (servers.length === 0) {
                this.writer.getResult(dryRun).errors.push('No MCP servers found. Please configure MCP servers in your project.');
                return this.finalizeResult(dryRun, startTime);
            }
            // Filter servers if specified
            const serversToGenerate = serverFilter.length > 0
                ? servers.filter(s => serverFilter.includes(s.name))
                : servers;
            if (serversToGenerate.length === 0) {
                this.writer.getResult(dryRun).errors.push(`No servers match filter: ${serverFilter.join(', ')}`);
                return this.finalizeResult(dryRun, startTime);
            }
            // Generate wrappers for each server
            const serverInfos = [];
            for (const [index, server] of serversToGenerate.entries()) {
                const serverInfo = await this.detector.getServerInfo(server);
                serverInfos.push(serverInfo);
                // Track progress
                this.tracking.serversProcessed = (this.tracking.serversProcessed || 0) + 1;
                this.tracking.toolsGenerated = (this.tracking.toolsGenerated || 0) + serverInfo.tools.length;
                // Emit progress event
                await this.emitCoordination({
                    type: 'generation:progress',
                    agentId,
                    serverName: server.name,
                    progress: index + 1,
                    total: serversToGenerate.length,
                    timestamp: new Date().toISOString(),
                }, coordinationHandler);
                await this.generateServerWrapper(serverInfo, outputDir, target, { dryRun, force });
            }
            // Generate index file
            await this.generateIndexFile(serverInfos, outputDir, { dryRun, force });
            // Emit complete event
            await this.emitCoordination({
                type: 'generation:complete',
                agentId,
                progress: serversToGenerate.length,
                total: serversToGenerate.length,
                timestamp: new Date().toISOString(),
            }, coordinationHandler);
            return this.finalizeResult(dryRun, startTime);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            // Emit error event
            await this.emitCoordination({
                type: 'generation:error',
                agentId,
                error: message,
                timestamp: new Date().toISOString(),
            }, coordinationHandler);
            const result = this.finalizeResult(dryRun, startTime);
            result.errors.push(`Generation failed: ${message}`);
            result.success = false;
            return result;
        }
    }
    /**
     * Generate wrapper for a single server
     */
    async generateServerWrapper(serverInfo, outputDir, target, options) {
        const serverDir = resolve(this.projectRoot, outputDir, serverInfo.name);
        const context = this.createContext(serverInfo, target === 'frontend' ? 'frontend' : 'backend');
        // Create server directory
        await this.writer.createDirectory(serverDir, options);
        // Generate frontend wrapper
        if (target === 'frontend' || target === 'both') {
            const frontendContext = { ...context, target: 'frontend' };
            const frontendCode = this.templateGen.generateFrontendWrapper(frontendContext);
            const frontendPath = resolve(serverDir, 'frontend.ts');
            await this.writer.writeFile(frontendPath, frontendCode, options);
        }
        // Generate backend wrapper
        if (target === 'backend' || target === 'both') {
            const backendContext = { ...context, target: 'backend' };
            const backendCode = this.templateGen.generateBackendWrapper(backendContext);
            const backendPath = resolve(serverDir, 'backend.ts');
            await this.writer.writeFile(backendPath, backendCode, options);
        }
        // Generate types
        const typesCode = this.templateGen.generateTypes(context);
        const typesPath = resolve(serverDir, 'types.ts');
        await this.writer.writeFile(typesPath, typesCode, options);
        // Generate server index
        const indexCode = this.generateServerIndex(serverInfo.name, target);
        const indexPath = resolve(serverDir, 'index.ts');
        await this.writer.writeFile(indexPath, indexCode, options);
        // Generate README
        const readmeCode = this.generateServerReadme(serverInfo, target);
        const readmePath = resolve(serverDir, 'README.md');
        await this.writer.writeFile(readmePath, readmeCode, options);
    }
    /**
     * Generate main index file
     */
    async generateIndexFile(serverInfos, outputDir, options) {
        const serverNames = serverInfos.map(s => s.name);
        const indexCode = this.templateGen.generateIndex(serverNames);
        const indexPath = resolve(this.projectRoot, outputDir, 'index.ts');
        await this.writer.writeFile(indexPath, indexCode, options);
    }
    /**
     * Generate server-specific index
     */
    generateServerIndex(serverName, target) {
        const className = this.templateGen.toClassName(serverName);
        if (target === 'both') {
            return `export { ${className} as ${className}Frontend } from './frontend.js';
export { ${className} as ${className}Backend } from './backend.js';
export * from './types.js';
`;
        }
        const file = target === 'frontend' ? 'frontend' : 'backend';
        return `export { ${className} } from './${file}.js';
export * from './types.js';
`;
    }
    /**
     * Generate server README
     */
    generateServerReadme(serverInfo, target) {
        const className = this.templateGen.toClassName(serverInfo.name);
        return `# ${serverInfo.name} MCP Wrapper

${serverInfo.description || 'Auto-generated MCP wrapper'}

## Installation

\`\`\`bash
npm install @foxruv/ultrathink
\`\`\`

## Usage

### ${target === 'frontend' || target === 'both' ? 'Frontend (Browser)' : ''}

${target === 'frontend' || target === 'both' ? `\`\`\`typescript
import { ${className} } from './servers/${serverInfo.name}.js';

const client = new ${className}({
  baseUrl: '/api/mcp/${serverInfo.name}',
  apiKey: 'your-api-key', // Optional
});

// Use the client
${this.generateExampleUsage(serverInfo)}
\`\`\`
` : ''}

### ${target === 'backend' || target === 'both' ? 'Backend (Node.js)' : ''}

${target === 'backend' || target === 'both' ? `\`\`\`typescript
import { ${className} } from './servers/${serverInfo.name}.js';

const client = new ${className}({
  command: 'npx',
  args: ['${serverInfo.name}', 'mcp', 'start'],
});

await client.initialize();

// Use the client
${this.generateExampleUsage(serverInfo)}

// Clean up
await client.close();
\`\`\`
` : ''}

## Available Methods

${serverInfo.tools.map(tool => `### \`${this.templateGen['toMethodName'](tool.name)}()\`

${tool.description}

**Parameters:**
\`\`\`typescript
${JSON.stringify(tool.inputSchema.properties || {}, null, 2)}
\`\`\`
`).join('\n')}

## Generated

This wrapper was auto-generated by @foxruv/ultrathink MCP Wrapper Generator.

To regenerate:
\`\`\`bash
npx ultrathink generate-wrappers
\`\`\`
`;
    }
    /**
     * Generate example usage code
     */
    generateExampleUsage(serverInfo) {
        if (serverInfo.tools.length === 0) {
            return '// No tools available';
        }
        const tool = serverInfo.tools[0];
        const methodName = this.templateGen['toMethodName'](tool.name);
        const exampleParams = this.generateExampleParams(tool.inputSchema);
        return `const result = await client.${methodName}(${exampleParams});
console.log(result);`;
    }
    /**
     * Generate example parameters
     */
    generateExampleParams(schema) {
        if (!schema.properties) {
            return '{}';
        }
        const params = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            if (prop.enum) {
                params[key] = prop.enum[0];
            }
            else if (prop.default !== undefined) {
                params[key] = prop.default;
            }
            else {
                switch (prop.type) {
                    case 'string':
                        params[key] = 'example';
                        break;
                    case 'number':
                        params[key] = 42;
                        break;
                    case 'boolean':
                        params[key] = true;
                        break;
                    case 'array':
                        params[key] = [];
                        break;
                    case 'object':
                        params[key] = {};
                        break;
                }
            }
        }
        return JSON.stringify(params, null, 2);
    }
    /**
     * Create template context
     */
    createContext(serverInfo, target) {
        return {
            serverName: serverInfo.name,
            normalizedName: serverInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            className: this.templateGen.toClassName(serverInfo.name),
            tools: serverInfo.tools,
            resources: serverInfo.resources,
            target,
            timestamp: new Date().toISOString(),
            packageName: '@foxruv/ultrathink',
        };
    }
    /**
     * Finalize result with tracking data
     */
    finalizeResult(dryRun, startTime) {
        const result = this.writer.getResult(dryRun);
        // Add tracking data
        if (this.tracking.startTime) {
            this.tracking.endTime = new Date().toISOString();
            this.tracking.duration = Date.now() - startTime;
            result.tracking = this.tracking;
        }
        return result;
    }
    /**
     * Create coordination event handler for agentic-flow integration
     */
    createCoordinationHandler(namespace) {
        return async (event) => {
            // Log to console in standalone mode
            const timestamp = new Date(event.timestamp).toISOString();
            const prefix = `[${timestamp}] [${namespace}]`;
            switch (event.type) {
                case 'generation:start':
                    console.log(`${prefix} Starting MCP wrapper generation...`);
                    break;
                case 'generation:progress':
                    if (event.progress && event.total) {
                        console.log(`${prefix} Progress: ${event.progress}/${event.total} servers`);
                    }
                    break;
                case 'generation:complete':
                    console.log(`${prefix} Generation complete!`);
                    break;
                case 'generation:error':
                    console.error(`${prefix} Error: ${event.error}`);
                    break;
            }
            // Future: Integrate with agentic-flow memory coordination
            // await agenticFlow.memory.store({
            //   namespace,
            //   key: `event-${Date.now()}`,
            //   value: JSON.stringify(event),
            // });
        };
    }
    /**
     * Create tracking record handler for agentdb integration
     */
    createTrackingHandler() {
        return async (record) => {
            // Log to console in standalone mode
            const status = record.success ? 'SUCCESS' : 'FAILED';
            console.log(`[${record.timestamp}] [${record.operation}] ${status} - ${record.filesAffected.length} files (${record.duration}ms)`);
            // Future: Integrate with agentdb for persistence
            // await agentdb.store({
            //   collection: 'mcp-generator-tracking',
            //   document: record,
            // });
        };
    }
    /**
     * Emit coordination event
     */
    async emitCoordination(event, handler) {
        if (handler) {
            await handler(event);
        }
    }
}
/**
 * Generate MCP wrappers (convenience function)
 */
export async function generateMCPWrappers(options = {}) {
    const generator = new MCPWrapperGenerator(options.configPath);
    return generator.generate(options);
}
// Export all types and classes
export * from './types.js';
export { MCPDetector } from './detector.js';
export { TemplateGenerator } from './templates.js';
export { FileWriter } from './writer.js';
//# sourceMappingURL=index.js.map