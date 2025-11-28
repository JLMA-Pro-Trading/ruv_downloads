/**
 * MCP Command module for SPARC 2.0
 * Implements the MCP server command for the CLI using stdio transport
 */

import { logInfo } from "../logger.ts";
import * as path from "https://deno.land/std@0.215.0/path/mod.ts";
import { exists } from "https://deno.land/std@0.215.0/fs/exists.ts";

/**
 * MCP command action
 * @param args Command arguments
 * @param options Command options
 */
export async function mcpCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Try multiple possible locations for the mcpServerWrapper.js file
    const denoDir = Deno.cwd();
    const possiblePaths = [
      // Current directory's src/mcp path
      path.join(denoDir, "src", "mcp", "mcpServerWrapper.js"),
      // Project root's src/mcp path
      path.join(denoDir, "..", "src", "mcp", "mcpServerWrapper.js"),
      // Absolute path from project root
      path.join(denoDir, "..", "..", "src", "mcp", "mcpServerWrapper.js"),
      // Direct path to the wrapper in scripts/sparc2
      path.join(denoDir, "..", "..", "scripts", "sparc2", "src", "mcp", "mcpServerWrapper.js"),
      // From scripts/sparc2 directory
      path.join(denoDir, "src", "mcp", "mcpServerWrapper.js"),
    ];

    // Find the first path that exists
    let wrapperPath = null;
    for (const testPath of possiblePaths) {
      if (await exists(testPath)) {
        wrapperPath = testPath;
        break;
      }
    }

    // If no path exists, try to find it relative to the main module path
    if (!wrapperPath) {
      const mainModuleDir = path.dirname(path.fromFileUrl(Deno.mainModule));
      const relativeToMainModule = path.join(mainModuleDir, "..", "mcp", "mcpServerWrapper.js");
      if (await exists(relativeToMainModule)) {
        wrapperPath = relativeToMainModule;
      }
    }

    // Check if we found the wrapper
    if (!wrapperPath) {
      throw new Error(`MCP server wrapper not found. Tried paths: ${possiblePaths.join(", ")}`);
    }

    console.log(`Found MCP server wrapper at: ${wrapperPath}`);

    // Log startup
    await logInfo("Starting SPARC2 MCP server using stdio transport");

    // Create environment variables object
    const env = {
      ...Deno.env.toObject(),
      // Pass any additional options as environment variables
      SPARC2_MODEL: options.model || "",
      SPARC2_MODE: options.mode || "",
      SPARC2_DIFF_MODE: options.diffMode || "",
      SPARC2_PROCESSING: options.processing || "",
      SPARC2_CONFIG_PATH: options.config || "",
    };

    // Start the Node.js process with the wrapper using the Command API
    const command = new Deno.Command("node", {
      args: [wrapperPath],
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      env: env,
    });

    // Start the process
    const process = command.spawn();

    // Keep the process running
    await new Promise(() => {
      // This promise never resolves, keeping the process alive
      console.log(`SPARC2 MCP server running on stdio transport`);
      console.log("Press Ctrl+C to stop the server");
    });

    // This code will never be reached due to the never-resolving promise above,
    // but it's good practice to include it for cleanup if needed
    const status = await process.status;
    if (!status.success) {
      console.error(`MCP server exited with code ${status.code}`);
      Deno.exit(status.code);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error starting MCP server: ${errorMessage}`);
    Deno.exit(1);
  }
}
