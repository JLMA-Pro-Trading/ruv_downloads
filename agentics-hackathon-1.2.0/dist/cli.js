#!/usr/bin/env node
"use strict";
/**
 * Agentics Foundation TV5 Hackathon CLI
 *
 * Main entry point for the hackathon CLI tool.
 * Run with: npx @agenticsorg/hackathon
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const index_js_1 = require("./commands/index.js");
const sse_js_1 = require("./mcp/sse.js");
const constants_js_1 = require("./constants.js");
const index_js_2 = require("./utils/index.js");
// Package version
const version = '1.2.0';
const program = new commander_1.Command();
program
    .name('hackathon')
    .description(`${constants_js_1.HACKATHON_NAME} CLI - Build the future of agentic AI`)
    .version(version)
    .hook('preAction', () => {
    // Show abbreviated banner for commands
});
// Init command
program
    .command('init')
    .description('Initialize a new hackathon project with interactive setup')
    .option('-f, --force', 'Force reinitialize even if already configured')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('-t, --tools <tools...>', 'Tools to install (space-separated)')
    .option('--track <track>', 'Hackathon track to participate in')
    .option('--team <name>', 'Team name')
    .option('--project <name>', 'Project name')
    .option('--mcp', 'Enable MCP server')
    .option('--json', 'Output result as JSON (implies --yes)')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (options) => {
    await (0, index_js_1.initCommand)(options);
});
// Tools command
program
    .command('tools')
    .description('List, check, or install hackathon development tools')
    .option('-l, --list', 'List all available tools')
    .option('-c, --check', 'Check which tools are installed')
    .option('-i, --install <tools...>', 'Install specific tools')
    .option('--category <category>', 'Filter by category (ai-assistants, orchestration, databases, cloud-platform, synthesis, python-frameworks)')
    .option('--available', 'List available tools (alias for --list)')
    .option('--json', 'Output result as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (options) => {
    await (0, index_js_1.toolsCommand)(options);
});
// Status command
program
    .command('status')
    .description('Show current hackathon project status')
    .option('--json', 'Output result as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (options) => {
    await (0, index_js_1.statusCommand)(options);
});
// Info command
program
    .command('info')
    .description('Display hackathon information and resources')
    .option('--json', 'Output result as JSON')
    .option('-q, --quiet', 'Suppress non-essential output')
    .action(async (options) => {
    await (0, index_js_1.infoCommand)(options);
});
// MCP command
program
    .command('mcp')
    .description('Start the MCP (Model Context Protocol) server')
    .argument('[transport]', 'Transport type: stdio or sse', 'stdio')
    .option('-p, --port <port>', 'Port for SSE server', '3000')
    .action(async (transport, options) => {
    if (transport === 'sse') {
        (0, sse_js_1.startSseServer)(parseInt(options.port, 10));
    }
    else {
        // Import and run STDIO server
        await import('./mcp/stdio.js');
    }
});
// Discord command
program
    .command('discord')
    .description('Open Discord for team coordination and support')
    .option('--json', 'Output result as JSON')
    .action((options) => {
    if (options.json) {
        console.log(JSON.stringify({ success: true, discord: constants_js_1.DISCORD_URL }));
        return;
    }
    index_js_2.logger.box(`Join the Agentics Foundation Discord community!\n\n` +
        `${chalk_1.default.bold('Benefits:')}\n` +
        `  • Team formation & networking\n` +
        `  • Technical support & mentorship\n` +
        `  • Announcements & updates\n` +
        `  • Share your progress\n\n` +
        chalk_1.default.cyan.bold.underline(constants_js_1.DISCORD_URL), 'Discord Community');
    index_js_2.logger.newline();
    index_js_2.logger.info('Open the URL above in your browser to join!');
});
// Website command
program
    .command('website')
    .alias('web')
    .description('Open the hackathon website')
    .option('--json', 'Output result as JSON')
    .action((options) => {
    if (options.json) {
        console.log(JSON.stringify({ success: true, website: constants_js_1.WEBSITE_URL }));
        return;
    }
    index_js_2.logger.box(`Visit the official hackathon website:\n\n` +
        chalk_1.default.cyan.bold.underline(constants_js_1.WEBSITE_URL), 'Hackathon Website');
});
// Help command with topics
program
    .command('help [topic]')
    .description('Show detailed help (topics: init, tools, mcp, tracks, examples, packages)')
    .action(async (topic) => {
    await (0, index_js_1.helpCommand)({ topic });
});
// Default action (no command)
program
    .action(async () => {
    // Show full banner and menu
    index_js_2.logger.banner(constants_js_1.BANNER);
    index_js_2.logger.newline();
    console.log(chalk_1.default.bold('  Welcome to the Agentics Foundation TV5 Hackathon!'));
    console.log(chalk_1.default.gray('  Build the future of agentic AI with Google Cloud'));
    index_js_2.logger.newline();
    console.log(chalk_1.default.bold.cyan('  Quick Commands:'));
    index_js_2.logger.newline();
    const commands = [
        { cmd: 'npx agentics-hackathon init', desc: 'Initialize a new project' },
        { cmd: 'npx agentics-hackathon tools', desc: 'Browse and install 17+ AI tools' },
        { cmd: 'npx agentics-hackathon status', desc: 'Check project status' },
        { cmd: 'npx agentics-hackathon info', desc: 'View hackathon details' },
        { cmd: 'npx agentics-hackathon mcp', desc: 'Start MCP server' },
        { cmd: 'npx agentics-hackathon discord', desc: 'Join the community' },
        { cmd: 'npx agentics-hackathon help', desc: 'Detailed help & examples' }
    ];
    commands.forEach(({ cmd, desc }) => {
        console.log(`  ${chalk_1.default.cyan(cmd.padEnd(24))} ${chalk_1.default.gray(desc)}`);
    });
    index_js_2.logger.newline();
    index_js_2.logger.divider();
    index_js_2.logger.newline();
    console.log(chalk_1.default.bold('  Get Started:'));
    console.log(`  ${chalk_1.default.yellow('$')} ${chalk_1.default.cyan('npx agentics-hackathon init')}`);
    index_js_2.logger.newline();
    console.log(chalk_1.default.bold('  Resources:'));
    console.log(`  ${chalk_1.default.gray('Website:')}  ${chalk_1.default.cyan.underline(constants_js_1.WEBSITE_URL)}`);
    console.log(`  ${chalk_1.default.gray('Discord:')}  ${chalk_1.default.cyan.underline(constants_js_1.DISCORD_URL)}`);
    index_js_2.logger.newline();
});
// Parse arguments
program.parse();
//# sourceMappingURL=cli.js.map