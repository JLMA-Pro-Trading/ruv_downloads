/**
 * API Command module for SPARC 2.0
 * Implements the HTTP API server command for the CLI
 */

import { startMCPServer } from "../mcp/mcpServer.ts";
import { logInfo } from "../logger.ts";

/**
 * API command action
 * @param args Command arguments
 * @param options Command options
 */
export async function apiCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    const port = options.port ? parseInt(options.port, 10) : 3001;

    // Server startup will be logged in the mcpServer module

    // Start the MCP HTTP API server
    await startMCPServer({
      port,
      model: options.model,
      mode: options.mode as "automatic" | "semi" | "manual" | "custom" | "interactive",
      diffMode: options.diffMode as "file" | "function",
      processing: options.processing as "sequential" | "parallel" | "concurrent" | "swarm",
      configPath: options.config,
    });

    // Keep the process running
    await new Promise(() => {
      // This promise never resolves, keeping the process alive
      console.log(`SPARC2 API server running on http://localhost:${port}`);
      console.log("Press Ctrl+C to stop the server");
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error starting API server: ${errorMessage}`);
    Deno.exit(1);
  }
}
