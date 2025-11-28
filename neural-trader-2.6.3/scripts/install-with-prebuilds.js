#!/usr/bin/env node

/**
 * Smart installation script for neural-trader
 * Uses prebuilt binaries when available, falls back to compilation
 */

const { execSync, exec } = require('child_process');
const { existsSync, copyFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { platform, arch } = process;

const PREBUILDS_DIR = join(__dirname, '..', 'prebuilds');
const platformKey = `${platform}-${arch}`;

console.log(`🚀 Installing neural-trader for ${platformKey}\n`);

// Check if we have prebuilt binaries
const prebuildPath = join(PREBUILDS_DIR, platformKey);
const hasPrebuilds = existsSync(prebuildPath);

if (hasPrebuilds) {
  console.log(`✅ Found prebuilt binaries for ${platformKey}`);
  console.log(`   Installing optional dependencies with prebuilt binaries...\n`);

  // Install optional dependencies
  const optionalDeps = [
    { name: 'agentdb', nativeDep: 'hnswlib-node', binary: 'addon.node', buildPath: 'build/Release' },
    { name: 'agentic-flow', nativeDep: 'better-sqlite3', binary: 'better_sqlite3.node', buildPath: 'build/Release' }
  ];

  for (const dep of optionalDeps) {
    try {
      // Install the package (will try to build but may fail)
      console.log(`📦 Installing ${dep.name}...`);
      exec(`npm install ${dep.name} --no-save`, { stdio: 'pipe' }, (error) => {
        if (error) {
          console.log(`   ⚠️  Build failed for ${dep.name}, using prebuild...`);
        }

        // Copy prebuilt binary
        const prebuildBinary = join(prebuildPath, dep.nativeDep, dep.binary);
        if (existsSync(prebuildBinary)) {
          const targetDir = join(__dirname, '..', 'node_modules', dep.nativeDep, dep.buildPath);
          if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
          }

          const targetPath = join(targetDir, dep.binary);
          try {
            copyFileSync(prebuildBinary, targetPath);
            console.log(`   ✅ ${dep.name} ready with prebuilt binary`);
          } catch (copyError) {
            console.log(`   ⚠️  Could not copy prebuild for ${dep.name}: ${copyError.message}`);
          }
        }
      });

    } catch (error) {
      console.log(`   ⚠️  ${dep.name} installation skipped`);
    }
  }

  console.log('\n✅ Installation complete with prebuilt binaries!\n');

} else {
  // No prebuilds available - check for build tools
  let hasBuildTools = false;
  try {
    execSync('python3 --version', { stdio: 'pipe' });
    execSync('node-gyp --version || npm install -g node-gyp', { stdio: 'pipe' });
    hasBuildTools = true;
  } catch {
    // No build tools
  }

  if (hasBuildTools) {
    console.log('⚠️  No prebuilt binaries for ${platformKey}');
    console.log('✅ Build tools detected - compiling from source\n');
    console.log('   This may take a few minutes...\n');

    try {
      execSync('npm install', { stdio: 'inherit' });
      console.log('\n✅ Installation complete!');
    } catch (error) {
      console.error('\n❌ Compilation failed:', error.message);
      process.exit(1);
    }

  } else {
    console.log('⚠️  No prebuilt binaries for ${platformKey}');
    console.log('⚠️  No build tools detected\n');
    console.log('📦 Installing core package only...\n');

    try {
      execSync('npm install --ignore-scripts --omit=optional', { stdio: 'inherit' });
      console.log('\n✅ Core installation complete!');
      console.log('\n💡 For full functionality:');
      console.log('   1. Install Python 3 and node-gyp');
      console.log('   2. Run: npm install --force\n');
    } catch (error) {
      console.error('\n❌ Installation failed:', error.message);
      process.exit(1);
    }
  }
}
