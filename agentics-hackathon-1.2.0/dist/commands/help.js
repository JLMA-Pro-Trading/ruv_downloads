"use strict";
/**
 * Help command - Detailed help and documentation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.helpCommand = helpCommand;
const chalk_1 = __importDefault(require("chalk"));
const constants_js_1 = require("../constants.js");
const index_js_1 = require("../utils/index.js");
async function helpCommand(options) {
    const topic = options.topic?.toLowerCase();
    switch (topic) {
        case 'init':
            showInitHelp();
            break;
        case 'tools':
            showToolsHelp();
            break;
        case 'mcp':
            showMcpHelp();
            break;
        case 'tracks':
            showTracksHelp();
            break;
        case 'examples':
            showExamplesHelp();
            break;
        case 'packages':
            showPackagesHelp();
            break;
        default:
            showGeneralHelp();
    }
}
function showGeneralHelp() {
    console.log(chalk_1.default.bold.cyan(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     ${constants_js_1.HACKATHON_NAME}                      ║
║                            DETAILED HELP                                     ║
╚══════════════════════════════════════════════════════════════════════════════╝
`));
    console.log(chalk_1.default.bold('DESCRIPTION'));
    console.log(`  The Agentics Hackathon CLI helps you set up and manage your hackathon
  project with support for 17+ AI development tools across 6 categories.
`);
    console.log(chalk_1.default.bold('QUICK START'));
    console.log(`  ${chalk_1.default.cyan('npx agentics-hackathon init')}     Initialize a new project
  ${chalk_1.default.cyan('npx agentics-hackathon tools')}    Browse & install AI tools
  ${chalk_1.default.cyan('npx agentics-hackathon info')}     View hackathon information
`);
    console.log(chalk_1.default.bold('COMMANDS'));
    console.log(`  ${chalk_1.default.cyan('init')}      Initialize a hackathon project with interactive setup
  ${chalk_1.default.cyan('tools')}     List, check, or install development tools
  ${chalk_1.default.cyan('status')}    Show current project configuration
  ${chalk_1.default.cyan('info')}      Display hackathon details and resources
  ${chalk_1.default.cyan('mcp')}       Start MCP server (stdio or sse transport)
  ${chalk_1.default.cyan('discord')}   Open Discord community link
  ${chalk_1.default.cyan('help')}      Show this help or topic-specific help
`);
    console.log(chalk_1.default.bold('HELP TOPICS'));
    console.log(`  ${chalk_1.default.cyan('npx agentics-hackathon help init')}       Setup and initialization options
  ${chalk_1.default.cyan('npx agentics-hackathon help tools')}      Available tools and installation
  ${chalk_1.default.cyan('npx agentics-hackathon help mcp')}        MCP server configuration
  ${chalk_1.default.cyan('npx agentics-hackathon help tracks')}     Hackathon track descriptions
  ${chalk_1.default.cyan('npx agentics-hackathon help examples')}   Usage examples and workflows
  ${chalk_1.default.cyan('npx agentics-hackathon help packages')}   All available packages detailed
`);
    console.log(chalk_1.default.bold('RESOURCES'));
    console.log(`  ${chalk_1.default.gray('Website:')}   ${chalk_1.default.cyan.underline(constants_js_1.WEBSITE_URL)}
  ${chalk_1.default.gray('Discord:')}   ${chalk_1.default.cyan.underline(constants_js_1.DISCORD_URL)}
  ${chalk_1.default.gray('GitHub:')}    ${chalk_1.default.cyan.underline(constants_js_1.GITHUB_URL)}
`);
}
function showInitHelp() {
    console.log(chalk_1.default.bold.cyan('\n═══ INIT COMMAND HELP ═══\n'));
    console.log(chalk_1.default.bold('USAGE'));
    console.log(`  ${chalk_1.default.cyan('npx agentics-hackathon init [options]')}
`);
    console.log(chalk_1.default.bold('DESCRIPTION'));
    console.log(`  Initialize a new hackathon project with an interactive setup wizard.
  Creates a .hackathon.json config file and optionally installs tools.
`);
    console.log(chalk_1.default.bold('OPTIONS'));
    console.log(`  ${chalk_1.default.cyan('-f, --force')}           Reinitialize even if already configured
  ${chalk_1.default.cyan('-y, --yes')}             Skip prompts and use defaults
  ${chalk_1.default.cyan('-t, --tools <list>')}    Tools to install (space-separated)
  ${chalk_1.default.cyan('--track <track>')}       Select hackathon track
  ${chalk_1.default.cyan('--team <name>')}         Set team name
`);
    console.log(chalk_1.default.bold('EXAMPLES'));
    console.log(`  ${chalk_1.default.gray('# Interactive setup (recommended)')}
  ${chalk_1.default.cyan('npx agentics-hackathon init')}

  ${chalk_1.default.gray('# Quick setup with specific tools')}
  ${chalk_1.default.cyan('npx agentics-hackathon init --tools claudeFlow agenticFlow adk')}

  ${chalk_1.default.gray('# Non-interactive with all options')}
  ${chalk_1.default.cyan('npx agentics-hackathon init -y --team "AI Wizards" --track multi-agent-systems')}

  ${chalk_1.default.gray('# Force reinitialize')}
  ${chalk_1.default.cyan('npx agentics-hackathon init --force')}
`);
}
function showToolsHelp() {
    console.log(chalk_1.default.bold.cyan('\n═══ TOOLS COMMAND HELP ═══\n'));
    console.log(chalk_1.default.bold('USAGE'));
    console.log(`  ${chalk_1.default.cyan('npx agentics-hackathon tools [options]')}
`);
    console.log(chalk_1.default.bold('DESCRIPTION'));
    console.log(`  Browse, check, and install AI development tools for the hackathon.
  Currently supports ${constants_js_1.AVAILABLE_TOOLS.length} tools across 6 categories.
`);
    console.log(chalk_1.default.bold('OPTIONS'));
    console.log(`  ${chalk_1.default.cyan('-l, --list')}              List all available tools
  ${chalk_1.default.cyan('-c, --check')}             Check which tools are installed
  ${chalk_1.default.cyan('-i, --install <tools>')}   Install specific tools
`);
    console.log(chalk_1.default.bold('CATEGORIES'));
    const categories = {
        'ai-assistants': 'AI Assistants',
        'orchestration': 'Orchestration & Agent Frameworks',
        'cloud-platform': 'Cloud Platform',
        'databases': 'Databases & Memory',
        'synthesis': 'Synthesis & Advanced Tools',
        'python-frameworks': 'Python Frameworks'
    };
    Object.entries(categories).forEach(([key, label]) => {
        const tools = constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === key);
        console.log(`  ${chalk_1.default.bold.magenta(label)} (${tools.length} tools)`);
        tools.forEach(t => {
            console.log(`    ${chalk_1.default.cyan(t.name.padEnd(20))} ${chalk_1.default.gray(t.description.substring(0, 50))}...`);
        });
    });
    console.log(`
${chalk_1.default.bold('EXAMPLES')}
  ${chalk_1.default.gray('# List all tools')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --list')}

  ${chalk_1.default.gray('# Check installed status')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --check')}

  ${chalk_1.default.gray('# Install multiple tools')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install claudeFlow agenticFlow lionpride')}
`);
}
function showMcpHelp() {
    console.log(chalk_1.default.bold.cyan('\n═══ MCP SERVER HELP ═══\n'));
    console.log(chalk_1.default.bold('USAGE'));
    console.log(`  ${chalk_1.default.cyan('npx agentics-hackathon mcp [transport] [options]')}
`);
    console.log(chalk_1.default.bold('DESCRIPTION'));
    console.log(`  Start an MCP (Model Context Protocol) server for AI integration.
  Supports both STDIO and SSE (Server-Sent Events) transports.
`);
    console.log(chalk_1.default.bold('TRANSPORTS'));
    console.log(`  ${chalk_1.default.cyan('stdio')}    Standard input/output (default) - for local AI tools
  ${chalk_1.default.cyan('sse')}      Server-Sent Events - for web-based integrations
`);
    console.log(chalk_1.default.bold('OPTIONS'));
    console.log(`  ${chalk_1.default.cyan('-p, --port <port>')}    Port for SSE server (default: 3000)
`);
    console.log(chalk_1.default.bold('MCP TOOLS PROVIDED'));
    console.log(`  ${chalk_1.default.cyan('get_hackathon_info')}     Get hackathon information
  ${chalk_1.default.cyan('get_tracks')}             List available tracks
  ${chalk_1.default.cyan('get_available_tools')}    List development tools
  ${chalk_1.default.cyan('get_project_status')}     Check project configuration
  ${chalk_1.default.cyan('check_tool_installed')}   Verify tool installation
  ${chalk_1.default.cyan('get_resources')}          Get hackathon resources
`);
    console.log(chalk_1.default.bold('CLAUDE DESKTOP CONFIG'));
    console.log(`  Add to your Claude configuration (~/.claude/claude_desktop_config.json):

  ${chalk_1.default.cyan(`{
    "mcpServers": {
      "hackathon": {
        "command": "npx",
        "args": ["agentics-hackathon", "mcp", "stdio"]
      }
    }
  }`)}
`);
    console.log(chalk_1.default.bold('EXAMPLES'));
    console.log(`  ${chalk_1.default.gray('# Start STDIO server')}
  ${chalk_1.default.cyan('npx agentics-hackathon mcp stdio')}

  ${chalk_1.default.gray('# Start SSE server on port 3001')}
  ${chalk_1.default.cyan('npx agentics-hackathon mcp sse --port 3001')}
`);
}
function showTracksHelp() {
    console.log(chalk_1.default.bold.cyan('\n═══ HACKATHON TRACKS ═══\n'));
    Object.entries(constants_js_1.TRACKS).forEach(([key, { name, description }]) => {
        console.log(chalk_1.default.bold.magenta(`${name}`));
        console.log(`  ${chalk_1.default.gray('ID:')} ${chalk_1.default.cyan(key)}`);
        console.log(`  ${chalk_1.default.gray('Description:')} ${description}`);
        console.log();
    });
    console.log(chalk_1.default.bold('RECOMMENDED TOOLS BY TRACK'));
    console.log(`
  ${chalk_1.default.bold.magenta('Entertainment Discovery')}
    ${chalk_1.default.cyan('claudeFlow, geminiCli, vertexAi, ruvector')}

  ${chalk_1.default.bold.magenta('Multi-Agent Systems')}
    ${chalk_1.default.cyan('agenticFlow, flowNexus, adk, lionpride, openaiAgents')}

  ${chalk_1.default.bold.magenta('Agentic Workflows')}
    ${chalk_1.default.cyan('claudeFlow, sparc, strangeLoops, agenticFramework')}

  ${chalk_1.default.bold.magenta('Open Innovation')}
    ${chalk_1.default.cyan('Choose based on your project needs!')}
`);
}
function showExamplesHelp() {
    console.log(chalk_1.default.bold.cyan('\n═══ USAGE EXAMPLES ═══\n'));
    console.log(chalk_1.default.bold('GETTING STARTED'));
    console.log(`  ${chalk_1.default.gray('# 1. Initialize your project')}
  ${chalk_1.default.cyan('npx agentics-hackathon init')}

  ${chalk_1.default.gray('# 2. Install recommended tools')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install claudeFlow agenticFlow adk')}

  ${chalk_1.default.gray('# 3. Check your setup')}
  ${chalk_1.default.cyan('npx agentics-hackathon status')}
`);
    console.log(chalk_1.default.bold('MULTI-AGENT WORKFLOW'));
    console.log(`  ${chalk_1.default.gray('# Set up a multi-agent project')}
  ${chalk_1.default.cyan('npx agentics-hackathon init --track multi-agent-systems')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install agenticFlow flowNexus lionpride')}
  ${chalk_1.default.cyan('npx agentic-flow init')}
  ${chalk_1.default.cyan('npx flow-nexus init')}
`);
    console.log(chalk_1.default.bold('USING WITH CLAUDE'));
    console.log(`  ${chalk_1.default.gray('# Start MCP server for Claude integration')}
  ${chalk_1.default.cyan('npx agentics-hackathon mcp stdio')}

  ${chalk_1.default.gray('# Or for web-based access')}
  ${chalk_1.default.cyan('npx agentics-hackathon mcp sse --port 3000')}
`);
    console.log(chalk_1.default.bold('PYTHON-BASED PROJECT'));
    console.log(`  ${chalk_1.default.gray('# Install Python agent frameworks')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install lionpride agenticFramework openaiAgents adk')}

  ${chalk_1.default.gray('# Then in your Python code:')}
  ${chalk_1.default.green(`from lionpride import Agent
from agentic import create_agent`)}
`);
    console.log(chalk_1.default.bold('QUICK DEMO'));
    console.log(`  ${chalk_1.default.gray('# One-liner to test everything')}
  ${chalk_1.default.cyan('npx agentics-hackathon init -y && npx agentics-hackathon tools --list && npx agentics-hackathon status')}
`);
}
function showPackagesHelp() {
    console.log(chalk_1.default.bold.cyan('\n═══ ALL AVAILABLE PACKAGES ═══\n'));
    console.log(chalk_1.default.bold('NPM PACKAGES (Node.js)'));
    index_js_1.logger.divider();
    const npmTools = constants_js_1.AVAILABLE_TOOLS.filter(t => t.installCommand.includes('npm') || t.installCommand.includes('npx'));
    npmTools.forEach(tool => {
        console.log(`
  ${chalk_1.default.bold.cyan(tool.displayName)} (${chalk_1.default.gray(tool.name)})
    ${tool.description}
    ${chalk_1.default.yellow('Install:')} ${chalk_1.default.white(tool.installCommand)}
    ${chalk_1.default.yellow('Docs:')}    ${chalk_1.default.cyan.underline(tool.docUrl)}`);
    });
    console.log(chalk_1.default.bold('\n\nPIP PACKAGES (Python)'));
    index_js_1.logger.divider();
    const pipTools = constants_js_1.AVAILABLE_TOOLS.filter(t => t.installCommand.includes('pip'));
    pipTools.forEach(tool => {
        console.log(`
  ${chalk_1.default.bold.cyan(tool.displayName)} (${chalk_1.default.gray(tool.name)})
    ${tool.description}
    ${chalk_1.default.yellow('Install:')} ${chalk_1.default.white(tool.installCommand)}
    ${chalk_1.default.yellow('Docs:')}    ${chalk_1.default.cyan.underline(tool.docUrl)}`);
    });
    console.log(chalk_1.default.bold('\n\nOTHER INSTALLATIONS'));
    index_js_1.logger.divider();
    const otherTools = constants_js_1.AVAILABLE_TOOLS.filter(t => !t.installCommand.includes('npm') &&
        !t.installCommand.includes('npx') &&
        !t.installCommand.includes('pip'));
    otherTools.forEach(tool => {
        console.log(`
  ${chalk_1.default.bold.cyan(tool.displayName)} (${chalk_1.default.gray(tool.name)})
    ${tool.description}
    ${chalk_1.default.yellow('Install:')} ${chalk_1.default.white(tool.installCommand)}
    ${chalk_1.default.yellow('Docs:')}    ${chalk_1.default.cyan.underline(tool.docUrl)}`);
    });
    console.log(`

${chalk_1.default.bold('QUICK INSTALL BY CATEGORY')}
  ${chalk_1.default.gray('# All orchestration tools')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install claudeFlow agenticFlow flowNexus adk')}

  ${chalk_1.default.gray('# All Python frameworks')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install lionpride agenticFramework openaiAgents')}

  ${chalk_1.default.gray('# Recommended starter pack')}
  ${chalk_1.default.cyan('npx agentics-hackathon tools --install claudeCode claudeFlow agenticFlow geminiCli')}
`);
}
//# sourceMappingURL=help.js.map