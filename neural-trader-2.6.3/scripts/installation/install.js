#!/usr/bin/env node

/**
 * Post-install script for neural-trader NPM package
 * Handles platform-specific binary installation and verification
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const platform = process.platform;
const arch = process.arch;

console.log(`\n🚀 Neural Trader Installation`);
console.log(`   Platform: ${platform}-${arch}\n`);

function checkRustInstalled() {
  try {
    execSync('cargo --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function buildFromSource() {
  console.log('📦 Building from source with Cargo...');
  try {
    execSync('cd neural-trader-rust && cargo build --release', {
      stdio: 'inherit'
    });
    console.log('✓ Built successfully from source\n');
    return true;
  } catch (error) {
    console.error('✗ Build from source failed:', error.message);
    return false;
  }
}

function checkBinaryExists() {
  const binaryName = platform === 'win32' ? 'neural-trader.exe' : 'neural-trader';
  const possiblePaths = [
    path.join(__dirname, '..', 'bin', binaryName),
    path.join(__dirname, '..', 'neural-trader-rust', 'target', 'release', binaryName)
  ];

  for (const binaryPath of possiblePaths) {
    if (fs.existsSync(binaryPath)) {
      console.log(`✓ Binary found: ${binaryPath}`);
      return true;
    }
  }

  return false;
}

function checkNapiBindings() {
  try {
    require('../index.js');
    console.log('✓ NAPI bindings available\n');
    return true;
  } catch {
    console.log('⚠️  NAPI bindings not available\n');
    return false;
  }
}

function checkPythonFallback() {
  const pythonPath = path.join(__dirname, '..', 'venv', 'bin', 'python');
  if (fs.existsSync(pythonPath)) {
    console.log('✓ Python fallback available\n');
    return true;
  }
  console.log('⚠️  Python fallback not available\n');
  return false;
}

function main() {
  let hasRuntime = false;

  // Check for pre-built binary
  if (checkBinaryExists()) {
    hasRuntime = true;
  }

  // Check for NAPI bindings
  if (checkNapiBindings()) {
    hasRuntime = true;
  }

  // If no runtime, try building from source
  if (!hasRuntime && checkRustInstalled()) {
    console.log('⚠️  No pre-built binary found for your platform');
    hasRuntime = buildFromSource();
  }

  // Check Python fallback
  if (!hasRuntime) {
    hasRuntime = checkPythonFallback();
  }

  // Summary
  console.log('─────────────────────────────────────');
  if (hasRuntime) {
    console.log('✅ Installation successful!');
    console.log('\nYou can now run:');
    console.log('   npx neural-trader --help');
    console.log('   npx neural-trader mcp start');
  } else {
    console.log('⚠️  Warning: No runtime available');
    console.log('\nTo use neural-trader, you need either:');
    console.log('   1. Install Rust and run: cargo build --release');
    console.log('   2. Use Python version in ./src/');
    console.log('   3. Wait for pre-built binaries for your platform');
  }
  console.log('─────────────────────────────────────\n');
}

main();
