"use strict";
/**
 * Configuration management utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigPath = getConfigPath;
exports.configExists = configExists;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.createDefaultConfig = createDefaultConfig;
exports.updateConfig = updateConfig;
const fs_1 = require("fs");
const path_1 = require("path");
const constants_js_1 = require("../constants.js");
const DEFAULT_TOOLS = {
    // AI Assistants
    claudeCode: false,
    geminiCli: false,
    // Orchestration
    claudeFlow: false,
    agenticFlow: false,
    flowNexus: false,
    adk: false,
    // Cloud Platform
    googleCloudCli: false,
    vertexAi: false,
    // Databases
    ruvector: false,
    agentDb: false,
    // Synthesis
    agenticSynth: false,
    strangeLoops: false,
    sparc: false,
    // Python Frameworks
    lionpride: false,
    agenticFramework: false,
    openaiAgents: false
};
function getConfigPath(dir = process.cwd()) {
    return (0, path_1.join)(dir, constants_js_1.CONFIG_FILE);
}
function configExists(dir) {
    return (0, fs_1.existsSync)(getConfigPath(dir));
}
function loadConfig(dir) {
    const configPath = getConfigPath(dir);
    if (!(0, fs_1.existsSync)(configPath)) {
        return null;
    }
    try {
        const content = (0, fs_1.readFileSync)(configPath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
function saveConfig(config, dir) {
    const configPath = getConfigPath(dir);
    (0, fs_1.writeFileSync)(configPath, JSON.stringify(config, null, 2), 'utf-8');
}
function createDefaultConfig(projectName) {
    return {
        projectName,
        tools: { ...DEFAULT_TOOLS },
        mcpEnabled: false,
        discordLinked: false,
        initialized: false,
        createdAt: new Date().toISOString()
    };
}
function updateConfig(updates, dir) {
    const existing = loadConfig(dir) || createDefaultConfig('hackathon-project');
    const updated = { ...existing, ...updates };
    saveConfig(updated, dir);
    return updated;
}
//# sourceMappingURL=config.js.map