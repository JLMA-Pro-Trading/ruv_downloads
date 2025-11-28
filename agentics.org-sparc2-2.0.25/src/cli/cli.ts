/**
 * CLI module for SPARC 2.0
 * Provides a command-line interface for the autonomous diff-based coding bot
 */

import { parse, stringify } from "https://deno.land/std@0.215.0/toml/mod.ts";
import { loadConfig, SPARCConfig } from "../config.ts";
import { AgentOptions, FileToProcess, SPARC2Agent } from "../agent/agent.ts";
import { LogEntry, logMessage } from "../logger.ts";
import { executeCode } from "../sandbox/codeInterpreter.ts";
import { DiffEntry, searchDiffEntries } from "../vector/vectorStore.ts";
import { mcpCommand } from "./mcpCommand.ts";
import { apiCommand } from "./apiCommand.ts";

// Use a hardcoded version
const VERSION = "2.0.24";

/**
 * CLI command structure
 */
interface Command {
  name: string;
  description: string;
  options: CommandOption[];
  action: (args: Record<string, any>, options: Record<string, any>) => Promise<void>;
}

/**
 * CLI command option
 */
interface CommandOption {
  name: string;
  shortName?: string;
  description: string;
  type: "string" | "boolean" | "number";
  required?: boolean;
  default?: any;
}

/**
 * Display help information
 */
function printHelp(): void {
  console.log(`SPARC 2.0 CLI v${VERSION}`);
  console.log("\nUsage: sparc2 <command> [options]");
  console.log("\nCommands:");

  for (const command of commands) {
    console.log(`  ${command.name.padEnd(15)} ${command.description}`);
  }

  console.log("\nOptions:");
  console.log("  --help, -h       Show help");
  console.log("  --version, -v    Show version");

  console.log("\nFor command-specific help, run: sparc2 <command> --help");
}

/**
 * Print help for a specific command
 * @param command Command to print help for
 */
function printCommandHelp(command: Command): void {
  console.log(`SPARC 2.0 CLI v${VERSION}`);
  console.log(`\nCommand: ${command.name}`);
  console.log(`\n${command.description}`);
  console.log("\nOptions:");

  for (const option of command.options) {
    const shortFlag = option.shortName ? `-${option.shortName}, ` : "    ";
    const required = option.required ? " (required)" : "";
    const defaultValue = option.default !== undefined ? ` (default: ${option.default})` : "";
    console.log(
      `  ${shortFlag}--${option.name.padEnd(15)} ${option.description}${required}${defaultValue}`,
    );
  }
}

/**
 * Analyze command action
 */
async function analyzeCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Parse file paths
    const filePaths = options.files.split(",").map((f: string) => f.trim());

    // Read file contents
    const files: FileToProcess[] = [];
    for (const path of filePaths) {
      const content = await Deno.readTextFile(path);
      files.push({
        path,
        originalContent: content,
      });
    }

    // Initialize agent
    const agent = new SPARC2Agent({
      model: options.model,
      mode: options.mode,
      diffMode: options["diff-mode"],
      processing: options.processing,
    });
    await agent.init();

    // Analyze changes
    const analysis = await agent.planAndExecute("Analyze code without making changes", files);

    // Output results
    if (options.output) {
      await Deno.writeTextFile(options.output, JSON.stringify(analysis, null, 2));
      console.log(`Analysis written to ${options.output}`);
    } else {
      console.log("Analysis Results:");
      console.log(JSON.stringify(analysis, null, 2));
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * Modify command action
 */
async function modifyCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Parse file paths
    const filePaths = options.files.split(",").map((f: string) => f.trim());

    // Read file contents
    const files: FileToProcess[] = [];
    for (const path of filePaths) {
      const content = await Deno.readTextFile(path);
      files.push({
        path,
        originalContent: content,
      });
    }

    // Read suggestions
    let suggestions = options.suggestions;
    if (suggestions.endsWith(".txt") || suggestions.endsWith(".md")) {
      suggestions = await Deno.readTextFile(suggestions);
    }

    // Initialize agent
    const agent = new SPARC2Agent({
      model: options.model,
      mode: options.mode,
      diffMode: options["diff-mode"],
      processing: options.processing,
    });
    await agent.init();

    // Apply changes
    const results = await agent.planAndExecute(suggestions, files);

    // Output results
    console.log(`Modification completed. Modified ${results.length} files:`);
    for (const result of results) {
      console.log(`- ${result.path} ${result.commitHash ? `(commit: ${result.commitHash})` : ""}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * Execute command action
 */
async function executeCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Read file content if file is provided
    let code: string;
    if (options.file) {
      code = await Deno.readTextFile(options.file);
    } else if (options.code) {
      code = options.code;
    } else {
      throw new Error("Either --file or --code is required");
    }

    // Determine language from file extension if not specified
    let language = options.language;
    if (!language && options.file) {
      const extension = options.file.split(".").pop()?.toLowerCase();
      if (extension === "py") {
        language = "python";
      } else if (extension === "js") {
        language = "javascript";
      } else if (extension === "ts") {
        language = "typescript";
      }
    }

    // Execute code
    const result = await executeCode(code, {
      language,
      stream: options.stream,
      timeout: options.timeout,
    });

    // Output results
    console.log("Execution Results:");
    console.log(result.text);

    if (result.logs.stdout.length > 0) {
      console.log("\nStandard Output:");
      for (const line of result.logs.stdout) {
        console.log(line);
      }
    }

    if (result.logs.stderr.length > 0) {
      console.error("\nStandard Error:");
      for (const line of result.logs.stderr) {
        console.error(line);
      }
    }

    if (result.error) {
      console.error("\nError:", result.error.value);
      Deno.exit(1);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * Search command action
 */
async function searchCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Search for similar changes
    const results = await searchDiffEntries(options.query, options["max-results"]);

    // Output results
    console.log("Search Results:");
    if (results.length === 0) {
      console.log("No results found.");
      return;
    }

    for (const result of results) {
      // Check if the entry is a DiffEntry
      if ("file" in result.entry && "diff" in result.entry) {
        const diffEntry = result.entry as DiffEntry;
        console.log(`\nFile: ${diffEntry.file} (Score: ${result.score.toFixed(2)})`);
        console.log("Diff:");
        console.log(diffEntry.diff);
      } else {
        // Handle LogEntry case
        const logEntry = result.entry as LogEntry;
        console.log(
          `\nLog: ${logEntry.timestamp} [${logEntry.level}] (Score: ${result.score.toFixed(2)})`,
        );
        console.log("Message:");
        console.log(logEntry.message);
      }
      console.log("-".repeat(80));
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * Checkpoint command action
 */
async function checkpointCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Initialize agent
    const agent = new SPARC2Agent();
    await agent.init();

    // Create checkpoint
    // Sanitize the message to create a valid git tag (no spaces, special characters)
    const sanitizedMessage = options.message.replace(/[^a-zA-Z0-9_-]/g, "_");
    const commitHash = await agent.createCheckpoint(sanitizedMessage);

    // Output results
    console.log(`Checkpoint created: ${commitHash}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * Rollback command action
 */
async function rollbackCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    // Initialize agent
    const agent = new SPARC2Agent();
    await agent.init();

    // Determine rollback mode
    const target = options.commit;
    const mode = target.match(/^\d{4}-\d{2}-\d{2}/) ? "temporal" : "checkpoint";

    // Rollback to checkpoint
    await agent.rollback(target, mode);

    // Output results
    console.log(`Rolled back to ${mode === "temporal" ? "date" : "checkpoint"}: ${target}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * Get configuration value
 * @param key Configuration key
 * @returns Configuration value
 */
async function getConfigValue(key: string): Promise<any> {
  const configPath = Deno.env.get("SPARC2_CONFIG_PATH") || "config/sparc2-config.toml";

  try {
    // Check if config file exists
    try {
      await Deno.stat(configPath);
    } catch {
      // Config file doesn't exist, create it
      await Deno.writeTextFile(configPath, "# SPARC2 Configuration\n");
      return undefined;
    }

    // Read config file
    const configContent = await Deno.readTextFile(configPath);

    // Parse TOML
    const config = parse(configContent);

    // Handle nested keys (e.g., "agent.name")
    const keys = key.split(".");
    let value: any = config;

    for (const k of keys) {
      if (value === undefined || value === null) {
        return undefined;
      }

      value = value[k];
    }

    return value;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error reading configuration: ${errorMessage}`);
    return undefined;
  }
}

/**
 * Set configuration value
 * @param key Configuration key
 * @param value Configuration value
 */
async function setConfigValue(key: string, value: any): Promise<void> {
  const configPath = Deno.env.get("SPARC2_CONFIG_PATH") || "config/sparc2-config.toml";

  try {
    // Read existing config
    let config: Record<string, any> = {};

    try {
      const configContent = await Deno.readTextFile(configPath);
      config = parse(configContent);
    } catch {
      // File doesn't exist or is empty, use empty config
    }

    // Handle nested keys (e.g., "agent.name")
    const keys = key.split(".");
    let current: any = config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];

      if (current[k] === undefined || current[k] === null || typeof current[k] !== "object") {
        current[k] = {};
      }

      current = current[k];
    }

    // Set the value
    current[keys[keys.length - 1]] = value;

    // Write config file
    await Deno.writeTextFile(configPath, stringify(config));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error setting configuration: ${errorMessage}`);
    throw error;
  }
}

/**
 * Config command action
 */
async function configCommand(
  args: Record<string, any>,
  options: Record<string, any>,
): Promise<void> {
  try {
    const action = options.action;

    switch (action) {
      case "get": {
        if (!options.key) {
          throw new Error("Key is required for 'get' action");
        }

        const value = await getConfigValue(options.key);
        console.log(
          `${options.key} = ${value !== undefined ? JSON.stringify(value) : "undefined"}`,
        );
        break;
      }

      case "set": {
        if (!options.key || options.value === undefined) {
          throw new Error("Key and value are required for 'set' action");
        }

        // Parse value if it's a JSON string
        let parsedValue = options.value;
        if (typeof parsedValue === "string") {
          try {
            if (parsedValue.startsWith("{") || parsedValue.startsWith("[")) {
              parsedValue = JSON.parse(parsedValue);
            } else if (parsedValue === "true") {
              parsedValue = true;
            } else if (parsedValue === "false") {
              parsedValue = false;
            } else if (!isNaN(Number(parsedValue))) {
              parsedValue = Number(parsedValue);
            }
          } catch {
            // If parsing fails, use the original string value
          }
        }

        await setConfigValue(options.key, parsedValue);
        console.log(`${options.key} set to ${JSON.stringify(parsedValue)}`);
        break;
      }

      case "list": {
        const configPath = Deno.env.get("SPARC2_CONFIG_PATH") || "config/sparc2-config.toml";

        try {
          const configContent = await Deno.readTextFile(configPath);
          const config = parse(configContent);

          console.log("Configuration:");
          console.log(JSON.stringify(config, null, 2));
        } catch (error) {
          console.log("No configuration found or error reading configuration.");
        }
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

/**
 * CLI commands
 */
const commands: Command[] = [
  {
    name: "analyze",
    description: "Analyze code files for issues and improvements",
    options: [
      {
        name: "files",
        description: "Comma-separated list of files to analyze",
        type: "string",
        required: true,
      },
      {
        name: "output",
        shortName: "o",
        description: "Output file for analysis results",
        type: "string",
      },
      {
        name: "model",
        description: "Model to use for analysis",
        type: "string",
      },
      {
        name: "mode",
        description: "Execution mode (automatic, semi, manual, custom)",
        type: "string",
      },
      {
        name: "diff-mode",
        description: "Diff mode (file, function)",
        type: "string",
      },
      {
        name: "processing",
        description: "Processing mode (parallel, sequential, concurrent, swarm)",
        type: "string",
      },
    ],
    action: analyzeCommand,
  },
  {
    name: "modify",
    description: "Apply suggested modifications to code files",
    options: [
      {
        name: "files",
        description: "Comma-separated list of files to modify",
        type: "string",
        required: true,
      },
      {
        name: "suggestions",
        shortName: "s",
        description: "Suggestions file or string",
        type: "string",
        required: true,
      },
      {
        name: "model",
        description: "Model to use for modifications",
        type: "string",
      },
      {
        name: "mode",
        description: "Execution mode (automatic, semi, manual, custom)",
        type: "string",
      },
      {
        name: "diff-mode",
        description: "Diff mode (file, function)",
        type: "string",
      },
      {
        name: "processing",
        description: "Processing mode (parallel, sequential, concurrent, swarm)",
        type: "string",
      },
    ],
    action: modifyCommand,
  },
  {
    name: "execute",
    description: "Execute code in a sandbox",
    options: [
      {
        name: "file",
        description: "File to execute",
        type: "string",
      },
      {
        name: "code",
        description: "Code to execute",
        type: "string",
      },
      {
        name: "language",
        shortName: "l",
        description: "Programming language (python, javascript, typescript)",
        type: "string",
        default: "javascript",
      },
      {
        name: "stream",
        description: "Stream output",
        type: "boolean",
        default: false,
      },
      {
        name: "timeout",
        description: "Timeout in milliseconds",
        type: "number",
        default: 30000,
      },
    ],
    action: executeCommand,
  },
  {
    name: "search",
    description: "Search for similar code changes",
    options: [
      {
        name: "query",
        description: "Search query",
        type: "string",
        required: true,
      },
      {
        name: "max-results",
        shortName: "n",
        description: "Maximum number of results",
        type: "number",
        default: 5,
      },
    ],
    action: searchCommand,
  },
  {
    name: "checkpoint",
    description: "Create a git checkpoint",
    options: [
      {
        name: "message",
        shortName: "m",
        description: "Checkpoint message",
        type: "string",
        required: true,
      },
    ],
    action: checkpointCommand,
  },
  {
    name: "rollback",
    description: "Rollback to a previous checkpoint",
    options: [
      {
        name: "commit",
        description: "Commit hash or date to rollback to",
        type: "string",
        required: true,
      },
    ],
    action: rollbackCommand,
  },
  {
    name: "config",
    description: "Manage configuration",
    options: [
      {
        name: "action",
        description: "Configuration action (get, set, list)",
        type: "string",
        required: true,
      },
      {
        name: "key",
        description: "Configuration key",
        type: "string",
      },
      {
        name: "value",
        description: "Configuration value",
        type: "string",
      },
    ],
    action: configCommand,
  },
  {
    name: "api",
    description: "Start a Model Context Protocol (MCP) HTTP API server",
    options: [
      {
        name: "port",
        shortName: "p",
        description: "Port to run the API server on",
        type: "number",
        default: 3001,
      },
      {
        name: "model",
        description: "Model to use for the agent",
        type: "string",
      },
      {
        name: "mode",
        description: "Execution mode (automatic, semi, manual, custom, interactive)",
        type: "string",
      },
      {
        name: "diff-mode",
        description: "Diff mode (file, function)",
        type: "string",
      },
      {
        name: "processing",
        description: "Processing mode (sequential, parallel, concurrent, swarm)",
        type: "string",
      },
      {
        name: "config",
        shortName: "c",
        description: "Path to the agent configuration file",
        type: "string",
      },
    ],
    action: apiCommand,
  },
  {
    name: "mcp",
    description: "Start a Model Context Protocol (MCP) server using stdio transport",
    options: [
      {
        name: "model",
        description: "Model to use for the agent",
        type: "string",
      },
      {
        name: "mode",
        description: "Execution mode (automatic, semi, manual, custom, interactive)",
        type: "string",
      },
      {
        name: "diff-mode",
        description: "Diff mode (file, function)",
        type: "string",
      },
      {
        name: "processing",
        description: "Processing mode (sequential, parallel, concurrent, swarm)",
        type: "string",
      },
      {
        name: "config",
        shortName: "c",
        description: "Path to the agent configuration file",
        type: "string",
      },
    ],
    action: mcpCommand,
  },
];

/**
 * Main CLI function
 * @param args Command line arguments
 */
export async function main(args: string[] = Deno.args): Promise<void> {
  try {
    // Parse command and options
    if (args.length === 0) {
      printHelp();
      return;
    }

    const commandName = args[0];

    if (commandName === "--help" || commandName === "-h") {
      printHelp();
      return;
    }

    if (commandName === "--version" || commandName === "-v") {
      console.log(`SPARC2 CLI v${VERSION}`);
      return;
    }

    const command = commands.find((cmd) => cmd.name === commandName);

    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      printHelp();
      Deno.exit(1);
    }

    // Check if command-specific help is requested
    if (args.includes("--help") || args.includes("-h")) {
      printCommandHelp(command);
      return;
    }

    // Parse command options
    const options: Record<string, any> = {};
    const commandArgs: Record<string, any> = {};

    for (let i = 1; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        // Long option
        const optionName = arg.slice(2);
        const option = command.options.find((opt) => opt.name === optionName);

        if (!option) {
          console.error(`Unknown option: ${arg}`);
          Deno.exit(1);
        }

        if (option.type === "boolean") {
          options[optionName] = true;
        } else {
          if (i + 1 >= args.length) {
            console.error(`Option ${arg} requires a value`);
            Deno.exit(1);
          }

          options[optionName] = args[++i];
        }
      } else if (arg.startsWith("-")) {
        // Short option
        const shortName = arg.slice(1);
        const option = command.options.find((opt) => opt.shortName === shortName);

        if (!option) {
          console.error(`Unknown option: ${arg}`);
          Deno.exit(1);
        }

        if (option.type === "boolean") {
          options[option.name] = true;
        } else {
          if (i + 1 >= args.length) {
            console.error(`Option ${arg} requires a value`);
            Deno.exit(1);
          }

          options[option.name] = args[++i];
        }
      } else {
        // Positional argument
        const positionalOptions = command.options.filter((opt) =>
          opt.required && !(opt.name in options)
        );
        if (positionalOptions.length > 0) {
          options[positionalOptions[0].name] = arg;
        } else {
          console.error(`Unexpected argument: ${arg}`);
          Deno.exit(1);
        }
      }
    }

    // Check required options
    for (const option of command.options) {
      if (option.required && !(option.name in options)) {
        console.error(`Required option missing: ${option.name}`);
        Deno.exit(1);
      }

      // Set default values
      if (option.default !== undefined && !(option.name in options)) {
        options[option.name] = option.default;
      }

      // Convert number options
      if (option.type === "number" && options[option.name] !== undefined) {
        options[option.name] = Number(options[option.name]);
      }
    }

    // Execute command
    await command.action(commandArgs, options);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${errorMessage}`);
    Deno.exit(1);
  }
}

// Run main function if this is the main module
if (import.meta.main) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    Deno.exit(1);
  });
}
