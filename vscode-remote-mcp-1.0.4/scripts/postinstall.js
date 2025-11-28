#!/usr/bin/env node

/**
 * Postinstall script for vscode-remote-mcp
 * 
 * This script ensures that all dependencies are installed correctly
 * when the package is installed globally.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the path to the vsc-remote directory
const vscRemotePath = path.join(__dirname, '..', 'vsc-remote');

// Check if the vsc-remote directory exists
if (!fs.existsSync(vscRemotePath)) {
  console.error('Error: vsc-remote directory not found.');
  process.exit(1);
}

// Check if we're in a global installation
const isGlobalInstall = process.env.npm_config_global === 'true';

if (isGlobalInstall) {
  console.log('Global installation detected. Installing dependencies...');
  
  try {
    // Create a package.json file in the node_modules directory
    const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      fs.mkdirSync(nodeModulesPath, { recursive: true });
    }
    
    // Install the dependencies
    const dependencies = [
      'commander@^11.0.0',
      'inquirer@^8.2.5',
      'chalk@^4.1.2',
      'ora@^5.4.1',
      'dotenv@^16.0.3',
      'uuid@^9.0.1',
      'ws@^8.18.1',
      '@modelcontextprotocol/sdk@^1.7.0'
    ];
    
    console.log('Installing dependencies:', dependencies.join(', '));
    
    execSync(`npm install --no-save ${dependencies.join(' ')}`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    
    console.log('Dependencies installed successfully.');
  } catch (error) {
    console.error('Failed to install dependencies:', error.message);
    // Don't exit with error code, as this would prevent the package from being installed
    console.error('You may need to install the dependencies manually:');
    console.error('npm install -g commander inquirer chalk ora dotenv uuid ws @modelcontextprotocol/sdk');
  }
}