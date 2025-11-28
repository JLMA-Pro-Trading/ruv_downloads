"use strict";
/**
 * Init command - Interactive setup wizard for hackathon projects
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const enquirer_1 = require("enquirer");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const constants_js_1 = require("../constants.js");
const index_js_1 = require("../utils/index.js");
async function initCommand(options) {
    const isQuiet = options.quiet || options.json;
    // Show banner (unless quiet/json mode)
    if (!isQuiet) {
        index_js_1.logger.banner(constants_js_1.BANNER);
        console.log(constants_js_1.WELCOME_MESSAGE);
        index_js_1.logger.divider();
    }
    // Check if already initialized
    if ((0, index_js_1.configExists)() && !options.force) {
        const config = (0, index_js_1.loadConfig)();
        if (config?.initialized) {
            if (options.json) {
                console.log(JSON.stringify({ success: false, error: 'already_initialized', message: 'Project already initialized. Use --force to reinitialize.' }));
                process.exit(1);
            }
            index_js_1.logger.warning('Project already initialized!');
            index_js_1.logger.info('Use --force to reinitialize');
            return;
        }
    }
    // Check prerequisites
    if (!isQuiet)
        index_js_1.logger.info('Checking prerequisites...');
    const prereqs = await (0, index_js_1.checkPrerequisites)();
    if (!prereqs.node || !prereqs.npm) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'missing_prerequisites', message: 'Node.js and npm are required.', prereqs }));
            process.exit(1);
        }
        index_js_1.logger.error('Node.js and npm are required. Please install them first.');
        index_js_1.logger.link('Download Node.js', 'https://nodejs.org');
        return;
    }
    if (!isQuiet) {
        index_js_1.logger.success('Prerequisites check passed');
        index_js_1.logger.newline();
    }
    let config;
    if (options.yes || options.json) {
        // Non-interactive mode with defaults
        config = await runNonInteractive(options);
    }
    else {
        // Interactive mode
        config = await runInteractive(options);
    }
    // Save configuration
    if (!isQuiet) {
        const spinner = (0, ora_1.default)('Saving configuration...').start();
        config.initialized = true;
        (0, index_js_1.saveConfig)(config);
        spinner.succeed('Configuration saved');
    }
    else {
        config.initialized = true;
        (0, index_js_1.saveConfig)(config);
    }
    // Output result
    if (options.json) {
        console.log(JSON.stringify({ success: true, config }));
    }
    else {
        showSummary(config);
    }
}
async function runInteractive(options) {
    // Project name
    const { projectName } = await (0, enquirer_1.prompt)({
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        initial: process.cwd().split('/').pop() || 'hackathon-project'
    });
    // Team name
    const { teamName } = await (0, enquirer_1.prompt)({
        type: 'input',
        name: 'teamName',
        message: 'Team name (optional):',
        initial: options.team || ''
    });
    // Track selection
    const trackChoices = Object.entries(constants_js_1.TRACKS).map(([value, { name, description }]) => ({
        name: value,
        message: name,
        hint: description
    }));
    const { track } = await (0, enquirer_1.prompt)({
        type: 'select',
        name: 'track',
        message: 'Select hackathon track:',
        choices: trackChoices,
        initial: options.track ? Object.keys(constants_js_1.TRACKS).indexOf(options.track) : 0
    });
    index_js_1.logger.newline();
    index_js_1.logger.info('Select tools to install (all optional):');
    index_js_1.logger.newline();
    // Group tools by category
    const toolCategories = {
        'AI Assistants': constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === 'ai-assistants'),
        'Orchestration': constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === 'orchestration'),
        'Databases': constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === 'databases'),
        'Cloud Platform': constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === 'cloud-platform'),
        'Synthesis': constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === 'synthesis')
    };
    const toolChoices = Object.entries(toolCategories).flatMap(([category, tools]) => [
        { name: `--- ${category} ---`, disabled: true },
        ...tools.map(tool => ({
            name: tool.name,
            message: `${tool.displayName}`,
            hint: tool.description,
            value: tool.name
        }))
    ]);
    const { selectedTools } = await enquirer_1.prompt({
        type: 'multiselect',
        name: 'selectedTools',
        message: 'Select tools to install:',
        choices: toolChoices,
        initial: options.tools || []
    });
    // MCP configuration
    const { enableMcp } = await (0, enquirer_1.prompt)({
        type: 'confirm',
        name: 'enableMcp',
        message: 'Enable MCP (Model Context Protocol) server?',
        initial: false
    });
    // Discord
    const { joinDiscord } = await (0, enquirer_1.prompt)({
        type: 'confirm',
        name: 'joinDiscord',
        message: `Join Discord for team coordination? (${constants_js_1.DISCORD_URL})`,
        initial: true
    });
    // Build configuration
    const tools = {
        // AI Assistants
        claudeCode: selectedTools.includes('claudeCode'),
        geminiCli: selectedTools.includes('geminiCli'),
        // Orchestration
        claudeFlow: selectedTools.includes('claudeFlow'),
        agenticFlow: selectedTools.includes('agenticFlow'),
        flowNexus: selectedTools.includes('flowNexus'),
        adk: selectedTools.includes('adk'),
        // Cloud Platform
        googleCloudCli: selectedTools.includes('googleCloudCli'),
        vertexAi: selectedTools.includes('vertexAi'),
        // Databases
        ruvector: selectedTools.includes('ruvector'),
        agentDb: selectedTools.includes('agentDb'),
        // Synthesis
        agenticSynth: selectedTools.includes('agenticSynth'),
        strangeLoops: selectedTools.includes('strangeLoops'),
        sparc: selectedTools.includes('sparc'),
        // Python Frameworks
        lionpride: selectedTools.includes('lionpride'),
        agenticFramework: selectedTools.includes('agenticFramework'),
        openaiAgents: selectedTools.includes('openaiAgents')
    };
    // Install selected tools
    if (selectedTools.length > 0) {
        index_js_1.logger.newline();
        index_js_1.logger.divider();
        index_js_1.logger.info('Installing selected tools...');
        index_js_1.logger.newline();
        for (const toolName of selectedTools) {
            const tool = constants_js_1.AVAILABLE_TOOLS.find(t => t.name === toolName);
            if (tool) {
                await (0, index_js_1.installTool)(tool);
            }
        }
    }
    // Open Discord if selected
    if (joinDiscord) {
        index_js_1.logger.newline();
        index_js_1.logger.box(`Join our Discord community for:\n` +
            `  • Team formation\n` +
            `  • Technical support\n` +
            `  • Announcements\n` +
            `  • Networking\n\n` +
            chalk_1.default.cyan.underline(constants_js_1.DISCORD_URL), 'Discord Community');
    }
    return {
        projectName,
        teamName: teamName || undefined,
        track,
        tools,
        mcpEnabled: enableMcp,
        discordLinked: joinDiscord,
        initialized: true,
        createdAt: new Date().toISOString()
    };
}
async function runNonInteractive(options) {
    const projectName = options.project || process.cwd().split('/').pop() || 'hackathon-project';
    const isQuiet = options.quiet || options.json;
    const tools = {
        // AI Assistants
        claudeCode: options.tools?.includes('claudeCode') || false,
        geminiCli: options.tools?.includes('geminiCli') || false,
        // Orchestration
        claudeFlow: options.tools?.includes('claudeFlow') || false,
        agenticFlow: options.tools?.includes('agenticFlow') || false,
        flowNexus: options.tools?.includes('flowNexus') || false,
        adk: options.tools?.includes('adk') || false,
        // Cloud Platform
        googleCloudCli: options.tools?.includes('googleCloudCli') || false,
        vertexAi: options.tools?.includes('vertexAi') || false,
        // Databases
        ruvector: options.tools?.includes('ruvector') || false,
        agentDb: options.tools?.includes('agentDb') || false,
        // Synthesis
        agenticSynth: options.tools?.includes('agenticSynth') || false,
        strangeLoops: options.tools?.includes('strangeLoops') || false,
        sparc: options.tools?.includes('sparc') || false,
        // Python Frameworks
        lionpride: options.tools?.includes('lionpride') || false,
        agenticFramework: options.tools?.includes('agenticFramework') || false,
        openaiAgents: options.tools?.includes('openaiAgents') || false
    };
    // Install selected tools (skip in quiet mode unless explicitly requested)
    if (options.tools && options.tools.length > 0 && !isQuiet) {
        for (const toolName of options.tools) {
            const tool = constants_js_1.AVAILABLE_TOOLS.find(t => t.name === toolName);
            if (tool) {
                await (0, index_js_1.installTool)(tool);
            }
        }
    }
    return {
        projectName,
        teamName: options.team,
        track: options.track,
        tools,
        mcpEnabled: options.mcp || false,
        discordLinked: false,
        initialized: true,
        createdAt: new Date().toISOString()
    };
}
function showSummary(config) {
    index_js_1.logger.newline();
    index_js_1.logger.divider();
    index_js_1.logger.box(`${chalk_1.default.bold('Project:')} ${config.projectName}\n` +
        (config.teamName ? `${chalk_1.default.bold('Team:')} ${config.teamName}\n` : '') +
        (config.track ? `${chalk_1.default.bold('Track:')} ${constants_js_1.TRACKS[config.track].name}\n` : '') +
        `${chalk_1.default.bold('MCP:')} ${config.mcpEnabled ? 'Enabled' : 'Disabled'}\n` +
        `\n${chalk_1.default.bold('Installed Tools:')}\n` +
        Object.entries(config.tools)
            .filter(([_, enabled]) => enabled)
            .map(([name]) => {
            const tool = constants_js_1.AVAILABLE_TOOLS.find(t => t.name === name);
            return `  • ${tool?.displayName || name}`;
        })
            .join('\n') || '  • None', `${constants_js_1.HACKATHON_NAME} - Setup Complete`);
    index_js_1.logger.newline();
    index_js_1.logger.info('Next steps:');
    index_js_1.logger.list([
        'Start building your project',
        config.mcpEnabled ? 'Run `hackathon mcp` to start the MCP server' : '',
        `Visit ${constants_js_1.WEBSITE_URL} for resources`,
        `Join ${constants_js_1.DISCORD_URL} for support`
    ].filter(Boolean));
    index_js_1.logger.newline();
}
//# sourceMappingURL=init.js.map