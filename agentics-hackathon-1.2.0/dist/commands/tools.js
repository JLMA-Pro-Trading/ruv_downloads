"use strict";
/**
 * Tools command - List and install hackathon tools
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolsCommand = toolsCommand;
const enquirer_1 = require("enquirer");
const chalk_1 = __importDefault(require("chalk"));
const constants_js_1 = require("../constants.js");
const index_js_1 = require("../utils/index.js");
async function toolsCommand(options) {
    // List available tools (with optional category filter)
    if (options.list || options.available || (!options.install && !options.check && options.json)) {
        await listTools(options);
        return;
    }
    // Check installed status
    if (options.check) {
        await checkTools(options);
        return;
    }
    // Install specific tools
    if (options.install && options.install.length > 0) {
        await installTools(options.install, options);
        return;
    }
    // Interactive mode (only if not json/quiet)
    if (!options.json && !options.quiet) {
        await interactiveToolInstall();
    }
}
async function listTools(options) {
    const categories = {
        'ai-assistants': 'AI Assistants',
        'orchestration': 'Orchestration & Agent Frameworks',
        'cloud-platform': 'Cloud Platform',
        'databases': 'Databases & Memory',
        'synthesis': 'Synthesis & Advanced Tools',
        'python-frameworks': 'Python Frameworks'
    };
    // Filter by category if specified
    let tools = constants_js_1.AVAILABLE_TOOLS;
    if (options.category) {
        tools = constants_js_1.AVAILABLE_TOOLS.filter(t => t.category === options.category);
        if (tools.length === 0) {
            if (options.json) {
                console.log(JSON.stringify({ success: false, error: 'invalid_category', message: `Unknown category: ${options.category}`, validCategories: Object.keys(categories) }));
                process.exit(1);
            }
            index_js_1.logger.error(`Unknown category: ${options.category}`);
            index_js_1.logger.info(`Valid categories: ${Object.keys(categories).join(', ')}`);
            return;
        }
    }
    // JSON output
    if (options.json) {
        const toolsWithStatus = await Promise.all(tools.map(async (tool) => ({
            name: tool.name,
            displayName: tool.displayName,
            description: tool.description,
            category: tool.category,
            installCommand: tool.installCommand,
            docUrl: tool.docUrl,
            installed: await (0, index_js_1.checkToolInstalled)(tool)
        })));
        console.log(JSON.stringify({ success: true, tools: toolsWithStatus, categories: Object.keys(categories) }));
        return;
    }
    index_js_1.logger.info('Available tools for the hackathon:\n');
    for (const [category, label] of Object.entries(categories)) {
        if (options.category && options.category !== category)
            continue;
        const categoryTools = tools.filter(t => t.category === category);
        if (categoryTools.length > 0) {
            console.log(chalk_1.default.bold.cyan(`\n${label}:`));
            for (const tool of categoryTools) {
                const installed = await (0, index_js_1.checkToolInstalled)(tool);
                const status = installed ? chalk_1.default.green('✔') : chalk_1.default.gray('○');
                console.log(`  ${status} ${chalk_1.default.bold(tool.displayName)}`);
                console.log(`    ${chalk_1.default.gray(tool.description)}`);
                console.log(`    ${chalk_1.default.gray('Install:')} ${chalk_1.default.cyan(tool.installCommand)}`);
            }
        }
    }
    index_js_1.logger.newline();
    index_js_1.logger.info('Run `npx agentics-hackathon tools --install <tool>` to install a specific tool');
    index_js_1.logger.info('Run `npx agentics-hackathon tools --check` to check installed status');
}
async function checkTools(options) {
    const results = [];
    for (const tool of constants_js_1.AVAILABLE_TOOLS) {
        const installed = await (0, index_js_1.checkToolInstalled)(tool);
        results.push({ tool, installed });
    }
    const installedTools = results.filter(r => r.installed);
    const notInstalledTools = results.filter(r => !r.installed);
    // JSON output
    if (options.json) {
        console.log(JSON.stringify({
            success: true,
            installed: installedTools.map(r => ({ name: r.tool.name, displayName: r.tool.displayName })),
            notInstalled: notInstalledTools.map(r => ({ name: r.tool.name, displayName: r.tool.displayName })),
            summary: { installed: installedTools.length, total: results.length }
        }));
        return;
    }
    index_js_1.logger.info('Checking installed tools...\n');
    if (installedTools.length > 0) {
        console.log(chalk_1.default.bold.green('Installed:'));
        installedTools.forEach(({ tool }) => {
            console.log(`  ${chalk_1.default.green('✔')} ${tool.displayName}`);
        });
    }
    if (notInstalledTools.length > 0) {
        console.log(chalk_1.default.bold.yellow('\nNot Installed:'));
        notInstalledTools.forEach(({ tool }) => {
            console.log(`  ${chalk_1.default.gray('○')} ${tool.displayName}`);
        });
    }
    index_js_1.logger.newline();
    index_js_1.logger.info(`${installedTools.length}/${results.length} tools installed`);
}
async function installTools(toolNames, options) {
    const config = (0, index_js_1.loadConfig)();
    const results = [];
    for (const name of toolNames) {
        const tool = constants_js_1.AVAILABLE_TOOLS.find(t => t.name === name || t.displayName.toLowerCase() === name.toLowerCase());
        if (!tool) {
            if (options.json) {
                results.push({ name, success: false, error: 'unknown_tool' });
                continue;
            }
            index_js_1.logger.error(`Unknown tool: ${name}`);
            index_js_1.logger.info('Run `npx agentics-hackathon tools --list` to see available tools');
            continue;
        }
        if (options.json || options.quiet) {
            // Silent install - just update config
            results.push({ name: tool.name, success: true });
            if (config) {
                const toolKey = tool.name;
                (0, index_js_1.updateConfig)({
                    tools: { ...config.tools, [toolKey]: true }
                });
            }
        }
        else {
            const result = await (0, index_js_1.installTool)(tool);
            results.push({ name: tool.name, success: result.status === 'success', error: result.message });
            if (result.status === 'success' && config) {
                const toolKey = tool.name;
                (0, index_js_1.updateConfig)({
                    tools: { ...config.tools, [toolKey]: true }
                });
            }
        }
    }
    if (options.json) {
        console.log(JSON.stringify({
            success: results.every(r => r.success),
            results,
            summary: { successful: results.filter(r => r.success).length, total: results.length }
        }));
    }
}
async function interactiveToolInstall() {
    const choices = constants_js_1.AVAILABLE_TOOLS.map(tool => ({
        name: tool.name,
        message: tool.displayName,
        hint: tool.description
    }));
    const { selectedTools } = await (0, enquirer_1.prompt)({
        type: 'multiselect',
        name: 'selectedTools',
        message: 'Select tools to install:',
        choices
    });
    if (selectedTools.length === 0) {
        index_js_1.logger.info('No tools selected');
        return;
    }
    await installTools(selectedTools, {});
}
//# sourceMappingURL=tools.js.map