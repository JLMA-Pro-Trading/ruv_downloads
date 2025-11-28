#!/usr/bin/env node

/**
 * SPARC2 CLI Wrapper Script
 * 
 * This script provides a more robust way to run the SPARC2 CLI,
 * with better error handling and diagnostics.
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
  // More robust check for node_modules
  return __dirname.includes('node_modules') || 
         __dirname.includes('/usr/local/') || 
         __dirname.includes('/usr/lib/') ||
         __dirname.includes('/usr/share/');
}

/**
 * Find the CLI TypeScript source file
 * @returns {string|null} Path to the CLI TypeScript file if found, null otherwise
 */
function findCliSourceFile() {
  // Possible locations for the CLI TypeScript source file
  const possiblePaths = [
    // Local source directory
    path.join(__dirname, 'src', 'cli', 'cli.ts'),
    // Current directory
    path.join(process.cwd(), 'src', 'cli', 'cli.ts')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Find the CLI script (JS)
 * @returns {string|null} Path to the CLI script if found, null otherwise
 */
function findCliScript() {
  // Possible locations for the CLI script
  const possiblePaths = [
    // Local build directory
    path.join(__dirname, 'build', 'cli', 'cli.js'),
    // Global installation
    path.join(__dirname, 'build', 'cli', 'cli.js')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * Run the CLI using Deno directly with the TypeScript source
 */
function runCliWithDeno() {
  const cliSourcePath = findCliSourceFile();
  
  if (!cliSourcePath) {
    console.log(`${colors.yellow}No TypeScript source found, trying JavaScript...${colors.reset}`);
    runCliFallback();
    return;
  }

  console.log(`${colors.green}Found CLI TypeScript source at: ${cliSourcePath}${colors.reset}`);
  
  // Run the CLI using Deno
  const denoArgs = [
    'run',
    '--allow-read',
    '--allow-write',
    '--allow-env',
    '--allow-net',
    '--allow-run',
    cliSourcePath,
    ...process.argv.slice(2)
  ];
  
  console.log(`${colors.blue}Running: deno ${denoArgs.join(' ')}${colors.reset}`);
  
  // Spawn the Deno process
  const denoProcess = spawn('deno', denoArgs, {
    stdio: 'inherit',
    env: process.env
  });
  
  // Handle process exit
  denoProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(`${colors.red}CLI exited with code ${code}${colors.reset}`);
      process.exit(code);
    }
  });
  
  // Forward signals to the child process
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      denoProcess.kill(signal);
    });
  });
}

/**
 * Fallback to running the CLI using Node.js
 */
function runCliFallback() {
  const cliPath = findCliScript();
  
  if (!cliPath) {
    console.log(`${colors.red}Error: Could not find any SPARC2 CLI script.${colors.reset}`);
    console.log(`${colors.yellow}This could be due to an incomplete installation or build.${colors.reset}`);
    console.log(`${colors.yellow}Try running 'npm run build' in the SPARC2 directory.${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.green}Found CLI at: ${cliPath}${colors.reset}`);
  
  // Run the CLI using Node
  const nodeArgs = [cliPath, ...process.argv.slice(2)];
  console.log(`${colors.blue}Running: node ${nodeArgs.join(' ')}${colors.reset}`);
  
  // Spawn the Node process
  const nodeProcess = spawn('node', nodeArgs, {
    stdio: 'inherit',
    env: process.env
  });
  
  // Handle process exit
  nodeProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(`${colors.red}CLI exited with code ${code}${colors.reset}`);
      process.exit(code);
    }
  });
  
  // Forward signals to the child process
  ['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, () => {
      nodeProcess.kill(signal);
    });
  });
}

/**
 * Run a simplified version of the CLI directly
 */
function runSimplifiedCli() {
  console.log("OpenAI client initialized");
  
  const args = process.argv.slice(2);
  
  // Handle help and version flags
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    return;
  }
  
  if (args.includes('--version') || args.includes('-v')) {
    printVersion();
    return;
  }
  
  // Handle supported commands with wrappers
  if (['mcp', 'analyze', 'modify'].includes(args[0])) {
    const wrapperName = `sparc2-${args[0]}-wrapper.js`;
    const wrapperPath = path.join(__dirname, wrapperName);
    
    if (fs.existsSync(wrapperPath)) {
      console.log(`${colors.green}Found ${args[0]} wrapper at: ${wrapperPath}${colors.reset}`);
      console.log(`${colors.blue}Running ${args[0]} command...${colors.reset}`);
      
      // Spawn the process
      const childProcess = spawn('node', [wrapperPath, ...args.slice(1)], {
        stdio: 'inherit',
        env: process.env
      });
      
      // Handle process exit
      childProcess.on('exit', (code) => {
        if (code !== 0) {
          console.log(`${colors.red}Command exited with code ${code}${colors.reset}`);
          process.exit(code);
        }
      });
      
      // Forward signals to the child process
      ['SIGINT', 'SIGTERM'].forEach(signal => {
        process.on(signal, () => {
          childProcess.kill(signal);
        });
      });
      
      return;
    }
  }
  
  // For all other commands, print a message explaining the situation
  console.log(`${colors.yellow}This is a simplified version of the SPARC2 CLI.${colors.reset}`);
  console.log(`${colors.yellow}For full functionality, please run SPARC2 from a local installation.${colors.reset}`);
  console.log(`${colors.yellow}You can clone the repository and run it locally:${colors.reset}`);
  console.log(`${colors.blue}git clone https://github.com/agentics-org/sparc2.git${colors.reset}`);
  console.log(`${colors.blue}cd sparc2${colors.reset}`);
  console.log(`${colors.blue}npm install${colors.reset}`);
  console.log(`${colors.blue}npm run build${colors.reset}`);
  console.log(`${colors.blue}./sparc2 ${args.join(' ')}${colors.reset}`);
  
  // Print help as a fallback
  console.log("");
  printHelp();
}

/**
 * Print the CLI help message
 */
function printHelp() {
  console.log("SPARC 2.0 CLI v2.0.24");
  console.log("");
  console.log("Usage: sparc2 <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log("  analyze         Analyze code files for issues and improvements");
  console.log("  modify          Apply suggested modifications to code files");
  console.log("  execute         Execute code in a sandbox");
  console.log("  search          Search for similar code changes");
  console.log("  checkpoint      Create a git checkpoint");
  console.log("  rollback        Rollback to a previous checkpoint");
  console.log("  config          Manage configuration");
  console.log("  api             Start a Model Context Protocol (MCP) HTTP API server");
  console.log("  mcp             Start a Model Context Protocol (MCP) server using stdio transport");
  console.log("");
  console.log("Options:");
  console.log("  --help, -h       Show help");
  console.log("  --version, -v    Show version");
  console.log("");
  console.log("For command-specific help, run: sparc2 <command> --help");
}

/**
 * Print the CLI version
 */
function printVersion() {
  console.log("SPARC 2.0 CLI v2.0.24");
}

/**
 * Display diagnostic information
 */
function showDiagnostics() {
  console.log(`${colors.magenta}=== SPARC2 CLI Diagnostics ===${colors.reset}`);
  
  // Check Node.js version
  try {
    const nodeVersion = execSync('node --version').toString().trim();
    console.log(`${colors.green}Node.js version: ${nodeVersion}${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}Failed to get Node.js version: ${error.message}${colors.reset}`);
  }
  
  // Check Deno version
  try {
    const denoVersion = execSync('deno --version').toString().trim().split('\n')[0];
    console.log(`${colors.green}Deno version: ${denoVersion}${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}Deno is not installed or not in PATH${colors.reset}`);
  }
  
  // Check npm version
  try {
    const npmVersion = execSync('npm --version').toString().trim();
    console.log(`${colors.green}npm version: ${npmVersion}${colors.reset}`);
  } catch (error) {
    console.log(`${colors.red}Failed to get npm version: ${error.message}${colors.reset}`);
  }
  
  // Check SPARC2 package version
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log(`${colors.green}SPARC2 package version: ${packageJson.version}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Could not find package.json${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}Failed to read package.json: ${error.message}${colors.reset}`);
  }
  
  // Check if running from node_modules
  const isGlobal = isRunningFromNodeModules();
  console.log(`${colors.green}Running from node_modules: ${isGlobal}${colors.reset}`);
  
  // Check for CLI TypeScript source
  const cliSourcePath = findCliSourceFile();
  if (cliSourcePath) {
    console.log(`${colors.green}Found CLI TypeScript source at: ${cliSourcePath}${colors.reset}`);
  } else {
    console.log(`${colors.yellow}Could not find CLI TypeScript source${colors.reset}`);
  }
  
  // Check for CLI script
  const cliPath = findCliScript();
  if (cliPath) {
    console.log(`${colors.green}Found CLI script at: ${cliPath}${colors.reset}`);
  } else {
    console.log(`${colors.red}Could not find CLI script${colors.reset}`);
  }
  
  // Check current directory
  console.log(`${colors.green}Current directory: ${process.cwd()}${colors.reset}`);
  console.log(`${colors.green}Script directory: ${__dirname}${colors.reset}`);
  
  console.log(`${colors.magenta}=== End of Diagnostics ===${colors.reset}`);
}

// Main execution
if (process.argv.includes('--diagnostics')) {
  showDiagnostics();
  process.exit(0);
}

if (!isDenoInstalled()) {
  printDenoInstallInstructions();
  process.exit(1);
}

// If running from node_modules, use the simplified CLI
if (isRunningFromNodeModules()) {
  console.log(`${colors.yellow}Running from global installation, using simplified CLI${colors.reset}`);
  runSimplifiedCli();
} else {
  // Otherwise, try to run with Deno first (directly from TypeScript)
  runCliWithDeno();
}