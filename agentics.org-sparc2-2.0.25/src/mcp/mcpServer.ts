/**
 * MCP Server module for SPARC 2.0
 * Implements a Model Context Protocol server for SPARC2
 */

import { serve } from "https://deno.land/std@0.215.0/http/server.ts";
import { FileToProcess, SPARC2Agent } from "../agent/agent.ts";
import { logDebug, logError, logInfo } from "../logger.ts";
import { executeCode } from "../sandbox/codeInterpreter.ts";
import { createCheckpoint } from "../git/gitIntegration.ts";

// Default port for the MCP server
const DEFAULT_PORT = 3001;

/**
 * MCP Tool definition
 */
interface MCPTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
    }>;
    required?: string[];
  };
  returns?: {
    type: string;
    description: string;
  };
}

/**
 * MCP Resource definition
 */
interface MCPResource {
  name: string;
  type: string;
  description: string;
  properties: Record<string, {
    type: string;
    description: string;
  }>;
  methods?: Array<{
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, {
        type: string;
        description: string;
      }>;
      required?: string[];
    };
    returns?: {
      type: string;
      description: string;
    };
  }>;
}

/**
 * Start the MCP server
 * @param options Server options
 * @returns Promise that resolves when the server is started
 */
export async function startMCPServer(options: {
  port?: number;
  model?: string;
  mode?: "automatic" | "semi" | "manual" | "custom" | "interactive";
  diffMode?: "file" | "function";
  processing?: "sequential" | "parallel" | "concurrent" | "swarm";
  configPath?: string;
}): Promise<void> {
  const port = options.port || DEFAULT_PORT;

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

  await logInfo("Starting SPARC2 MCP server on port " + port);

  // Define available tools
  const tools: MCPTool[] = [
    {
      name: "analyze_code",
      description: "Analyze code files for issues and improvements",
      parameters: {
        type: "object",
        properties: {
          files: {
            type: "array",
            description: "Array of file paths to analyze",
          },
          task: {
            type: "string",
            description: "Description of the analysis task",
          },
        },
        required: ["files"],
      },
      returns: {
        type: "object",
        description: "Analysis results with suggestions for improvements",
      },
    },
    {
      name: "modify_code",
      description: "Apply suggested modifications to code files",
      parameters: {
        type: "object",
        properties: {
          files: {
            type: "array",
            description: "Array of file paths to modify",
          },
          task: {
            type: "string",
            description: "Description of the modification task",
          },
        },
        required: ["files"],
      },
      returns: {
        type: "object",
        description: "Results of the modifications applied",
      },
    },
    {
      name: "execute_code",
      description: "Execute code in a secure sandbox",
      parameters: {
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
      returns: {
        type: "object",
        description: "Execution results including stdout, stderr, and any errors",
      },
    },
    {
      name: "search_code",
      description: "Search for similar code changes",
      parameters: {
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
      returns: {
        type: "array",
        description: "Array of search results with relevance scores",
      },
    },
    {
      name: "create_checkpoint",
      description: "Create a version control checkpoint",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Checkpoint message",
          },
        },
        required: ["message"],
      },
      returns: {
        type: "object",
        description: "Checkpoint information including commit hash",
      },
    },
    {
      name: "rollback",
      description: "Roll back to a previous checkpoint",
      parameters: {
        type: "object",
        properties: {
          commit: {
            type: "string",
            description: "Commit hash to roll back to",
          },
        },
        required: ["commit"],
      },
      returns: {
        type: "object",
        description: "Results of the rollback operation",
      },
    },
    {
      name: "read_file",
      description: "Read the contents of a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to read",
          },
        },
        required: ["path"],
      },
      returns: {
        type: "object",
        description: "File contents",
      },
    },
    {
      name: "write_file",
      description: "Write content to a file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the file to write",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
      returns: {
        type: "object",
        description: "Results of the write operation",
      },
    },
    {
      name: "list_files",
      description: "List files in a directory",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Path to the directory to list",
          },
          recursive: {
            type: "boolean",
            description: "Whether to list files recursively",
          },
        },
        required: ["path"],
      },
      returns: {
        type: "array",
        description: "Array of file information",
      },
    },
    {
      name: "execute_command",
      description: "Execute a shell command",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "Command to execute",
          },
        },
        required: ["command"],
      },
      returns: {
        type: "object",
        description: "Command execution results",
      },
    },
  ];

  // Define available resources
  const resources: MCPResource[] = [
    {
      name: "git_repository",
      type: "version_control",
      description: "Git repository for version control and checkpointing",
      properties: {
        path: {
          type: "string",
          description: "Path to the git repository",
        },
        branch: {
          type: "string",
          description: "Current branch name",
        },
      },
      methods: [
        {
          name: "create_checkpoint",
          description: "Create a git checkpoint (commit)",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Commit message",
              },
            },
            required: ["message"],
          },
          returns: {
            type: "object",
            description: "Checkpoint information including commit hash",
          },
        },
        {
          name: "rollback",
          description: "Roll back to a previous checkpoint",
          parameters: {
            type: "object",
            properties: {
              commit: {
                type: "string",
                description: "Commit hash to roll back to",
              },
            },
            required: ["commit"],
          },
          returns: {
            type: "object",
            description: "Results of the rollback operation",
          },
        },
      ],
    },
    {
      name: "vector_store",
      type: "database",
      description: "Vector database for storing and searching code changes and logs",
      properties: {
        id: {
          type: "string",
          description: "ID of the vector store",
        },
        size: {
          type: "number",
          description: "Number of entries in the vector store",
        },
      },
      methods: [
        {
          name: "search",
          description: "Search for similar entries in the vector store",
          parameters: {
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
          returns: {
            type: "array",
            description: "Array of search results with relevance scores",
          },
        },
        {
          name: "index",
          description: "Index a new entry in the vector store",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Content to index",
              },
              metadata: {
                type: "object",
                description: "Metadata for the entry",
              },
            },
            required: ["content"],
          },
          returns: {
            type: "object",
            description: "Results of the indexing operation",
          },
        },
      ],
    },
  ];

  // Start the HTTP server
  await serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // Handle discovery endpoint
    if (
      (req.url.endsWith("/discover") || req.url.endsWith("/capabilities")) && req.method === "GET"
    ) {
      return new Response(
        JSON.stringify({
          tools,
          resources,
          version: "2.0.5",
          name: "SPARC2 MCP Server",
          description: "Model Context Protocol server for SPARC2",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Handle list_tools endpoint (legacy)
    if (req.url.endsWith("/list_tools") && req.method === "GET") {
      return new Response(JSON.stringify({ tools }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle analyze endpoint
    if (req.url.endsWith("/analyze") && req.method === "POST") {
      try {
        const body = await req.json();
        const { files, task } = body;

        if (!files || !Array.isArray(files) || files.length === 0) {
          return new Response(JSON.stringify({ error: "Files array is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Convert to FileToProcess array
        const filesToProcess: FileToProcess[] = [];
        
        for (const file of files) {
          try {
            // Load file content
            const content = await Deno.readTextFile(file);
            filesToProcess.push({
              path: file,
              originalContent: content,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logError(`Error reading file ${file}: ${errorMessage}`);
            return new Response(JSON.stringify({ error: `Failed to read file ${file}: ${errorMessage}` }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // Analyze the code
        const result = await agent.planAndExecute("Analyze code without making changes", filesToProcess);

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error analyzing code: ${errorMessage}`);
        return new Response(JSON.stringify({ error: `Failed to analyze code: ${errorMessage}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle modify endpoint
    if (req.url.endsWith("/modify") && req.method === "POST") {
      try {
        const body = await req.json();
        const { files, task } = body;

        if (!files || !Array.isArray(files) || files.length === 0) {
          return new Response(JSON.stringify({ error: "Files array is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Convert to FileToProcess array
        const filesToProcess: FileToProcess[] = [];
        
        for (const file of files) {
          try {
            // Load file content
            const content = await Deno.readTextFile(file);
            filesToProcess.push({
              path: file,
              originalContent: content,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logError(`Error reading file ${file}: ${errorMessage}`);
            return new Response(JSON.stringify({ error: `Failed to read file ${file}: ${errorMessage}` }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // Modify the code
        const result = await agent.planAndExecute(task || "Modify code", filesToProcess);

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error modifying code: ${errorMessage}`);
        return new Response(JSON.stringify({ error: `Failed to modify code: ${errorMessage}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle execute endpoint
    if (req.url.endsWith("/execute") && req.method === "POST") {
      try {
        const body = await req.json();
        const { code, language = "javascript" } = body;

        if (!code) {
          return new Response(JSON.stringify({ error: "Code is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Validate language
        if (!["python", "javascript", "typescript"].includes(language)) {
          return new Response(JSON.stringify({ error: `Unsupported language: ${language}` }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Execute the code with the specified language
        const result = await executeCode(code, { language });

        // Format the output
        let output = "";
        if (result.logs && result.logs.stdout && result.logs.stdout.length > 0) {
          output += result.logs.stdout.join("\n");
        }
        if (result.error) {
          output += "\n\nExecution Error:\n" + result.error.value;
        }

        // Return the execution result
        return new Response(
          JSON.stringify({
            result: output || "Execution completed successfully",
            details: result,
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error executing code: ${errorMessage}`);
        return new Response(JSON.stringify({ error: `Failed to execute code: ${errorMessage}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle search endpoint
    if (req.url.endsWith("/search") && req.method === "POST") {
      try {
        const body = await req.json();
        const { query, limit = 10 } = body;

        if (!query) {
          return new Response(JSON.stringify({ error: "Search query is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Import the vector search function
        const { searchVectorStore } = await import("../vector/vectorStore.ts");

        // Perform the search
        const results = await searchVectorStore(query, limit);

        return new Response(JSON.stringify(results), {
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error searching code: ${errorMessage}`);
        return new Response(JSON.stringify({ error: `Failed to search code: ${errorMessage}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle checkpoint endpoint
    if (req.url.endsWith("/checkpoint") && req.method === "POST") {
      try {
        const body = await req.json();
        const { name } = body;

        if (!name) {
          return new Response(JSON.stringify({ error: "Checkpoint name is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Sanitize the name for Git tag
        const sanitizedName = name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase().substring(0, 50);

        // Create a checkpoint
        const hash = await createCheckpoint(sanitizedName);

        return new Response(
          JSON.stringify({
            name: sanitizedName,
            hash: hash,
          }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error creating checkpoint: ${errorMessage}`);
        return new Response(
          JSON.stringify({ error: `Failed to create checkpoint: ${errorMessage}` }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    // Handle config endpoint
    if (req.url.endsWith("/config") && req.method === "POST") {
      try {
        const body = await req.json();
        const { action, key, value } = body;

        if (!action) {
          return new Response(JSON.stringify({ error: "Action is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (action === "set" && (!key || value === undefined)) {
          return new Response(JSON.stringify({ error: "Key and value are required for set action" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (action === "get" && !key) {
          return new Response(JSON.stringify({ error: "Key is required for get action" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Implement config actions
        if (action === "set") {
          Deno.env.set(key, String(value));
          return new Response(JSON.stringify({ key, value }), {
            headers: { "Content-Type": "application/json" },
          });
        } else if (action === "get") {
          const value = Deno.env.get(key);
          return new Response(JSON.stringify({ key, value }), {
            headers: { "Content-Type": "application/json" },
          });
        } else if (action === "list") {
          // Only expose safe environment variables
          const safeKeys = [
            "SPARC2_MODEL",
            "SPARC2_MODE",
            "SPARC2_DIFF_MODE",
            "SPARC2_PROCESSING",
            "SPARC2_CONFIG_PATH",
          ];

          const config: Record<string, string | null> = {};
          for (const key of safeKeys) {
            config[key] = Deno.env.get(key) || null;
          }

          return new Response(JSON.stringify(config), {
            headers: { "Content-Type": "application/json" },
          });
        } else {
          return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error managing config: ${errorMessage}`);
        return new Response(JSON.stringify({ error: `Failed to manage config: ${errorMessage}` }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Handle MCP endpoint for JSON-RPC
    if (req.url.endsWith("/mcp") && req.method === "POST") {
      try {
        const body = await req.json();
        
        // Validate JSON-RPC request
        if (!body.jsonrpc || body.jsonrpc !== "2.0" || !body.method || !body.id) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: body.id || null,
              error: {
                code: -32600,
                message: "Invalid Request"
              }
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        
        // Handle callTool method
        if (body.method === "callTool" && body.params && body.params.name) {
          const toolName = body.params.name;
          const toolArgs = body.params.arguments || {};
          
          // Find the requested tool
          const tool = tools.find(t => t.name === toolName);
          if (!tool) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32601,
                  message: `Tool not found: ${toolName}`
                }
              }),
              {
                status: 404,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
          
          // Execute the tool based on its name
          let result;
          try {
            switch (toolName) {
              case "analyze_code":
                const filesToAnalyze = toolArgs.files || [];
                if (filesToAnalyze.length === 0) {
                  throw new Error("No files specified for analysis");
                }
                
                const filesToProcess: FileToProcess[] = [];
                
                for (const file of filesToAnalyze) {
                  try {
                    // Load file content
                    const content = await Deno.readTextFile(file);
                    filesToProcess.push({
                      path: file,
                      originalContent: content,
                    });
                  } catch (fileError) {
                    throw new Error(`Failed to read file ${file}: ${fileError.message}`);
                  }
                }
                
                result = await agent.planAndExecute("Analyze code without making changes", filesToProcess);
                break;
                
              case "modify_code":
                const filesToModify = toolArgs.files || [];
                if (filesToModify.length === 0) {
                  throw new Error("No files specified for modification");
                }
                
                const modifyFilesToProcess: FileToProcess[] = [];
                
                for (const file of filesToModify) {
                  try {
                    // Load file content
                    const content = await Deno.readTextFile(file);
                    modifyFilesToProcess.push({
                      path: file,
                      originalContent: content,
                    });
                  } catch (fileError) {
                    throw new Error(`Failed to read file ${file}: ${fileError.message}`);
                  }
                }
                
                result = await agent.planAndExecute(toolArgs.task || "Modify code", modifyFilesToProcess);
                break;
                
              case "execute_code":
                if (!toolArgs.code) {
                  throw new Error("No code provided for execution");
                }
                
                // Validate language
                const execLanguage = toolArgs.language || "javascript";
                if (!["python", "javascript", "typescript"].includes(execLanguage)) {
                  throw new Error(`Unsupported language: ${execLanguage}`);
                }
                
                result = await executeCode(
                  toolArgs.code,
                  { language: execLanguage }
                );
                break;
                
              case "read_file":
                if (!toolArgs.path) {
                  throw new Error("No file path provided");
                }
                
                const fileContent = await Deno.readTextFile(toolArgs.path);
                result = { content: fileContent };
                break;
                
              case "write_file":
                if (!toolArgs.path || !toolArgs.content) {
                  throw new Error("File path and content are required");
                }
                
                await Deno.writeTextFile(toolArgs.path, toolArgs.content);
                result = { success: true, path: toolArgs.path };
                break;
                
              case "list_files":
                if (!toolArgs.path) {
                  throw new Error("Directory path is required");
                }
                
                const entries = [];
                for await (const entry of Deno.readDir(toolArgs.path)) {
                  entries.push({
                    name: entry.name,
                    isDirectory: entry.isDirectory,
                    isFile: entry.isFile,
                  });
                }
                
                result = { entries };
                break;
                
              default:
                throw new Error(`Tool ${toolName} is not implemented`);
            }
            
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: result
              }),
              {
                headers: { "Content-Type": "application/json" },
              }
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await logError(`Error executing tool ${toolName}: ${errorMessage}`);
            
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                error: {
                  code: -32000,
                  message: `Error executing tool: ${errorMessage}`
                }
              }),
              {
                status: 500,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
        
        // Handle listTools method
        if (body.method === "listTools") {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: body.id,
              result: { tools }
            }),
            {
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        
        // Method not found
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            error: {
              code: -32601,
              message: "Method not found"
            }
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logError(`Error handling MCP request: ${errorMessage}`);
        
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: `Parse error: ${errorMessage}`
            }
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Handle unknown endpoints
    return new Response(JSON.stringify({ error: "Endpoint not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }, { port });

  await logInfo(`SPARC2 MCP server running on http://localhost:${port}`);
}