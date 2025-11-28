import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
export const detectMcpCommand = new Command('detect-mcp')
    .description('Detect available MCP servers')
    .option('--all', 'Show all sources (not just available servers)')
    .option('--check-health', 'Check server health and tool count')
    .option('-v, --verbose', 'Show detailed server information')
    .option('-o, --output <file>', 'Save results to JSON file')
    .action(async (options) => {
    const spinner = ora('Detecting MCP servers...').start();
    try {
        const result = {
            servers: [],
            summary: {
                total: 0,
                available: 0,
                unavailable: 0,
                bySource: {}
            }
        };
        // 1. Check Claude Desktop settings
        spinner.text = 'Checking Claude Desktop settings...';
        const claudeServers = await detectClaudeSettings();
        result.servers.push(...claudeServers);
        // 2. Check project skills directory
        spinner.text = 'Checking project skills...';
        const skillServers = await detectProjectSkills();
        result.servers.push(...skillServers);
        // 3. Check system PATH
        spinner.text = 'Checking system PATH...';
        const pathServers = await detectSystemPath();
        result.servers.push(...pathServers);
        // 4. Check npm global packages
        spinner.text = 'Checking npm global packages...';
        const npmServers = await detectNpmGlobal();
        result.servers.push(...npmServers);
        // Health checks
        if (options.checkHealth) {
            spinner.text = 'Performing health checks...';
            for (const server of result.servers) {
                if (server.available && server.command) {
                    try {
                        const health = await checkServerHealth(server);
                        server.toolCount = health.toolCount;
                        server.version = health.version;
                    }
                    catch (error) {
                        if (options.verbose) {
                            console.warn(chalk.yellow(`Warning: Health check failed for ${server.name}`));
                        }
                    }
                }
            }
        }
        // Calculate summary
        result.summary.total = result.servers.length;
        result.summary.available = result.servers.filter(s => s.available).length;
        result.summary.unavailable = result.servers.filter(s => !s.available).length;
        for (const server of result.servers) {
            result.summary.bySource[server.source] =
                (result.summary.bySource[server.source] || 0) + 1;
        }
        // Filter if not showing all
        const displayServers = options.all
            ? result.servers
            : result.servers.filter(s => s.available);
        spinner.succeed(chalk.green(`Detected ${result.summary.available} available MCP servers!`));
        // Display results
        console.log(chalk.cyan('\n📊 Detection Summary:'));
        console.log(chalk.gray(`  Total detected: ${result.summary.total}`));
        console.log(chalk.gray(`  Available: ${result.summary.available}`));
        if (result.summary.unavailable > 0) {
            console.log(chalk.yellow(`  Unavailable: ${result.summary.unavailable}`));
        }
        console.log(chalk.cyan('\n📋 By Source:'));
        for (const [source, count] of Object.entries(result.summary.bySource)) {
            console.log(chalk.gray(`  ${source}: ${count}`));
        }
        // Group by source
        const bySource = {};
        for (const server of displayServers) {
            if (!bySource[server.source]) {
                bySource[server.source] = [];
            }
            bySource[server.source].push(server);
        }
        // Display servers
        console.log(chalk.cyan('\n🔌 MCP Servers:\n'));
        for (const [source, servers] of Object.entries(bySource)) {
            console.log(chalk.bold(`${source.toUpperCase()} (${servers.length})`));
            console.log(chalk.gray('─'.repeat(60)));
            for (const server of servers) {
                const icon = server.available ? '✓' : '✗';
                const statusColor = server.available ? chalk.green : chalk.red;
                console.log(`\n${statusColor(icon)} ${chalk.bold(server.name)}`);
                if (server.description) {
                    console.log(chalk.gray(`  Description: ${server.description}`));
                }
                if (server.command) {
                    console.log(chalk.gray(`  Command: ${server.command}`));
                }
                if (server.version) {
                    console.log(chalk.gray(`  Version: ${server.version}`));
                }
                if (server.toolCount !== undefined) {
                    console.log(chalk.gray(`  Tools: ${server.toolCount}`));
                }
                if (options.verbose && server.args && server.args.length > 0) {
                    console.log(chalk.gray(`  Args: ${server.args.join(' ')}`));
                }
                if (options.verbose && server.env && Object.keys(server.env).length > 0) {
                    console.log(chalk.gray(`  Env: ${Object.keys(server.env).join(', ')}`));
                }
            }
            console.log('');
        }
        // Suggestions
        if (result.summary.unavailable > 0 && !options.all) {
            console.log(chalk.yellow('💡 Tip: Use --all to show unavailable servers'));
        }
        if (result.summary.available > 0) {
            console.log(chalk.cyan('\n📝 Next Steps:'));
            console.log(chalk.gray('  • Import to project: ultrathink import'));
            console.log(chalk.gray('  • View skills: ultrathink sync'));
            console.log(chalk.gray('  • Check health: ultrathink detect-mcp --check-health'));
        }
        // Save results
        if (options.output) {
            const { writeFile } = await import('fs/promises');
            await writeFile(options.output, JSON.stringify(result, null, 2), 'utf-8');
            console.log(chalk.green(`\n💾 Results saved to: ${options.output}`));
        }
    }
    catch (error) {
        spinner.fail(chalk.red('Detection failed'));
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        if (options.parent?.opts().debug) {
            console.error(error);
        }
        process.exit(1);
    }
});
async function detectClaudeSettings() {
    const servers = [];
    const settingsPath = resolve(homedir(), '.claude/settings.json');
    if (!existsSync(settingsPath)) {
        return servers;
    }
    try {
        const content = await readFile(settingsPath, 'utf-8');
        const settings = JSON.parse(content);
        if (settings.mcpServers && Array.isArray(settings.mcpServers)) {
            for (const serverName of settings.mcpServers) {
                servers.push({
                    name: serverName,
                    source: 'claude-settings',
                    available: true,
                    description: 'Configured in Claude Desktop settings'
                });
            }
        }
    }
    catch (error) {
        // Silently fail if we can't read settings
    }
    return servers;
}
async function detectProjectSkills() {
    const servers = [];
    const skillsPath = resolve(process.cwd(), 'skills');
    if (!existsSync(skillsPath)) {
        return servers;
    }
    try {
        const { readdirSync } = await import('fs');
        const files = readdirSync(skillsPath);
        for (const file of files) {
            if (file.endsWith('.md') && !['INDEX.md', 'CLAUDE.md', 'README.md'].includes(file)) {
                const skillPath = resolve(skillsPath, file);
                const content = await readFile(skillPath, 'utf-8');
                // Parse frontmatter
                const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (frontmatterMatch) {
                    const name = file.replace('.md', '');
                    const enabled = frontmatterMatch[1].includes('enabled: true');
                    servers.push({
                        name,
                        source: 'project-skills',
                        available: enabled,
                        description: 'Project-local skill'
                    });
                }
            }
        }
    }
    catch (error) {
        // Silently fail
    }
    return servers;
}
async function detectSystemPath() {
    const servers = [];
    const mcpCommands = [
        'claude-flow',
        'ruv-swarm',
        'flow-nexus',
        'agentdb',
        'context7'
    ];
    for (const command of mcpCommands) {
        try {
            await execAsync(`which ${command}`);
            servers.push({
                name: command,
                source: 'system-path',
                command,
                available: true,
                description: 'Available in system PATH'
            });
        }
        catch (error) {
            // Command not found
        }
    }
    return servers;
}
async function detectNpmGlobal() {
    const servers = [];
    try {
        const { stdout } = await execAsync('npm list -g --depth=0 --json');
        const packages = JSON.parse(stdout);
        const mcpPackages = [
            '@modelcontextprotocol/server-*',
            'claude-flow',
            'ruv-swarm',
            'flow-nexus',
            '@ultrathink/*'
        ];
        if (packages.dependencies) {
            for (const [name, info] of Object.entries(packages.dependencies)) {
                const isMCP = mcpPackages.some(pattern => {
                    if (pattern.endsWith('*')) {
                        return name.startsWith(pattern.slice(0, -1));
                    }
                    return name === pattern;
                });
                if (isMCP) {
                    servers.push({
                        name,
                        source: 'npm-global',
                        available: true,
                        version: info.version,
                        description: 'Globally installed npm package'
                    });
                }
            }
        }
    }
    catch (error) {
        // Silently fail if npm not available
    }
    return servers;
}
async function checkServerHealth(server) {
    // Placeholder - actual implementation would:
    // 1. Start MCP server
    // 2. Query available tools
    // 3. Check version
    // 4. Shutdown server
    return {
        toolCount: 0,
        version: server.version
    };
}
//# sourceMappingURL=detect-mcp.js.map