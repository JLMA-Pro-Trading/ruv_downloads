#!/usr/bin/env node

/**
 * MCP Server Wrapper with SSE Support for SPARC 2.0
 * This script extends the standard MCP wrapper with Server-Sent Events (SSE) support
 * for real-time progress updates during long-running operations.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import and run the actual MCP server wrapper
import("./src/mcp/mcpServerWrapper.js").catch((error) => {
  console.error(`Failed to start MCP server: ${error.message}`);
  process.exit(1);
});

console.error("[MCP SSE Wrapper] Starting MCP server with SSE support...");