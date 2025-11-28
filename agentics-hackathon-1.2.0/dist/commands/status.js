"use strict";
/**
 * Status command - Show current hackathon project status
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusCommand = statusCommand;
const chalk_1 = __importDefault(require("chalk"));
const constants_js_1 = require("../constants.js");
const index_js_1 = require("../utils/index.js");
async function statusCommand(options = {}) {
    if (!(0, index_js_1.configExists)()) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'not_initialized', message: 'Project not initialized. Run init first.' }));
            process.exit(1);
        }
        index_js_1.logger.warning('Not initialized. Run `npx agentics-hackathon init` first.');
        return;
    }
    const config = (0, index_js_1.loadConfig)();
    if (!config) {
        if (options.json) {
            console.log(JSON.stringify({ success: false, error: 'config_error', message: 'Failed to load configuration.' }));
            process.exit(1);
        }
        index_js_1.logger.error('Failed to load configuration');
        return;
    }
    // Check tools status
    const enabledTools = Object.entries(config.tools)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name);
    const toolsStatus = [];
    for (const toolName of enabledTools) {
        const tool = constants_js_1.AVAILABLE_TOOLS.find(t => t.name === toolName);
        if (tool) {
            const installed = await (0, index_js_1.checkToolInstalled)(tool);
            toolsStatus.push({ name: tool.name, displayName: tool.displayName, installed });
        }
    }
    // JSON output
    if (options.json) {
        console.log(JSON.stringify({
            success: true,
            config: {
                projectName: config.projectName,
                teamName: config.teamName,
                track: config.track,
                trackName: config.track ? constants_js_1.TRACKS[config.track].name : null,
                mcpEnabled: config.mcpEnabled,
                discordLinked: config.discordLinked,
                initialized: config.initialized,
                createdAt: config.createdAt
            },
            tools: toolsStatus,
            resources: {
                website: constants_js_1.WEBSITE_URL,
                discord: constants_js_1.DISCORD_URL,
                configFile: '.hackathon.json'
            }
        }));
        return;
    }
    index_js_1.logger.divider();
    console.log(chalk_1.default.bold.cyan('  Hackathon Project Status'));
    index_js_1.logger.divider();
    index_js_1.logger.newline();
    // Project info
    index_js_1.logger.table({
        'Project': config.projectName,
        'Team': config.teamName || 'Not set',
        'Track': config.track ? constants_js_1.TRACKS[config.track].name : 'Not selected',
        'Initialized': new Date(config.createdAt).toLocaleDateString(),
        'MCP Server': config.mcpEnabled ? 'Enabled' : 'Disabled',
        'Discord': config.discordLinked ? 'Connected' : 'Not connected'
    });
    index_js_1.logger.newline();
    index_js_1.logger.divider();
    console.log(chalk_1.default.bold.cyan('  Tools Status'));
    index_js_1.logger.divider();
    index_js_1.logger.newline();
    if (toolsStatus.length === 0) {
        index_js_1.logger.info('No tools configured. Run `npx agentics-hackathon tools` to install tools.');
    }
    else {
        for (const { displayName, installed } of toolsStatus) {
            const status = installed ? chalk_1.default.green('✔ Ready') : chalk_1.default.yellow('⚠ Needs setup');
            console.log(`  ${status} ${displayName}`);
        }
    }
    index_js_1.logger.newline();
    index_js_1.logger.divider();
    console.log(chalk_1.default.bold.cyan('  Resources'));
    index_js_1.logger.divider();
    index_js_1.logger.newline();
    index_js_1.logger.table({
        'Website': constants_js_1.WEBSITE_URL,
        'Discord': constants_js_1.DISCORD_URL,
        'Config File': '.hackathon.json'
    });
    index_js_1.logger.newline();
}
//# sourceMappingURL=status.js.map