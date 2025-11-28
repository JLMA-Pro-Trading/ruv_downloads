/**
 * MCP Wrapper Generator
 * Universal tool for generating TypeScript wrappers for MCP servers
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
        const { outputDir = './servers', target = 'both', dryRun = false, force = false, servers: serverFilter = [], } = options;
        this.writer.reset();
        try {
            // Detect available MCP servers
            const servers = await this.detector.detectServers();
            if (servers.length === 0) {
                this.writer.getResult(dryRun).errors.push('No MCP servers found. Please configure MCP servers in your project.');
                return this.writer.getResult(dryRun);
            }
            // Filter servers if specified
            const serversToGenerate = serverFilter.length > 0
                ? servers.filter(s => serverFilter.includes(s.name))
                : servers;
            if (serversToGenerate.length === 0) {
                this.writer.getResult(dryRun).errors.push(`No servers match filter: ${serverFilter.join(', ')}`);
                return this.writer.getResult(dryRun);
            }
            // Generate wrappers for each server
            const serverInfos = [];
            for (const server of serversToGenerate) {
                const serverInfo = await this.detector.getServerInfo(server);
                serverInfos.push(serverInfo);
                await this.generateServerWrapper(serverInfo, outputDir, target, { dryRun, force });
            }
            // Generate index file
            await this.generateIndexFile(serverInfos, outputDir, { dryRun, force });
            return this.writer.getResult(dryRun);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const result = this.writer.getResult(dryRun);
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
npm install @foxruv/iris
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

This wrapper was auto-generated by @foxruv/iris MCP Wrapper Generator.

To regenerate:
\`\`\`bash
npx iris-generate-wrappers
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
            packageName: '@foxruv/iris',
        };
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
