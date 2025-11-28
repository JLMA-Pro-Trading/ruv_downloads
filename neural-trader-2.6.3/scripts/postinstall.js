#!/usr/bin/env node

/**
 * Post-install script to handle dependencies that need additional setup
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

console.log('🔧 Running post-install tasks...');

// Check if we're in a development environment
const isDev = existsSync(join(__dirname, '..', '.git'));

if (isDev) {
  console.log('📝 Development environment detected');

  // Try to rebuild native dependencies
  const depsToRebuild = [
    'hnswlib-node',
    'agentdb',
  ];

  for (const dep of depsToRebuild) {
    const depPath = join(__dirname, '..', 'node_modules', dep);
    if (existsSync(depPath)) {
      try {
        console.log(`   Rebuilding ${dep}...`);
        execSync(`npm rebuild ${dep}`, { stdio: 'pipe' });
        console.log(`   ✅ ${dep} rebuilt`);
      } catch (error) {
        console.log(`   ⚠️  ${dep} rebuild failed (may work anyway)`);
      }
    }
  }
} else {
  console.log('📦 Production install - skipping development tasks');
}

console.log('✅ Post-install complete');
