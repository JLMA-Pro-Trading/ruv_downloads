/**
 * Analyze Command module for SPARC 2.0
 * Implements the analyze command for the CLI
 */

import { logInfo, logError } from "../logger.ts";
import { FileToProcess, SPARC2Agent } from "../agent/agent.ts";

interface AnalyzeCommandOptions {
  files: string;
  model: string;
  mode: string;
  "diff-mode": string;
  processing: string;
  output?: string;
}

/**
 * Reads the content of files specified by paths.
 * @param filePaths Array of file paths
 * @returns Array of FileToProcess objects
 */
async function readFiles(filePaths: string[]): Promise<FileToProcess[]> {
  return Promise.all(filePaths.map(async (path) => {
    try {
      const content = await Deno.readTextFile(path);
      return {
        path,
        originalContent: content,
      };
    } catch (error) {
      handleError(`Error reading file ${path}`, error);
    }
  }));
}

/**
 * Handles errors by logging and throwing them.
 * @param message Error message
 * @param error Error object
 */
function handleError(message: string, error: unknown): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logError(`${message}: ${errorMessage}`);
  throw error;
}

/**
 * Analyze command action
 * @param args Command arguments
 * @param options Command options
 */
export async function analyzeCommand(
  args: Record<string, any>, // Consider refining this type if possible
  options: AnalyzeCommandOptions,
): Promise<void> {
  try {
    // Parse file paths
    const filePaths = options.files.split(",").map((f: string) => f.trim());

    // Read file contents
    const files = await readFiles(filePaths);

    // Initialize agent
    logInfo("Initializing SPARC2Agent...");
    const agent = new SPARC2Agent({
      model: options.model,
      mode: options.mode,
      diffMode: options["diff-mode"],
      processing: options.processing,
    });
    await agent.init();

    // Analyze changes
    logInfo("Starting analysis...");
    const analysis = await agent.planAndExecute("Analyze code without making changes", files);

    // Output results
    if (options.output) {
      try {
        await Deno.writeTextFile(options.output, JSON.stringify(analysis, null, 2));
        logInfo(`Analysis written to ${options.output}`);
      } catch (error) {
        handleError("Error writing to output file", error);
      }
    } else {
      logInfo("Analysis Results:");
      logInfo(JSON.stringify(analysis, null, 2));
    }
  } catch (error: unknown) {
    handleError("Error during analyzeCommand execution", error);
  }
}