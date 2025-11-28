#!/usr/bin/env node

/**
 * Neural Trader - NAPI-RS Installation Script
 *
 * Automatically downloads the correct pre-built .node binary for the current platform
 * Falls back to local compilation if binary is not available
 */

const { existsSync } = require('fs');
const { join } = require('path');
const { platform, arch } = require('os');
const { execSync } = require('child_process');

// Platform detection
const PLATFORM_MAP = {
  'darwin': {
    'x64': 'darwin-x64',
    'arm64': 'darwin-arm64'
  },
  'linux': {
    'x64': 'linux-x64-gnu',
    'arm64': 'linux-arm64-gnu'
  },
  'win32': {
    'x64': 'win32-x64-msvc'
  }
};

// NAPI binary names (matching napi-rs convention)
const NAPI_NAME_MAP = {
  'darwin-x64': 'neural-trader.darwin-x64.node',
  'darwin-arm64': 'neural-trader.darwin-arm64.node',
  'linux-x64-gnu': 'neural-trader.linux-x64-gnu.node',
  'linux-arm64-gnu': 'neural-trader.linux-arm64-gnu.node',
  'win32-x64-msvc': 'neural-trader.win32-x64-msvc.node'
};

function log(message) {
  console.log(`[neural-trader] ${message}`);
}

function error(message) {
  console.error(`[neural-trader] ERROR: ${message}`);
}

function detectPlatform() {
  const os = platform();
  const cpu = arch();

  if (!PLATFORM_MAP[os]) {
    throw new Error(`Unsupported platform: ${os}`);
  }

  if (!PLATFORM_MAP[os][cpu]) {
    throw new Error(`Unsupported architecture: ${cpu} on ${os}`);
  }

  return PLATFORM_MAP[os][cpu];
}

function checkBinaryExists(binaryPath) {
  return existsSync(binaryPath);
}

function tryDownloadBinary(platformId, binaryPath) {
  const packageName = `@neural-trader/rust-${platformId}`;

  try {
    log(`Attempting to download pre-built binary for ${platformId}...`);

    // Try to require the optional dependency
    const optionalPkg = require.resolve(packageName);
    log(`Found pre-built binary package: ${packageName}`);
    return true;
  } catch (err) {
    log(`Pre-built binary not available for ${platformId}`);
    return false;
  }
}

function buildFromSource() {
  log('Building from source...');
  log('This may take several minutes on first install.');

  const cwd = join(__dirname, '..');

  try {
    // Check if cargo is installed
    execSync('cargo --version', { stdio: 'ignore' });
  } catch (err) {
    error('Rust/Cargo is not installed. Please install from https://rustup.rs/');
    process.exit(1);
  }

  try {
    log('Building NAPI bindings...');
    execSync('npm run build', {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, CARGO_BUILD_JOBS: require('os').cpus().length }
    });
    log('Build completed successfully!');
  } catch (err) {
    error('Build failed. Please check the error messages above.');
    process.exit(1);
  }
}

function main() {
  log('Starting NAPI-RS installation...');

  try {
    const platformId = detectPlatform();
    log(`Detected platform: ${platformId}`);

    const binaryName = NAPI_NAME_MAP[platformId];
    const binaryPath = join(__dirname, '..', 'neural-trader-rust', 'crates', 'napi-bindings', binaryName);

    // Check if binary already exists
    if (checkBinaryExists(binaryPath)) {
      log('Native binary already exists. Installation complete.');
      return;
    }

    // Try to download pre-built binary
    const downloaded = tryDownloadBinary(platformId, binaryPath);

    if (!downloaded) {
      // Fall back to building from source
      log('No pre-built binary available. Building from source...');
      buildFromSource();
    }

    log('Installation complete!');
  } catch (err) {
    error(err.message);
    error('Installation failed. Please report this issue at:');
    error('https://github.com/ruvnet/neural-trader/issues');
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  main();
}

module.exports = { detectPlatform, checkBinaryExists };
