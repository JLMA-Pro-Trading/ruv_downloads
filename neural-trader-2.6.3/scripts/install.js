#!/usr/bin/env node

const { existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

/**
 * Neural Trader Installation Script
 *
 * Handles:
 * 1. NAPI bindings detection and installation
 * 2. Platform-specific binary loading
 * 3. Python fallback setup
 * 4. Dependency binary validation
 */

const platform = process.platform;
const arch = process.arch;
const isMusl = platform === 'linux' && existsSync('/etc/alpine-release');

// Map platform/arch to NAPI package names
const platformPackages = {
  'darwin-arm64': 'neural-trader-darwin-arm64',
  'darwin-x64': 'neural-trader-darwin-x64',
  'linux-arm64': 'neural-trader-linux-arm64-gnu',
  'linux-x64': isMusl ? 'neural-trader-linux-x64-musl' : 'neural-trader-linux-x64-gnu',
  'win32-x64': 'neural-trader-win32-x64-msvc',
};

const platformKey = `${platform}-${arch}`;
const expectedPackage = platformPackages[platformKey];

console.log('🚀 Neural Trader Installation');
console.log(`   Platform: ${platform}`);
console.log(`   Architecture: ${arch}`);
console.log(`   Expected package: ${expectedPackage || 'unknown'}`);

// Check if native bindings exist
const napiBindingsPath = join(__dirname, '..', 'neural-trader-rust', 'crates', 'napi-bindings');
const possibleBindingPaths = [
  join(napiBindingsPath, `neural-trader.${platformKey}.node`),
  join(napiBindingsPath, `neural-trader.${platformKey}-gnu.node`),
  join(napiBindingsPath, `neural-trader.${platformKey}-msvc.node`),
];

let bindingFound = false;
for (const path of possibleBindingPaths) {
  if (existsSync(path)) {
    console.log(`✅ Found native binding: ${path}`);
    bindingFound = true;
    break;
  }
}

if (!bindingFound) {
  console.log('⚠️  Native bindings not found');
  console.log('   Checking for optional platform-specific packages...');

  // Check if optional dependency was installed
  const optionalDepPath = join(__dirname, '..', 'node_modules', expectedPackage || '');
  if (expectedPackage && existsSync(optionalDepPath)) {
    console.log(`✅ Platform package installed: ${expectedPackage}`);
  } else {
    console.log('⚠️  Platform package not available');
    console.log('   Installing dependencies that need native builds...');

    // Try to build native dependencies
    try {
      console.log('   Attempting to rebuild native dependencies...');
      execSync('npm rebuild', { stdio: 'inherit' });
      console.log('✅ Native dependencies rebuilt');
    } catch (error) {
      console.error('⚠️  Could not rebuild native dependencies');
      console.error('   Some features may not be available');
    }
  }
}

// Setup Python fallback if available
console.log('\n🐍 Checking Python fallback...');
try {
  const pythonVersion = execSync('python3 --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Python available: ${pythonVersion}`);

  // Check if we have the Python implementation
  const pythonImplPath = join(__dirname, '..', 'python', 'neural_trader');
  if (existsSync(pythonImplPath)) {
    console.log('✅ Python implementation found');

    // Create virtual environment for Python fallback
    const venvPath = join(__dirname, '..', 'venv');
    if (!existsSync(venvPath)) {
      console.log('   Creating Python virtual environment...');
      try {
        execSync(`python3 -m venv ${venvPath}`, { stdio: 'inherit' });
        console.log('✅ Virtual environment created');
      } catch (error) {
        console.log('⚠️  Could not create virtual environment');
      }
    } else {
      console.log('✅ Virtual environment exists');
    }
  } else {
    console.log('⚠️  Python implementation not included in this package');
  }
} catch (error) {
  console.log('⚠️  Python not available (this is optional)');
}

// Validate key dependencies
console.log('\n📦 Validating dependencies...');
const criticalDeps = [
  'agentdb',
  'agentic-flow',
  'e2b',
  'ioredis',
  'midstreamer',
];

let allDepsOk = true;
for (const dep of criticalDeps) {
  const depPath = join(__dirname, '..', 'node_modules', dep);
  if (existsSync(depPath)) {
    console.log(`✅ ${dep}`);
  } else {
    console.log(`❌ ${dep} - missing`);
    allDepsOk = false;
  }
}

// Check dependencies that need binaries
console.log('\n🔧 Checking binary dependencies...');
const binaryDeps = [
  { name: 'hnswlib-node', check: 'build/addon.node' },
  { name: 'aidefence', check: 'dist/gateway/server.js' },
  { name: 'agentic-payments', check: 'dist/index.cjs' },
  { name: 'sublinear-time-solver', check: 'package.json' },
];

for (const { name, check } of binaryDeps) {
  const checkPath = join(__dirname, '..', 'node_modules', name, check);
  if (existsSync(checkPath)) {
    console.log(`✅ ${name}`);
  } else {
    console.log(`⚠️  ${name} - may need rebuild`);
  }
}

console.log('\n✨ Installation complete!');
if (!bindingFound) {
  console.log('\n⚠️  Performance Note:');
  console.log('   Native Rust bindings not available for your platform');
  console.log('   Falling back to JavaScript/WASM implementations');
  console.log('   Performance may be reduced compared to native bindings');
  console.log('\n   To build from source:');
  console.log('   1. Install Rust: curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh');
  console.log('   2. Run: npm run build');
}

if (!allDepsOk) {
  console.log('\n⚠️  Some dependencies are missing');
  console.log('   Run: npm install --force');
}

process.exit(0);
