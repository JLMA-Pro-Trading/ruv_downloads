"use strict";
/**
 * Agentics Foundation TV5 Hackathon - Main Module
 *
 * This module exports the core functionality for programmatic use.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSseServer = exports.McpServer = exports.checkPrerequisites = exports.installTool = exports.checkToolInstalled = exports.updateConfig = exports.createDefaultConfig = exports.configExists = exports.saveConfig = exports.loadConfig = exports.logger = exports.CONFIG_FILE = exports.GITHUB_URL = exports.WEBSITE_URL = exports.DISCORD_URL = exports.AVAILABLE_TOOLS = exports.TRACKS = exports.HACKATHON_TAGLINE = exports.HACKATHON_NAME = void 0;
// Types
__exportStar(require("./types.js"), exports);
// Constants
var constants_js_1 = require("./constants.js");
Object.defineProperty(exports, "HACKATHON_NAME", { enumerable: true, get: function () { return constants_js_1.HACKATHON_NAME; } });
Object.defineProperty(exports, "HACKATHON_TAGLINE", { enumerable: true, get: function () { return constants_js_1.HACKATHON_TAGLINE; } });
Object.defineProperty(exports, "TRACKS", { enumerable: true, get: function () { return constants_js_1.TRACKS; } });
Object.defineProperty(exports, "AVAILABLE_TOOLS", { enumerable: true, get: function () { return constants_js_1.AVAILABLE_TOOLS; } });
Object.defineProperty(exports, "DISCORD_URL", { enumerable: true, get: function () { return constants_js_1.DISCORD_URL; } });
Object.defineProperty(exports, "WEBSITE_URL", { enumerable: true, get: function () { return constants_js_1.WEBSITE_URL; } });
Object.defineProperty(exports, "GITHUB_URL", { enumerable: true, get: function () { return constants_js_1.GITHUB_URL; } });
Object.defineProperty(exports, "CONFIG_FILE", { enumerable: true, get: function () { return constants_js_1.CONFIG_FILE; } });
// Utilities
var index_js_1 = require("./utils/index.js");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return index_js_1.logger; } });
Object.defineProperty(exports, "loadConfig", { enumerable: true, get: function () { return index_js_1.loadConfig; } });
Object.defineProperty(exports, "saveConfig", { enumerable: true, get: function () { return index_js_1.saveConfig; } });
Object.defineProperty(exports, "configExists", { enumerable: true, get: function () { return index_js_1.configExists; } });
Object.defineProperty(exports, "createDefaultConfig", { enumerable: true, get: function () { return index_js_1.createDefaultConfig; } });
Object.defineProperty(exports, "updateConfig", { enumerable: true, get: function () { return index_js_1.updateConfig; } });
Object.defineProperty(exports, "checkToolInstalled", { enumerable: true, get: function () { return index_js_1.checkToolInstalled; } });
Object.defineProperty(exports, "installTool", { enumerable: true, get: function () { return index_js_1.installTool; } });
Object.defineProperty(exports, "checkPrerequisites", { enumerable: true, get: function () { return index_js_1.checkPrerequisites; } });
// MCP Server
var index_js_2 = require("./mcp/index.js");
Object.defineProperty(exports, "McpServer", { enumerable: true, get: function () { return index_js_2.McpServer; } });
Object.defineProperty(exports, "startSseServer", { enumerable: true, get: function () { return index_js_2.startSseServer; } });
//# sourceMappingURL=index.js.map