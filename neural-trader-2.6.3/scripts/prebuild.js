#!/usr/bin/env node

/**
 * Prebuild script for NAPI bindings
 *
 * This script runs before build to ensure all prerequisites are met
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

console.log('🔧 Prebuild checks...');

// Check for Rust installation
try {
  const rustVersion = execSync('rustc --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Rust installed: ${rustVersion}`);
} catch (error) {
  console.error('❌ Rust not found');
  console.error('   Install Rust from: https://rustup.rs');
  console.error('   Run: curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh');
  process.exit(1);
}

// Check for Cargo
try {
  const cargoVersion = execSync('cargo --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Cargo installed: ${cargoVersion}`);
} catch (error) {
  console.error('❌ Cargo not found');
  process.exit(1);
}

// Check for napi-cli
try {
  const napiVersion = execSync('npx @napi-rs/cli --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ NAPI CLI available: ${napiVersion}`);
} catch (error) {
  console.log('⚠️  NAPI CLI not found, installing...');
  try {
    execSync('npm install --save-dev @napi-rs/cli', { stdio: 'inherit' });
    console.log('✅ NAPI CLI installed');
  } catch (installError) {
    console.error('❌ Failed to install NAPI CLI');
    process.exit(1);
  }
}

// Verify Cargo.toml exists
const cargoTomlPath = join(__dirname, '..', 'neural-trader-rust', 'crates', 'napi-bindings', 'Cargo.toml');
if (!existsSync(cargoTomlPath)) {
  console.error('❌ Cargo.toml not found at:', cargoTomlPath);
  process.exit(1);
}
console.log('✅ Cargo.toml found');

console.log('✅ Prebuild checks passed');
