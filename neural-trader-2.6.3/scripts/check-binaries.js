#!/usr/bin/env node

/**
 * Check Binary Dependencies Script
 *
 * Validates that all required binaries are present and functional
 */

const { existsSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');

console.log('🔍 Checking Binary Dependencies');
console.log('================================\n');

// Check NAPI bindings
console.log('📦 NAPI Bindings:');
const napiPath = join(ROOT, 'neural-trader-rust', 'crates', 'napi-bindings');
const platform = process.platform;
const arch = process.arch;

const possibleBindings = [
  `neural-trader.${platform}-${arch}.node`,
  `neural-trader.${platform}-${arch}-gnu.node`,
  `neural-trader.${platform}-${arch}-msvc.node`,
];

let napiFound = false;
for (const binding of possibleBindings) {
  const bindingPath = join(napiPath, binding);
  if (existsSync(bindingPath)) {
    console.log(`   ✅ ${binding}`);
    napiFound = true;
  }
}

if (!napiFound) {
  console.log(`   ⚠️  No NAPI binding found for ${platform}-${arch}`);
  console.log(`   Looking for: ${possibleBindings.join(', ')}`);
}

// Check optional platform packages
console.log('\n📦 Platform Packages:');
const platformPackages = [
  'neural-trader-darwin-arm64',
  'neural-trader-darwin-x64',
  'neural-trader-linux-arm64-gnu',
  'neural-trader-linux-x64-gnu',
  'neural-trader-win32-x64-msvc',
];

for (const pkg of platformPackages) {
  const pkgPath = join(ROOT, 'node_modules', pkg);
  if (existsSync(pkgPath)) {
    console.log(`   ✅ ${pkg}`);
  } else {
    console.log(`   ⚠️  ${pkg} - not installed`);
  }
}

// Check dependency binaries
console.log('\n📦 Dependency Binaries:');
const depChecks = [
  {
    name: 'hnswlib-node',
    paths: [
      'build/addon.node',
      'build/Release/addon.node',
      'build/Debug/addon.node',
    ]
  },
  {
    name: 'agentdb',
    paths: [
      'node_modules/hnswlib-node/build/addon.node',
    ]
  },
  {
    name: 'aidefence',
    paths: [
      'dist/gateway/server.js',
      'dist/index.js',
    ]
  },
  {
    name: 'agentic-payments',
    paths: [
      'dist/index.cjs',
      'dist/index.js',
    ]
  },
  {
    name: 'sublinear-time-solver',
    paths: [
      'index.js',
      'dist/index.js',
    ]
  }
];

for (const { name, paths } of depChecks) {
  const basePath = join(ROOT, 'node_modules', name);
  let found = false;

  if (!existsSync(basePath)) {
    console.log(`   ❌ ${name} - not installed`);
    continue;
  }

  for (const checkPath of paths) {
    const fullPath = join(basePath, checkPath);
    if (existsSync(fullPath)) {
      console.log(`   ✅ ${name} - ${checkPath}`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log(`   ⚠️  ${name} - missing files: ${paths.join(', ')}`);
  }
}

// Check Python fallback
console.log('\n🐍 Python Fallback:');
const venvPath = join(ROOT, 'venv');
const pythonImpl = join(ROOT, 'python', 'neural_trader');

if (existsSync(venvPath)) {
  console.log('   ✅ Virtual environment exists');
} else {
  console.log('   ⚠️  Virtual environment not created');
}

if (existsSync(pythonImpl)) {
  console.log('   ✅ Python implementation available');
} else {
  console.log('   ⚠️  Python implementation not included');
}

console.log('\n================================');
console.log(napiFound ? '✅ NAPI bindings OK' : '⚠️  NAPI bindings missing');
console.log('Run "npm run build" to build from source');
console.log('Or install with "--ignore-scripts" to skip build');
