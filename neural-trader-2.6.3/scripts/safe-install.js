#!/usr/bin/env node

/**
 * Safe installation wrapper for neural-trader
 * Handles optional dependency failures gracefully
 */

const { execSync } = require('child_process');

console.log('🚀 Safe Install - neural-trader\n');

// Try to detect if we have build tools
let hasBuildTools = false;
try {
  execSync('python3 --version', { stdio: 'pipe' });
  execSync('node-gyp --version', { stdio: 'pipe' });
  hasBuildTools = true;
  console.log('✅ Build tools detected - full installation possible\n');
} catch {
  console.log('⚠️  No build tools detected - installing core functionality only');
  console.log('   Optional features (agentdb, agentic-flow) will be skipped\n');
}

// Install based on available tools
try {
  if (hasBuildTools) {
    console.log('📦 Installing with all dependencies...\n');
    execSync('npm install', { stdio: 'inherit' });
  } else {
    console.log('📦 Installing core package only...\n');
    execSync('npm install --ignore-scripts', { stdio: 'inherit' });

    // Try to install optional deps, ignore failures
    console.log('\n📦 Attempting optional dependencies...\n');
    const optionalDeps = ['agentic-flow', 'agentdb'];

    for (const dep of optionalDeps) {
      try {
        execSync(`npm install ${dep}`, { stdio: 'pipe' });
        console.log(`   ✅ ${dep} installed`);
      } catch {
        console.log(`   ⚠️  ${dep} skipped (requires build tools)`);
      }
    }
  }

  console.log('\n✅ Installation complete!\n');

  if (!hasBuildTools) {
    console.log('💡 For full functionality, install Python and node-gyp:');
    console.log('   npm install -g node-gyp');
    console.log('   # Then reinstall neural-trader\n');
  }

} catch (error) {
  console.error('\n❌ Installation failed:', error.message);
  process.exit(1);
}
