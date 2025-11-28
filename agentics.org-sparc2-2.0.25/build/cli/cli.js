#!/usr/bin/env node

/**
 * SPARC2 CLI - Command Line Interface
 * Node.js wrapper for the Deno CLI implementation
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the directory of the CLI script
const scriptDir = path.resolve(__dirname, '../../');

// Run the Deno CLI implementation
const args = process.argv.slice(2);
const denoScript = path.join(scriptDir, 'src', 'cli', 'cli.ts');

// Function to find Deno executable
function findDeno() {
  // Common paths where Deno might be installed
  const commonPaths = [
    '/home/codespace/.deno/bin/deno', // Codespace specific path
    '/usr/local/bin/deno',
    '/usr/bin/deno',
    '/opt/homebrew/bin/deno',
    process.env.HOME + '/.deno/bin/deno',
    process.env.HOME + '/deno/bin/deno',
    process.env.DENO_INSTALL + '/bin/deno',
    process.env.DENO_INSTALL_ROOT + '/bin/deno',
    process.env.LOCALAPPDATA + '\\deno\\deno.exe',
    process.env.USERPROFILE + '\\.deno\\bin\\deno.exe'
  ].filter(Boolean); // Filter out undefined paths
  
  // Check common installation locations first
  for (const path of commonPaths) {
    try {
      if (fs.existsSync(path)) {
        return path;
      }
    } catch (error) {
      // Ignore errors and continue checking
    }
  }
  
  // If not found in common locations, try PATH
  try {
    // Try running deno --version to check if it's in PATH
    const result = spawn('deno', ['--version'], { stdio: 'ignore' });
    return 'deno'; // If no error, deno is in PATH
  } catch (error) {
    // If we can't find Deno, return null
    return null;
  }
}

// Find Deno executable
const denoPath = findDeno();

// Check if Deno is installed
if (!denoPath) {
  console.error('Error: Deno is not installed or not found');
  console.error('Please install Deno: https://deno.land/manual/getting_started/installation');
  console.error('After installing, make sure Deno is in your PATH or set DENO_INSTALL environment variable');
  process.exit(1);
}

// Run the Deno script with all arguments
const deno = spawn(denoPath, [
    'run',
    '--allow-read',
    '--allow-write',
    '--allow-env',
    '--allow-net',
    '--allow-run',
    denoScript,
    ...args
  ], {
    stdio: 'inherit',
    cwd: scriptDir
  });

  deno.on('close', (code) => {
    process.exit(code);
  });
