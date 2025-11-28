#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Find the strange-loops package
const strangeLoopsPath = require.resolve('strange-loops/mcp/server.js');

console.error(`
╔══════════════════════════════════════════════════════════════╗
║                   🌀 STRANGE LOOPS MCP 🌀                    ║
║                                                              ║
║    Nano-agent swarm • Temporal consciousness • WASM core     ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

🚀 MCP Server starting...
`);

// Start the MCP server
const mcpServer = spawn('node', [strangeLoopsPath], {
  stdio: 'inherit',
  env: process.env
});

mcpServer.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ MCP server exited with code ${code}`);
    process.exit(code);
  }
});

mcpServer.on('error', (err) => {
  console.error('❌ Failed to start MCP server:', err);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.error('\n🛑 Stopping MCP server...');
  mcpServer.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.error('\n🛑 Stopping MCP server...');
  mcpServer.kill('SIGTERM');
});