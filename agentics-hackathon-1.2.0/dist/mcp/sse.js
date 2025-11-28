#!/usr/bin/env node
"use strict";
/**
 * MCP Server - SSE (Server-Sent Events) Transport
 * Run with: npx @agenticsorg/hackathon mcp sse --port 3000
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSseServer = startSseServer;
const express_1 = __importDefault(require("express"));
const server_js_1 = require("./server.js");
const DEFAULT_PORT = 3000;
function startSseServer(port = DEFAULT_PORT) {
    const app = (0, express_1.default)();
    const server = new server_js_1.McpServer();
    app.use(express_1.default.json());
    // CORS headers for SSE
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.sendStatus(200);
            return;
        }
        next();
    });
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', server: 'agentics-hackathon-mcp' });
    });
    // SSE endpoint for MCP
    app.get('/sse', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Send initial connection event
        res.write(`event: connected\ndata: ${JSON.stringify({ server: 'agentics-hackathon-mcp' })}\n\n`);
        // Keep connection alive
        const keepAlive = setInterval(() => {
            res.write(': keepalive\n\n');
        }, 30000);
        req.on('close', () => {
            clearInterval(keepAlive);
        });
    });
    // JSON-RPC endpoint for MCP requests
    app.post('/rpc', async (req, res) => {
        const request = req.body;
        if (!request.jsonrpc || request.jsonrpc !== '2.0') {
            res.status(400).json({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32600,
                    message: 'Invalid Request: jsonrpc must be "2.0"'
                }
            });
            return;
        }
        const response = await server.handleRequest(request);
        res.json(response);
    });
    // Info endpoint
    app.get('/', (req, res) => {
        res.json({
            name: 'Agentics Hackathon MCP Server',
            version: '1.0.0',
            transport: 'sse',
            endpoints: {
                sse: '/sse',
                rpc: '/rpc',
                health: '/health'
            },
            capabilities: {
                tools: true,
                resources: true,
                prompts: true
            }
        });
    });
    app.listen(port, () => {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  Agentics Hackathon MCP Server (SSE)                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${String(port).padEnd(50)}║
║  SSE:       http://localhost:${port}/sse                         ║
║  RPC:       http://localhost:${port}/rpc                         ║
║  Health:    http://localhost:${port}/health                      ║
╚═══════════════════════════════════════════════════════════════╝
    `);
    });
}
// Run if called directly
if (process.argv[1]?.endsWith('sse.js')) {
    const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
    startSseServer(port);
}
//# sourceMappingURL=sse.js.map