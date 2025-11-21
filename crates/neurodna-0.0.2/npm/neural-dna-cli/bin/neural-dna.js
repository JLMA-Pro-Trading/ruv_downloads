#!/usr/bin/env node

// Set up better error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 16) {
  console.error('Error: neural-dna-cli requires Node.js version 16 or higher');
  console.error(`Current version: ${nodeVersion}`);
  process.exit(1);
}

// Try to load TypeScript files directly if running in development
try {
  require('ts-node/register');
  require('../src/index.ts');
} catch (error) {
  // Fallback to compiled JavaScript
  try {
    require('../lib/index.js');
  } catch (fallbackError) {
    console.error('Error: Unable to load neural-dna CLI');
    console.error('Please ensure the package is properly installed');
    console.error('Original error:', error.message);
    console.error('Fallback error:', fallbackError.message);
    process.exit(1);
  }
}