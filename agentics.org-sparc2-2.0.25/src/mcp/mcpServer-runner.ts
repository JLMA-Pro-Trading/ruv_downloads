/**
 * MCP Server Runner
 * This script runs the MCP server directly
 */

import { parse } from "https://deno.land/std@0.215.0/flags/mod.ts";
import { startMCPServer } from "./mcpServer.ts";

// Parse command line arguments
const args = parse(Deno.args, {
  string: ["port", "model", "mode", "diff-mode", "processing", "config"],
  alias: {
    p: "port",
    c: "config",
  },
  default: {
    port: "3001",
  },
});

// Convert port to number
const port = parseInt(args.port, 10);

// Start the MCP server
await startMCPServer({
  port,
  model: args.model,
  mode: args.mode as any,
  diffMode: args["diff-mode"] as any,
  processing: args.processing as any,
  configPath: args.config,
});

// Keep the process running
await new Promise(() => {
  // This promise never resolves, keeping the process alive
  console.log(`SPARC2 MCP server running on http://localhost:${port}`);
  console.log("Press Ctrl+C to stop the server");
});
