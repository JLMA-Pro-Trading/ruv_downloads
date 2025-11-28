#!/usr/bin/env node

/**
 * VSCode Remote MCP Server - CLI Wrapper
 *
 * This is a wrapper script for the vsc-remote CLI tool that ensures
 * all dependencies are properly loaded.
 */

const path = require('path');
const fs = require('fs');

// Define the path to the vsc-remote directory
const vscRemotePath = path.join(__dirname, '..', 'vsc-remote');
const vscRemoteBinPath = path.join(vscRemotePath, 'bin', 'vsc-remote.js');

// Check if the vsc-remote directory exists
if (!fs.existsSync(vscRemotePath)) {
  console.error('Error: vsc-remote directory not found.');
  process.exit(1);
}

// Check if the vsc-remote.js file exists
if (!fs.existsSync(vscRemoteBinPath)) {
  console.error('Error: vsc-remote.js file not found.');
  process.exit(1);
}

// Set up the module paths to include the node_modules from the main package
const mainNodeModulesPath = path.join(__dirname, '..', 'node_modules');
module.paths.unshift(mainNodeModulesPath);

// Now require and run the actual CLI script
try {
  require(vscRemoteBinPath);
} catch (error) {
  console.error('Error running vsc-remote:', error.message);
  
  if (error.code === 'MODULE_NOT_FOUND') {
    console.error('\nMissing dependencies. This might be due to a global installation issue.');
    console.error('Try installing the package locally and using npx:');
    console.error('\n  npm install vscode-remote-mcp');
    console.error('  npx vsc-remote start --mode websocket --port 3001\n');
    console.error('Or install the dependencies manually:');
    console.error('\n  npm install -g commander inquirer chalk ora dotenv uuid ws @modelcontextprotocol/sdk\n');
  }
  
  process.exit(1);
}