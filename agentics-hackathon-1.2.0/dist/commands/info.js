"use strict";
/**
 * Info command - Display hackathon information and resources
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.infoCommand = infoCommand;
const chalk_1 = __importDefault(require("chalk"));
const constants_js_1 = require("../constants.js");
const index_js_1 = require("../utils/index.js");
async function infoCommand(options = {}) {
    // JSON output
    if (options.json) {
        console.log(JSON.stringify({
            success: true,
            hackathon: {
                name: constants_js_1.HACKATHON_NAME,
                tagline: constants_js_1.HACKATHON_TAGLINE,
                sponsor: constants_js_1.HACKATHON_SPONSOR,
                description: constants_js_1.HACKATHON_DESCRIPTION
            },
            tracks: Object.entries(constants_js_1.TRACKS).map(([id, { name, description }]) => ({
                id,
                name,
                description
            })),
            technologies: [
                'Google Gemini 2.5 Pro (1M token context)',
                'Google Agent Development Kit (ADK)',
                'Vertex AI & Google Cloud Platform',
                'Claude Code & Claude Flow',
                'Multi-agent orchestration systems'
            ],
            resources: {
                website: constants_js_1.WEBSITE_URL,
                discord: constants_js_1.DISCORD_URL,
                github: constants_js_1.GITHUB_URL,
                adkDocs: 'https://google.github.io/adk-docs/',
                vertexAiDocs: 'https://cloud.google.com/vertex-ai/docs',
                claudeDocs: 'https://docs.anthropic.com'
            }
        }));
        return;
    }
    index_js_1.logger.banner(constants_js_1.BANNER);
    index_js_1.logger.newline();
    // Hackathon overview
    index_js_1.logger.box(`${chalk_1.default.bold(constants_js_1.HACKATHON_NAME)}\n` +
        `${constants_js_1.HACKATHON_TAGLINE}\n\n` +
        `${chalk_1.default.gray('Supported by Google Cloud')}\n\n` +
        `Every night, millions spend up to 45 minutes deciding what to watch —\n` +
        `billions of hours lost every day. Not from lack of content, but from\n` +
        `fragmentation. Join us to build the future of agentic AI systems.`, 'About the Hackathon');
    // Tracks
    console.log(chalk_1.default.bold.cyan('\n  Hackathon Tracks:\n'));
    Object.entries(constants_js_1.TRACKS).forEach(([key, { name, description }]) => {
        console.log(`  ${chalk_1.default.bold.magenta('●')} ${chalk_1.default.bold(name)}`);
        console.log(`    ${chalk_1.default.gray(description)}\n`);
    });
    // What you'll build
    index_js_1.logger.box(`${chalk_1.default.bold('Technologies:')}\n` +
        `  • Google Gemini 2.5 Pro (1M token context)\n` +
        `  • Google Agent Development Kit (ADK)\n` +
        `  • Vertex AI & Google Cloud Platform\n` +
        `  • Claude Code & Claude Flow\n` +
        `  • Multi-agent orchestration systems\n\n` +
        `${chalk_1.default.bold('Project Types:')}\n` +
        `  • Content discovery & recommendation agents\n` +
        `  • Multi-agent collaboration systems\n` +
        `  • Agentic workflow automation\n` +
        `  • Open innovation solutions`, 'What You\'ll Build');
    // Resources
    console.log(chalk_1.default.bold.cyan('\n  Resources:\n'));
    index_js_1.logger.table({
        'Website': constants_js_1.WEBSITE_URL,
        'Discord': constants_js_1.DISCORD_URL,
        'GitHub': constants_js_1.GITHUB_URL,
        'Google ADK Docs': 'https://google.github.io/adk-docs/',
        'Vertex AI Docs': 'https://cloud.google.com/vertex-ai/docs',
        'Claude Docs': 'https://docs.anthropic.com'
    });
    // Quick start
    index_js_1.logger.box(`${chalk_1.default.bold('1.')} Initialize your project:\n` +
        `   ${chalk_1.default.cyan('npx agentics-hackathon init')}\n\n` +
        `${chalk_1.default.bold('2.')} Install recommended tools:\n` +
        `   ${chalk_1.default.cyan('npx agentics-hackathon tools --install claudeFlow geminiCli adk')}\n\n` +
        `${chalk_1.default.bold('3.')} Join the community:\n` +
        `   ${chalk_1.default.cyan(constants_js_1.DISCORD_URL)}\n\n` +
        `${chalk_1.default.bold('4.')} Start building!`, 'Quick Start');
    index_js_1.logger.newline();
}
//# sourceMappingURL=info.js.map