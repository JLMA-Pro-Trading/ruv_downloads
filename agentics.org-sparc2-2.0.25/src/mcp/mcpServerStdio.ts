/**
 * MCP Server module for SPARC 2.0 using stdio transport
 * Implements a Model Context Protocol server for SPARC2 using the MCP SDK
 */

import { Server } from "npm:@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "npm:@modelcontextprotocol/sdk/types.js";
import { FileToProcess, SPARC2Agent } from "../agent/agent.ts";
import { logDebug, logError, logInfo } from "../logger.ts";
import { executeCode } from "../sandbox/codeInterpreter.ts";
import { createCheckpoint } from "../git/gitIntegration.ts";

/**
 * Start the MCP server using stdio transport
 * @param options Server options
 * @returns Promise that resolves when the server is started
 */
export async function startMCPServerStdio(options: {
  model?: string;
  mode?: "automatic" | "semi" | "manual" | "custom" | "interactive";
  diffMode?: "file" | "function";
  processing?: "sequential" | "parallel" | "concurrent" | "swarm";
  configPath?: string;
}): Promise<void> {
  // Initialize SPARC2 agent
  const agent = new SPARC2Agent({
    model: options.model || "gpt-4o",
    mode: options.mode || "automatic",
    diffMode: options.diffMode || "file",
    processing: options.processing || "sequential",
    configPath: "./config/agent-config.toml",
  });

  // Initialize the agent
  await agent.init();

  await logInfo("Starting SPARC2 MCP server using stdio transport");

  // Create the MCP server
  const server = new Server(
    {
      name: "sparc2-mcp",
      version: "2.0.5",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Set up the ListTools request handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "analyze_code",
        description: "Analyze code files for issues and improvements",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              description: "Array of file paths to analyze",
              items: {
                type: "string",
              },
            },
            task: {
              type: "string",
              description: "Description of the analysis task",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "modify_code",
        description: "Apply suggested modifications to code files",
        inputSchema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              description: "Array of file paths to modify",
              items: {
                type: "string",
              },
            },
            task: {
              type: "string",
              description: "Description of the modification task",
            },
          },
          required: ["files"],
        },
      },
      {
        name: "execute_code",
        description: "Execute code in a secure sandbox",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Code to execute",
            },
            language: {
              type: "string",
              description: "Programming language (python, javascript, typescript)",
            },
          },
          required: ["code", "language"],
        },
      },
      {
        name: "search_code",
        description: "Search for similar code changes",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "create_checkpoint",
        description: "Create a version control checkpoint",
        inputSchema: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Checkpoint message",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "rollback",
        description: "Roll back to a previous checkpoint",
        inputSchema: {
          type: "object",
          properties: {
            commit: {
              type: "string",
              description: "Commit hash to roll back to",
            },
          },
          required: ["commit"],
        },
      },
      {
        name: "config",
        description: "Manage configuration",
        inputSchema: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Action to perform (get, set, list)",
            },
            key: {
              type: "string",
              description: "Configuration key",
            },
            value: {
              type: "string",
              description: "Configuration value (for set action)",
            },
          },
          required: ["action"],
        },
      },
    ],
  }));

  // Set up the CallTool request handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const toolName = request.params.name;
      const args = request.params.arguments;

      // Handle analyze_code tool
      if (toolName === "analyze_code") {
        if (!args.files || !Array.isArray(args.files) || args.files.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, "Files array is required");
        }

        // Convert file paths to FileToProcess objects
        const filesToProcess: FileToProcess[] = [];

        for (const file of args.files) {
          try {
            const content = await Deno.readTextFile(file);
            filesToProcess.push({
              path: file,
              originalContent: content,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logError(`Error reading file ${file}: ${errorMessage}`);
            throw new McpError(ErrorCode.InternalError, `Failed to read file: ${errorMessage}`);
          }
        }

        // Use planAndExecute to analyze the files
        const results = await agent.planAndExecute(
          `Analyze the following files: ${args.task || ""}`,
          filesToProcess,
        );

        // Convert the results to the expected format
        const formattedResults = results.map((result) => ({
          file: result.path,
          issues: result.originalContent !== result.modifiedContent ? ["Changes suggested"] : [],
          suggestions: result.originalContent !== result.modifiedContent
            ? [result.modifiedContent]
            : [],
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formattedResults, null, 2),
            },
          ],
        };
      } // Handle modify_code tool
      else if (toolName === "modify_code") {
        if (!args.files || !Array.isArray(args.files) || args.files.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, "Files array is required");
        }

        // Convert file paths to FileToProcess objects
        const filesToProcess: FileToProcess[] = [];

        for (const file of args.files) {
          try {
            const content = await Deno.readTextFile(file);
            filesToProcess.push({
              path: file,
              originalContent: content,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logError(`Error reading file ${file}: ${errorMessage}`);
            throw new McpError(ErrorCode.InternalError, `Failed to read file: ${errorMessage}`);
          }
        }

        // Use planAndExecute to modify the files
        const results = await agent.planAndExecute(
          `Modify the following files: ${args.task || ""}`,
          filesToProcess,
        );

        // Write the modified content back to the files
        for (const result of results) {
          if (result.originalContent !== result.modifiedContent) {
            await Deno.writeTextFile(result.path, result.modifiedContent);
          }
        }

        // Process the results
        const processedResults = results.map((result) => ({
          file: result.path,
          modified: result.originalContent !== result.modifiedContent,
          changes: result.originalContent !== result.modifiedContent
            ? ["File was modified according to suggestions"]
            : [],
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(processedResults, null, 2),
            },
          ],
        };
      } // Handle execute_code tool
      else if (toolName === "execute_code") {
        if (!args.code) {
          throw new McpError(ErrorCode.InvalidParams, "Code is required");
        }

        // Execute the code directly using the code interpreter
        const result = await executeCode(args.code, { language: args.language || "javascript" });

        // Format the output
        let output = "";
        if (result.logs.stdout.length > 0) {
          output += result.logs.stdout.join("\n");
        }
        if (result.logs.stderr.length > 0) {
          output += "\n\nErrors:\n" + result.logs.stderr.join("\n");
        }
        if (result.error) {
          output += "\n\nExecution Error:\n" + result.error.value;
        }

        return {
          content: [
            {
              type: "text",
              text: output || "Execution completed successfully",
            },
          ],
        };
      } // Handle search_code tool
      else if (toolName === "search_code") {
        if (!args.query) {
          throw new McpError(ErrorCode.InvalidParams, "Search query is required");
        }

        // Import the vector search function
        const { searchVectorStore } = await import("../vector/vectorStore.ts");

        // Perform the search
        const results = await searchVectorStore(args.query, args.limit || 10);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      } // Handle create_checkpoint tool
      else if (toolName === "create_checkpoint") {
        if (!args.message) {
          throw new McpError(ErrorCode.InvalidParams, "Checkpoint message is required");
        }

        // Sanitize the name for Git tag
        const sanitizedName = args.message.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase().substring(
          0,
          50,
        );

        // Create a checkpoint
        const hash = await createCheckpoint(sanitizedName);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: sanitizedName,
                  hash: hash,
                },
                null,
                2,
              ),
            },
          ],
        };
      } // Handle rollback tool
      else if (toolName === "rollback") {
        if (!args.commit) {
          throw new McpError(ErrorCode.InvalidParams, "Commit hash is required");
        }

        // Import the rollback function
        const { rollbackChanges } = await import("../git/gitIntegration.ts");

        // Perform the rollback
        const message = `Rollback to ${args.commit}`;
        const result = await rollbackChanges(args.commit, message);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  commit: args.commit,
                  success: true,
                  result,
                },
                null,
                2,
              ),
            },
          ],
        };
      } // Handle config tool
      else if (toolName === "config") {
        if (!args.action) {
          throw new McpError(ErrorCode.InvalidParams, "Action is required");
        }

        // Handle different config actions
        if (args.action === "get") {
          // Get a specific config value
          if (!args.key) {
            throw new McpError(ErrorCode.InvalidParams, "Key is required for get action");
          }

          const configValue = Deno.env.get(args.key) || null;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ key: args.key, value: configValue }, null, 2),
              },
            ],
          };
        } else if (args.action === "set") {
          // Set a specific config value
          if (!args.key) {
            throw new McpError(ErrorCode.InvalidParams, "Key is required for set action");
          }

          if (args.value === undefined) {
            throw new McpError(ErrorCode.InvalidParams, "Value is required for set action");
          }

          // Set the environment variable
          Deno.env.set(args.key, String(args.value));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ key: args.key, value: args.value, success: true }, null, 2),
              },
            ],
          };
        } else if (args.action === "list") {
          // List all config values (only safe ones)
          const safeKeys = [
            "DENO_ENV",
            "DEBUG",
            "LOG_LEVEL",
            "VECTOR_STORE_ID",
            "DIFF_MODE",
            "PROCESSING_MODE",
          ];

          const config: Record<string, string | null> = {};
          for (const key of safeKeys) {
            config[key] = Deno.env.get(key) || null;
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(config, null, 2),
              },
            ],
          };
        } else {
          throw new McpError(ErrorCode.InvalidParams, `Unknown action: ${args.action}`);
        }
      } // Handle unknown tool
      else {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logError(`Error executing tool: ${errorMessage}`);
      throw new McpError(ErrorCode.InternalError, `Failed to execute tool: ${errorMessage}`);
    }
  });

  // Set up error handler
  server.onerror = (error) => {
    logError(`MCP server error: ${error}`);
  };

  // Connect to the stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  await logInfo("SPARC2 MCP server running on stdio");
}
