#!/usr/bin/env node

/**
 * SPARC2 MCP Wrapper Script
 * 
 * This script provides a simplified MCP server implementation that works
 * in both local and global installations.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

// Log the current directory for debugging
console.log(`${colors.blue}MCP Wrapper running from: ${__dirname}${colors.reset}`);

/**
 * Check if Deno is installed
 * @returns {boolean} True if Deno is installed, false otherwise
 */
function isDenoInstalled() {
  try {
    execSync('deno --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Print Deno installation instructions
 */
function printDenoInstallInstructions() {
  console.log(`${colors.red}Error: Deno is required but not installed.${colors.reset}`);
  console.log(`${colors.yellow}Please install Deno using one of the following methods:${colors.reset}`);
  console.log(`\n${colors.blue}Linux/macOS:${colors.reset}`);
  console.log(`  curl -fsSL https://deno.land/install.sh | sh`);
  console.log(`\n${colors.blue}Windows (PowerShell):${colors.reset}`);
  console.log(`  irm https://deno.land/install.ps1 | iex`);
  
  // Check if the install script exists
  const installScriptPath = path.join(__dirname, 'install-deno.sh');
  if (fs.existsSync(installScriptPath)) {
    console.log(`\n${colors.green}Or run the included installation script:${colors.reset}`);
    console.log(`  ${installScriptPath}`);
  }
  
  console.log(`\n${colors.yellow}For more information, visit: https://deno.land/#installation${colors.reset}`);
  console.log(`\n${colors.cyan}After installing Deno, you may need to restart your terminal or add Deno to your PATH.${colors.reset}`);
}

/**
 * Check if we're running from a global installation (node_modules)
 * @returns {boolean} True if running from node_modules, false otherwise
 */
function isRunningFromNodeModules() {
  // Force simplified mode for now
  return true;
}

/**
 * Run a simplified MCP server directly
 */
function runSimplifiedMcpServer() {
  console.log(`${colors.yellow}Running simplified MCP server from global installation${colors.reset}`);
  
  // Create the MCP server
  const server = new Server(
    {
      name: "sparc2-mcp",
      version: "2.0.24",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Set up the ListTools request handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "analyze_code",
          description: "Analyze code files for issues and improvements",
          inputSchema: {
            type: "object",
            properties: {
              files: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "List of file paths to analyze"
              }
            }
          }
        },
        {
          name: "modify_code",
          description: "Apply suggested modifications to code files",
          inputSchema: {
            type: "object",
            properties: {
              files: {
                type: "array",
                items: {
                  type: "string"
                },
                description: "List of file paths to modify"
              },
              changes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    file: { type: "string" },
                    diff: { type: "string" }
                  }
                },
                description: "List of changes to apply"
              }
            }
          }
        },
        {
          name: "read_file",
          description: "Read the contents of a file",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Path to the file to read"
              }
            },
            required: ["path"]
          }
        },
        {
          name: "write_file",
          description: "Write content to a file",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Path to the file to write"
              },
              content: {
                type: "string",
                description: "Content to write to the file"
              }
            },
            required: ["path", "content"]
          }
        },
        {
          name: "list_files",
          description: "List files in a directory",
          inputSchema: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Path to the directory to list"
              },
              recursive: {
                type: "boolean",
                description: "Whether to list files recursively",
                default: false
              }
            },
            required: ["path"]
          }
        },
        {
          name: "execute_command",
          description: "Execute a shell command",
          inputSchema: {
            type: "object",
            properties: {
              command: {
                type: "string",
                description: "Command to execute"
              }
            },
            required: ["command"]
          }
        }
      ]
    };
  });

  // Set up the CallTool request handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    
    return {
      content: [
        {
          type: "text",
          text: `This is a simplified MCP server running from a global installation.\n\nThe tool "${toolName}" was called with arguments:\n${JSON.stringify(request.params.arguments, null, 2)}\n\nFor full functionality, please run SPARC2 from a local installation.`,
        },
      ],
    };
  });

  // Set up error handler
  server.onerror = (error) => {
    console.error(`[MCP Server Error] ${error}`);
  };

  // Connect to the stdio transport
  console.log(`${colors.blue}Connecting to stdio transport...${colors.reset}`);
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.log(`${colors.green}SPARC2 MCP server running on stdio${colors.reset}`);
  }).catch((error) => {
    console.error(`${colors.red}Failed to connect to stdio transport: ${error.message}${colors.reset}`);
    process.exit(1);
  });

  // Handle process exit
  process.on("SIGINT", async () => {
    console.log(`${colors.yellow}Shutting down...${colors.reset}`);
    await server.close();
    process.exit(0);
  });
}

/**
 * Run the full MCP server wrapper
 */
function runFullMcpServer() {
  console.log(`${colors.green}Deno is installed. Starting SPARC2 MCP server...${colors.reset}`);
  
  // Path to the actual MCP server wrapper
  const mcpServerWrapperPath = path.join(__dirname, 'src', 'mcp', 'mcpServerWrapper.js');
  
  // Spawn the MCP server process
  const mcpProcess = spawn('node', [mcpServerWrapperPath], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Handle process exit
  mcpProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(`${colors.red}MCP server exited with code ${code}${colors.reset}`);
      process.exit(code);
    }
  });
  
  // Forward signals to the child process
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      mcpProcess.kill(signal);
    });
  });
}

// Main execution
if (!isDenoInstalled()) {
  printDenoInstallInstructions();
  process.exit(1);
}

// If running from node_modules, use the simplified MCP server
if (isRunningFromNodeModules()) {
  runSimplifiedMcpServer();
} else {
  runFullMcpServer();
}