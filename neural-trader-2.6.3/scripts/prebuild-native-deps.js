#!/usr/bin/env node

/**
 * Prebuild native dependencies for neural-trader
 * Creates platform-specific packages with prebuilt binaries
 */

const { execSync } = require('child_process');
const { mkdirSync, copyFileSync, writeFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

const PLATFORMS = [
  { os: 'linux', arch: 'x64', name: 'linux-x64' },
  { os: 'linux', arch: 'arm64', name: 'linux-arm64' },
  { os: 'darwin', arch: 'x64', name: 'darwin-x64' },
  { os: 'darwin', arch: 'arm64', name: 'darwin-arm64' },
  { os: 'win32', arch: 'x64', name: 'win32-x64' },
];

const NATIVE_DEPS = [
  { name: 'hnswlib-node', version: '^3.0.0' },
  { name: 'better-sqlite3', version: '^11.10.0' },
];

async function buildForPlatform(platform) {
  console.log(`\n📦 Building native deps for ${platform.name}...`);

  const buildDir = join(__dirname, '..', 'prebuilds', platform.name);
  mkdirSync(buildDir, { recursive: true });

  for (const dep of NATIVE_DEPS) {
    console.log(`  Building ${dep.name}...`);

    try {
      // Install the dependency
      execSync(`npm install ${dep.name}@${dep.version}`, {
        cwd: buildDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          npm_config_platform: platform.os,
          npm_config_arch: platform.arch,
        }
      });

      // Find the .node file
      const nodeModulesPath = join(buildDir, 'node_modules', dep.name);
      const nodeFiles = findNodeFiles(nodeModulesPath);

      if (nodeFiles.length > 0) {
        console.log(`    ✅ Built ${nodeFiles.length} native modules`);

        // Create package structure
        const pkgDir = join(__dirname, '..', 'prebuilds', `${dep.name}-${platform.name}`);
        mkdirSync(pkgDir, { recursive: true });

        // Copy .node files
        for (const file of nodeFiles) {
          const dest = join(pkgDir, file.split('/').pop());
          copyFileSync(file, dest);
          console.log(`      Copied: ${file.split('/').pop()}`);
        }

        // Create package.json
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@neural-trader/${dep.name}-${platform.name}`,
          version: "1.0.0",
          description: `Prebuilt ${dep.name} for ${platform.name}`,
          main: nodeFiles[0].split('/').pop(),
          os: [platform.os],
          cpu: [platform.arch],
          files: ["*.node"]
        }, null, 2));

      } else {
        console.log(`    ⚠️  No .node files found`);
      }

    } catch (error) {
      console.log(`    ❌ Build failed: ${error.message}`);
    }
  }
}

function findNodeFiles(dir) {
  const results = [];

  function search(currentDir) {
    if (!existsSync(currentDir)) return;

    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        search(fullPath);
      } else if (entry.name.endsWith('.node')) {
        results.push(fullPath);
      }
    }
  }

  search(dir);
  return results;
}

async function main() {
  console.log('🔨 Prebuilding native dependencies for all platforms\n');

  // Build for current platform first
  const currentPlatform = PLATFORMS.find(p =>
    p.os === process.platform && p.arch === process.arch
  );

  if (currentPlatform) {
    await buildForPlatform(currentPlatform);
  }

  console.log('\n✅ Prebuild complete!');
  console.log('\nTo build for other platforms, use Docker or CI/CD with platform emulation');
}

main().catch(console.error);
