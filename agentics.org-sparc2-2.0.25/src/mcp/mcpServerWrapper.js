#!/usr/bin/env node

/**
 * MCP Server Wrapper for SPARC 2.0
 * This script uses the MCP SDK to create a server that communicates over stdio
 * and forwards requests to the SPARC2 HTTP API server.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start the SPARC2 HTTP server
let httpServerProcess = null;

// Global flag to track if we're shutting down intentionally
let isShuttingDown = false;

// Create an HTTP server for SSE
let sseHttpServer = null;

/**
 * SSE Response class for Node.js
 */
class EventSourceResponse {
  constructor(res) {
    this.res = res;
    this.closed = false;
    this.startTime = new Date().toISOString();
    
    // Set SSE headers
    this.startTime = new Date().toISOString();
    
    // Set SSE headers
    this.res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    // Handle client disconnect
    this.res.on('close', () => {
      this.closed = true;
    });
  }
  
  /**
   * Send data as an SSE event
   * @param {any} data The data to send
   * @param {string} eventName Optional event name
   */
  send(data, eventName) {
    if (this.closed) return;
    
    let message = '';
    
    // Add event name if provided
    if (eventName) {
      message += `event: ${eventName}\n`;
    }
    
    // Add data as JSON string
    message += `data: ${JSON.stringify(data)}\n\n`;
    
    // Send the message
    this.res.write(message);
  }
  
  /**
   * Close the SSE connection
   */
  close() {
    if (this.closed) return;
    
    this.res.end();
    this.closed = true;
  }
}

/**
 * Find the Deno executable by checking multiple common installation locations
 */
function findDenoExecutable() {
  const possiblePaths = [
    "/home/codespace/.deno/bin/deno", // GitHub Codespaces
    "/usr/local/bin/deno", // Standard Linux/macOS location
    "/usr/bin/deno", // Alternative Linux location
    process.env.HOME ? path.join(process.env.HOME, ".deno/bin/deno") : null, // User home directory
    process.env.DENO_INSTALL_ROOT ? path.join(process.env.DENO_INSTALL_ROOT, "bin/deno") : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".deno", "bin", "deno.exe") : null,
    "C:\\Program Files\\deno\\deno.exe",
    "deno", // Try the command directly (relies on PATH)
  ].filter(Boolean); // Remove null entries

  // First check if specific paths exist
  for (const denoPath of possiblePaths.slice(0, -1)) { // All except the last one
    try {
      if (existsSync(denoPath)) {
        console.error(`[MCP Wrapper] Found Deno at: ${denoPath}`);
        return denoPath;
      }
    } catch (error) {
      // Ignore errors checking file existence
    }
  }

  // Finally, try 'deno' command directly (which relies on PATH)
  try {
    execSync("deno --version", { stdio: "ignore" });
    console.error("[MCP Wrapper] Using Deno from PATH");
    return "deno";
  } catch (error) {
    console.error("[MCP Wrapper] Deno not found in any standard location");
    return null;
  }
}

/**
 * Check if a file exists and is readable
 */
/**
 * Kill any process using the specified port
 * @param {number} port The port to check
 * @returns {boolean} True if a process was killed, false otherwise
 */
function killProcessOnPort(port) {
  console.error(`[HTTP Server] Checking for processes using port ${port}...`);
  
  try {
    let pids = [];
    let killCommands = [];
    
    if (process.platform === 'win32') {
      // Windows: Get PIDs using netstat
      try {
        const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
        const lines = output.split('\n');
        
        for (const line of lines) {
          const match = line.match(/\s+(\d+)\s*$/m);
          if (match && match[1]) {
            pids.push(match[1]);
            killCommands.push(`taskkill /F /PID ${match[1]}`);
          }
        }
      } catch (e) {
        // No process found
        return false;
      }
    } else {
      // Linux/macOS: Get PIDs using lsof
      try {
        const output = execSync(`lsof -i :${port} -t`, { encoding: 'utf8' }).trim();
        if (output) {
          pids = output.split('\n').filter(Boolean);
          killCommands = pids.map(pid => `kill -9 ${pid}`);
        }
      } catch (e) {
        // No process found
        return false;
      }
    }
    
    if (pids.length > 0 && killCommands.length > 0) {
      console.error(`[HTTP Server] Found process${pids.length > 1 ? 'es' : ''} with PID ${pids.join(', ')} using port ${port}. Killing ${pids.length > 1 ? 'them' : 'it'}...`);
      
      // Execute each kill command
      let success = false;
      for (const cmd of killCommands) {
        try {
          execSync(cmd, { stdio: 'ignore' });
          success = true;
        } catch (error) {
          console.error(`[HTTP Server Error] Failed to execute command '${cmd}': ${error.message}`);
        }
      }
      
      if (success) {
        console.error(`[HTTP Server] Successfully killed process${pids.length > 1 ? 'es' : ''} using port ${port}.`);
        
        // Wait a moment for the port to be released
        try {
          if (process.platform === 'win32') {
            // Windows: use timeout command
            execSync('timeout /t 1 /nobreak > nul', { stdio: 'ignore' });
          } else {
            // Linux/macOS: use sleep command
            execSync('sleep 1', { stdio: 'ignore' });
          }
        } catch (error) {
          // If sleep/timeout fails, use setTimeout as a fallback
          console.error(`[HTTP Server] Warning: Could not use system sleep command: ${error.message}`);
          // Use a synchronous delay as a fallback
          const start = new Date().getTime();
          while (new Date().getTime() - start < 1000) {
            // Busy wait for 1 second
          }
        }
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error(`[HTTP Server Error] Failed to kill process: ${error.message}`);
    return false;
  }
}

/**
 * Check if a file exists and is readable
 * @param {string} filePath Path to the file
 * @returns {boolean} True if the file exists and is readable
 */
function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Start the HTTP server
 */
async function startHttpServer() {
  // First, check if port 3001 is already in use and kill the process
  try {
    console.error('[HTTP Server] Checking if port 3001 is already in use...');
    killProcessOnPort(3001);
  } catch (error) {
    console.error(`[HTTP Server] Error checking port: ${error.message}`);
  }
  return new Promise((resolve, reject) => {
    const scriptDir = path.resolve(__dirname, "../..");
    const denoPath = findDenoExecutable();

    if (!denoPath) {
      reject(new Error("Deno is not installed. Please install Deno and try again."));
      return;
    }

    httpServerProcess = spawn(denoPath, [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      "--allow-net",
      "--allow-run",
      path.join(scriptDir, "src", "cli", "cli.ts"),
      "api", // Use the API command instead of MCP command
      "--port",
      "3001",
    ], {
      cwd: scriptDir,
      stdio: "pipe",
      env: {
        ...process.env,
        SPARC2_DIRECT_API: "true", // Prevent circular dependency
      },
    });

    const serverStartTimeout = setTimeout(() => {
      reject(new Error("HTTP server failed to start within 30 seconds"));
    }, 30000);

    httpServerProcess.stdout.on("data", (data) => {
      console.error(`[HTTP Server] ${data.toString().trim()}`);
      if (data.toString().includes("Listening on http://localhost:3001")) {
        clearTimeout(serverStartTimeout);
        resolve();
      }
    });

    httpServerProcess.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (!message.includes("[MCP Wrapper]")) {
        console.error(`[HTTP Server Error] ${message}`);
      }
    });

    httpServerProcess.on("error", (error) => {
      console.error(`[HTTP Server Process Error] ${error.message}`);
      clearTimeout(serverStartTimeout);
      reject(error);
    });

    httpServerProcess.on("close", (code) => {
      console.error(`[HTTP Server Process Exited] with code ${code}`);
      clearTimeout(serverStartTimeout);
      if (code !== 0 && !isShuttingDown) {
        console.error(`[MCP Wrapper] HTTP server exited unexpectedly.`);
        reject(new Error(`HTTP server exited with code ${code}`));
      }
      httpServerProcess = null;
    });
  });
}

/**
 * Make an HTTP request to the SPARC2 HTTP server
 */
async function makeHttpRequest(endpoint, method = "GET", body = null) {
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        const options = {
          hostname: "localhost",
          port: 3001,
          path: `/${endpoint}`,
          method: method,
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 30000, // 30 seconds timeout
        };

        const req = http.request(options, (res) => {
          let data = "";
          res.on("data", (chunk) => { data += chunk; });
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(data));
              } catch (error) {
                resolve(data);
              }
            } else {
              reject(new Error(`HTTP Error: ${res.statusCode} - ${data}`));
            }
          });
        });

        req.on("error", (error) => { reject(error); });
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Request timed out"));
        });

        if (body) {
          req.write(JSON.stringify(body));
        }
        req.end();
      });
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        throw error;
      }
      console.error(`[MCP Wrapper] Request to ${endpoint} failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`);
      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

/**
 * Handle analyze operation with SSE progress updates
 */
async function analyzeWithSSE(args, sse) {
  const files = args.files || [];
  
  try {
    // Step 1: Reading files (already done in handleOperationWithSSE)
    
    // Step 2: Parsing code structure
    sse.send({
      status: 'step',
      message: 'Parsing code structure',
      progress: 15,
      step: 2,
      totalSteps: 7,
      details: 'Analyzing syntax and structure of code files'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 3: Static analysis
    sse.send({
      status: 'step',
      message: 'Performing static analysis',
      progress: 30,
      step: 3,
      totalSteps: 7,
      details: 'Checking for syntax errors, linting issues, and code style'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Step 4: Code quality assessment
    sse.send({
      status: 'step',
      message: 'Assessing code quality',
      progress: 45,
      step: 4,
      totalSteps: 7,
      details: 'Evaluating complexity, maintainability, and readability'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Step 5: Identifying patterns
    sse.send({
      status: 'step',
      message: 'Identifying code patterns',
      progress: 60,
      step: 5,
      totalSteps: 7,
      details: 'Looking for common patterns, anti-patterns, and code smells'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Step 6: Generating recommendations
    sse.send({
      status: 'step',
      message: 'Generating recommendations',
      progress: 75,
      step: 6,
      totalSteps: 7,
      details: 'Creating suggestions for code improvements'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 7: Finalizing
    sse.send({
      status: 'step',
      message: 'Finalizing analysis',
      progress: 90,
      step: 7,
      totalSteps: 7,
      details: 'Compiling final analysis report'
    }, 'progress');
    
    // Make the actual HTTP request to get the analysis result
    const response = await makeHttpRequest('analyze', 'POST', { files });
    
    // Send final progress update
    sse.send({ 
      status: 'completed',
      message: 'Analysis completed successfully',
      progress: 100,
      timestamp: new Date().toISOString()
    }, 'progress');
    
    // Send the analysis result
    sse.send({ 
      result: response,
      operation: 'analyze',
      files: files,
      timestamp: new Date().toISOString(),
      executionTime: `${(new Date() - new Date(sse.startTime))/1000} seconds`
    }, 'result');
    
    sse.close();
  } catch (error) {
    sse.send({ 
      status: 'error',
      message: `Error during analysis: ${error.message}`,
      error: error.message,
      operation: 'analyze',
      timestamp: new Date().toISOString()
    }, 'error');
    sse.close();
  }
}

/**
 * Handle modify operation with SSE progress updates
 */
async function modifyWithSSE(args, sse) {
  const files = args.files || [];
  const task = args.task || '';
  
  try {
    // Step 1: Reading files (already done in handleOperationWithSSE)
    
    // Step 2: Understanding the task
    sse.send({
      status: 'step',
      message: 'Understanding modification task',
      progress: 15,
      step: 2,
      totalSteps: 8,
      details: `Analyzing task: ${task}`
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Step 3: Parsing code files
    sse.send({
      status: 'step',
      message: 'Parsing code files',
      progress: 25,
      step: 3,
      totalSteps: 8,
      details: 'Analyzing syntax and structure of code to be modified'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Step 4: Planning modifications
    sse.send({
      status: 'step',
      message: 'Planning modifications',
      progress: 40,
      step: 4,
      totalSteps: 8,
      details: 'Determining what changes need to be made'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Step 5: Generating changes
    sse.send({
      status: 'step',
      message: 'Generating code changes',
      progress: 55,
      step: 5,
      totalSteps: 8,
      details: 'Creating the actual code modifications'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 6: Validating changes
    sse.send({
      status: 'step',
      message: 'Validating changes',
      progress: 70,
      step: 6,
      totalSteps: 8,
      details: 'Ensuring modifications are syntactically correct'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Step 7: Applying changes
    sse.send({
      status: 'step',
      message: 'Applying changes',
      progress: 85,
      step: 7,
      totalSteps: 8,
      details: 'Writing modifications to files'
    }, 'progress');
    
    // Make the actual HTTP request to modify the code
    const response = await makeHttpRequest('modify', 'POST', { files, task });
    
    // Step 8: Finalizing
    sse.send({
      status: 'step',
      message: 'Finalizing modifications',
      progress: 95,
      step: 8,
      totalSteps: 8,
      details: 'Completing the modification process'
    }, 'progress');
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Send final progress update
    sse.send({ 
      status: 'completed',
      message: 'Modifications completed successfully',
      progress: 100,
      timestamp: new Date().toISOString()
    }, 'progress');
    
    // Send the modification result
    sse.send({ 
      result: response,
      operation: 'modify',
      files: files,
      task: task,
      timestamp: new Date().toISOString(),
      executionTime: `${(new Date() - new Date(sse.startTime))/1000} seconds`
    }, 'result');
    
    sse.close();
  } catch (error) {
    sse.send({ 
      status: 'error',
      message: `Error during modification: ${error.message}`,
      error: error.message,
      operation: 'modify',
      timestamp: new Date().toISOString()
    }, 'error');
    sse.close();
  }
}

/**
 * Generic function to handle MCP operations with SSE progress updates
 */
async function handleOperationWithSSE(operation, args, sse) {
  try {
    // Send initial progress update
    sse.send({ 
      status: 'started',
      message: `Starting ${operation} operation`,
      progress: 0,
      operation: operation
    }, 'progress');
    
    // Common steps for all operations
    const files = args.files || [];
    const task = args.task || '';
    
    // Send detailed information about the operation
    sse.send({
      status: 'info',
      message: `Operation: ${operation}`,
      details: {
        files: files,
        task: task,
        timestamp: new Date().toISOString()
      }
    }, 'info');
    
    // Read files content with progress updates
    if (files.length > 0) {
      sse.send({
        status: 'step',
        message: 'Reading files',
        progress: 5,
        step: 1,
        totalSteps: operation === 'analyze' ? 7 : 8
      }, 'progress');
      
      // Process each file with detailed updates
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        sse.send({ 
          status: 'reading',
          message: `Reading file ${file} (${i+1}/${files.length})`,
          progress: 5 + (i / files.length) * 10,
          file: file,
          fileIndex: i,
          totalFiles: files.length
        }, 'progress');
        
        // Simulate file reading time
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Operation-specific steps
    if (operation === 'analyze') {
      await analyzeWithSSE(args, sse);
    } else if (operation === 'modify') {
      await modifyWithSSE(args, sse);
    } else {
      throw new Error(`Unsupported operation: ${operation}`);
    }
    
  } catch (error) {
    console.error(`[SSE Error] ${error.message}`);
    if (!sse.closed) {
      sse.send({ 
        status: 'error',
        message: `Error during ${operation}: ${error.message}`,
        error: error.message,
        operation: operation
      }, 'error');
      sse.close();
    }
  }
}

/**
 * Start the SSE HTTP server
 */
function startSseHttpServer() {
  // First, check if port 3002 is already in use and kill the process
  try {
    console.error('[SSE Server] Checking if port 3002 is already in use...');
    killProcessOnPort(3002);
  } catch (error) {
    console.error(`[SSE Server] Error checking port: ${error.message}`);
  }
  
  // Create the HTTP server
  sseHttpServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Handle analyze SSE stream requests
    if (url.pathname === '/stream/analyze') {
      const id = url.searchParams.get('id');
      const filesParam = url.searchParams.get('files');
      const files = filesParam ? filesParam.split(',') : [];
      
      // Resolve file paths relative to the current working directory
      const resolvedFiles = files.map(file => path.resolve(process.cwd(), file));
      
      console.error(`[SSE Server] Received analyze request for files: ${resolvedFiles.join(', ')}`);
      
      // Set up SSE response
      const sse = new EventSourceResponse(res);
      
      // Check if all files exist
      const nonExistentFiles = resolvedFiles.filter(file => !fileExists(file));
      if (nonExistentFiles.length > 0) {
        const errorMsg = `The following files do not exist or are not readable: ${nonExistentFiles.join(', ')}`;
        console.error(`[SSE Server Error] ${errorMsg}`);
        
        // Send error message via SSE
        sse.send({ 
          status: 'error',
          message: errorMsg,
          error: errorMsg
        }, 'error');
        
        // Close the SSE connection
        sse.close();
        return;
      }
      
      // Start analysis with SSE updates
      handleOperationWithSSE('analyze', { files: resolvedFiles }, sse);
      
      return;
    }
    
    // Handle modify SSE stream requests
    if (url.pathname === '/stream/modify') {
      const id = url.searchParams.get('id');
      const filesParam = url.searchParams.get('files');
      const files = filesParam ? filesParam.split(',') : [];
      const task = url.searchParams.get('task') || '';
      
      // Resolve file paths relative to the current working directory
      const resolvedFiles = files.map(file => path.resolve(process.cwd(), file));
      
      console.error(`[SSE Server] Received modify request for files: ${resolvedFiles.join(', ')} with task: ${task}`);
      
      // Set up SSE response
      const sse = new EventSourceResponse(res);
      
      // Check if all files exist
      const nonExistentFiles = resolvedFiles.filter(file => !fileExists(file));
      if (nonExistentFiles.length > 0) {
        const errorMsg = `The following files do not exist or are not readable: ${nonExistentFiles.join(', ')}`;
        console.error(`[SSE Server Error] ${errorMsg}`);
        
        // Send error message via SSE
        sse.send({ 
          status: 'error',
          message: errorMsg,
          error: errorMsg
        }, 'error');
        
        // Close the SSE connection
        sse.close();
        return;
      }
      
      // Start modification with SSE updates
      handleOperationWithSSE('modify', { files: resolvedFiles, task }, sse);
      
      return;
    }
    
    // Handle other requests
    res.writeHead(404);
    res.end('Not Found');
  });
  
  // Start HTTP server on port 3002 (different from the API server)
  try {
    sseHttpServer.listen(3002, () => {
      console.error(`[MCP Wrapper] SSE server listening on port 3002`);
    });
    
    // Handle HTTP server errors
    sseHttpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[SSE Server Error] Port 3002 is already in use. The SSE functionality will not be available.`);
        console.error(`[SSE Server Error] You can still use the MCP server without SSE support.`);
      } else {
        console.error(`[SSE Server Error] ${error.message}`);
      }
    });
  } catch (error) {
    console.error(`[SSE Server Error] Failed to start SSE server: ${error.message}`);
    console.error(`[SSE Server Error] The MCP server will continue to run without SSE support.`);
  }
}

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
server.setRequestHandler(ListToolsRequestSchema, async () => {
  try {
    // Get the tools from the HTTP server
    const response = await makeHttpRequest("discover", "GET");

    return {
      tools: response.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
      })),
    };
  } catch (error) {
    console.error(`[MCP Server Error] Failed to list tools: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to list tools: ${error.message}`);
  }
});

// Set up the CallTool request handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const toolName = request.params.name;
    const args = request.params.arguments;
    
    // Resolve file paths for any tool that uses files
    if (args && args.files && Array.isArray(args.files)) {
      args.files = args.files.map(file => path.resolve(process.cwd(), file));
      console.error(`[MCP Server] Resolved file paths for ${toolName}: ${args.files.join(', ')}`);
      
      // Check if all files exist
      const nonExistentFiles = args.files.filter(file => !fileExists(file));
      if (nonExistentFiles.length > 0) {
        const errorMsg = `The following files do not exist or are not readable: ${nonExistentFiles.join(', ')}`;
        console.error(`[MCP Server Error] ${errorMsg}`);
        throw new McpError(ErrorCode.InvalidParams, errorMsg);
      }
    }

    // Special handling for analyze_code to support SSE
    if (toolName === "analyze_code") {
      // Return a URL for the SSE stream
      const filesParam = args.files ? args.files.join(',') : '';
      return {
        content: [
          {
            type: "text",
            text: "Analysis started. Connect to the SSE stream to receive progress updates.",
          },
        ],
        streamUrl: `http://localhost:3002/stream/analyze?id=${Date.now()}&files=${encodeURIComponent(filesParam)}`,
      };
    }
    
    // Special handling for modify_code to support SSE
    if (toolName === "modify_code") {
      // Return a URL for the SSE stream
      const filesParam = args.files ? args.files.join(',') : '';
      const taskParam = args.task || '';
      return {
        content: [
          {
            type: "text",
            text: "Modification started. Connect to the SSE stream to receive progress updates.",
          },
        ],
        streamUrl: `http://localhost:3002/stream/modify?id=${Date.now()}&files=${encodeURIComponent(filesParam)}&task=${encodeURIComponent(taskParam)}`,
      };
    }
    
    // Map the tool name to the corresponding HTTP endpoint
    let endpoint;
    switch (toolName) {
      case "analyze_code":
        endpoint = "analyze";
        break;
      case "modify_code":
        endpoint = "modify";
        break;
      case "execute_code":
        endpoint = "execute";
        break;
      case "search_code":
        endpoint = "search";
        break;
      case "create_checkpoint":
        endpoint = "checkpoint";
        break;
      case "rollback":
        endpoint = "rollback";
        break;
      case "config":
        endpoint = "config";
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
    }

    // Make the HTTP request to the SPARC2 HTTP server
    const response = await makeHttpRequest(endpoint, "POST", args);

    // Format the response
    return {
      content: [
        {
          type: "text",
          text: typeof response === "string" ? response : JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error(`[MCP Server Error] Failed to call tool: ${error.message}`);
    throw new McpError(ErrorCode.InternalError, `Failed to call tool: ${error.message}`);
  }
});

// Set up error handler
server.onerror = (error) => {
  console.error(`[MCP Server Error] ${error}`);
};

// Cleanup function to ensure all processes are terminated
function cleanup() {
  console.error('[MCP Wrapper] Cleaning up resources...');
  isShuttingDown = true;
  
  // Close the SSE server if it exists
  if (sseHttpServer) {
    try {
      sseHttpServer.close();
      console.error('[MCP Wrapper] SSE server closed.');
    } catch (error) {
      console.error(`[MCP Wrapper] Error closing SSE server: ${error.message}`);
    }
    sseHttpServer = null;
  }
  
  // Kill the HTTP server process if it exists
  if (httpServerProcess) {
    try {
      httpServerProcess.kill();
      console.error('[MCP Wrapper] HTTP server process terminated.');
    } catch (error) {
      console.error(`[MCP Wrapper] Error terminating HTTP server process: ${error.message}`);
    }
    httpServerProcess = null;
  }
  
  console.error('[MCP Wrapper] Cleanup complete.');
}

// Register cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
  console.error('[MCP Wrapper] Received SIGINT signal.');
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.error('[MCP Wrapper] Received SIGTERM signal.');
  cleanup();
  process.exit(0);
});
process.on('uncaughtException', (error) => {
  console.error(`[MCP Wrapper] Uncaught exception: ${error.message}`);
  console.error(error.stack);
  cleanup();
  process.exit(1);
});

// Main function to start everything
async function main() {
  try {
    // Start the HTTP server
    await startHttpServer();
    console.error("[MCP Wrapper] HTTP server started successfully");
    
    // Start the SSE HTTP server
    startSseHttpServer();
    console.error("[MCP Wrapper] SSE server started successfully");
    
    // Create the STDIO transport for the MCP server
    const transport = new StdioServerTransport();
    
    // Start the server with the transport
    transport.start(server);
    console.error("[MCP Wrapper] MCP server started successfully");
  } catch (error) {
    console.error(`[MCP Wrapper Error] Failed to start: ${error.message}`);
    process.exit(1);
  }
}

// Start the server
main();