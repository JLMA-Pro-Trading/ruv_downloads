#!/usr/bin/env node
"use strict";
/**
 * MCP Server - STDIO Transport
 * Run with: npx @agenticsorg/hackathon mcp stdio
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const readline = __importStar(require("readline"));
const server_js_1 = require("./server.js");
const server = new server_js_1.McpServer();
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});
let buffer = '';
rl.on('line', async (line) => {
    buffer += line;
    try {
        const request = JSON.parse(buffer);
        buffer = '';
        const response = await server.handleRequest(request);
        console.log(JSON.stringify(response));
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            // Incomplete JSON, continue buffering
            return;
        }
        // Other error
        console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
                code: -32700,
                message: 'Parse error'
            }
        }));
        buffer = '';
    }
});
rl.on('close', () => {
    process.exit(0);
});
// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});
// Log startup to stderr (not stdout, which is for MCP messages)
console.error('Agentics Hackathon MCP Server (STDIO) started');
//# sourceMappingURL=stdio.js.map