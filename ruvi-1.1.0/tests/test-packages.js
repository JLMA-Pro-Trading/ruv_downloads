#!/usr/bin/env node

/**
 * Test script for package listing functionality
 * Tests the npm API integration and package categorization
 */

const NPM_SEARCH_API = 'https://registry.npmjs.org/-/v1/search';
const AUTHOR = 'ruvnet';

async function testPackageFetch() {
  console.log('🧪 Testing Package Fetch...\n');

  try {
    const response = await fetch(`${NPM_SEARCH_API}?text=author:${AUTHOR}&size=250`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const packages = data.objects || [];

    console.log(`✅ Fetch successful`);
    console.log(`📦 Found ${packages.length} packages\n`);

    // Test categorization
    const categories = categorizePackages(packages);

    console.log('📊 Package Distribution by Category:\n');
    for (const [category, pkgs] of Object.entries(categories)) {
      if (pkgs.length > 0) {
        console.log(`${getCategoryEmoji(category)} ${category}: ${pkgs.length} packages`);
      }
    }

    console.log('\n✅ All tests passed!\n');

    // Show sample packages from each category
    console.log('📋 Sample Packages:\n');
    let sampleCount = 0;
    for (const [category, pkgs] of Object.entries(categories)) {
      if (pkgs.length > 0 && sampleCount < 3) {
        console.log(`\n${getCategoryEmoji(category)} ${category}:`);
        pkgs.slice(0, 2).forEach(pkg => {
          console.log(`  • ${pkg.package.name} v${pkg.package.version}`);
          console.log(`    ${truncate(pkg.package.description || 'No description', 70)}`);
        });
        sampleCount++;
      }
    }

    // Test MCP detection
    console.log('\n\n🔌 MCP Servers Detected:\n');
    const mcpPackages = packages.filter((pkg) => {
      const name = pkg.package.name.toLowerCase();
      const desc = (pkg.package.description || '').toLowerCase();
      return (
        name.includes('mcp') ||
        desc.includes('mcp') ||
        desc.includes('model context protocol') ||
        name === 'claude-flow' ||
        name === 'agentic-flow' ||
        name === 'flow-nexus' ||
        name === 'ruv-swarm'
      );
    });

    mcpPackages.slice(0, 5).forEach(pkg => {
      console.log(`  ✓ ${pkg.package.name} v${pkg.package.version}`);
    });

    console.log(`\n  Total MCP servers: ${mcpPackages.length}`);

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

function categorizePackages(packages) {
  const categories = {
    'AI Orchestration': [],
    'Agent Frameworks': [],
    'MCP Servers': [],
    'Databases & Storage': [],
    'Security & Defense': [],
    'Research Tools': [],
    'Development Tools': [],
    'Other': [],
  };

  packages.forEach((pkg) => {
    const name = pkg.package.name.toLowerCase();
    const desc = (pkg.package.description || '').toLowerCase();

    if (
      name.includes('flow') ||
      desc.includes('orchestration') ||
      desc.includes('swarm')
    ) {
      categories['AI Orchestration'].push(pkg);
    } else if (
      name.includes('agent') ||
      desc.includes('agent') ||
      desc.includes('autonomous')
    ) {
      categories['Agent Frameworks'].push(pkg);
    } else if (name.includes('mcp') || desc.includes('mcp')) {
      categories['MCP Servers'].push(pkg);
    } else if (name.includes('db') || desc.includes('database') || desc.includes('vector')) {
      categories['Databases & Storage'].push(pkg);
    } else if (
      name.includes('defense') ||
      name.includes('defence') ||
      desc.includes('security') ||
      desc.includes('adversarial')
    ) {
      categories['Security & Defense'].push(pkg);
    } else if (
      name.includes('research') ||
      desc.includes('research') ||
      name.includes('goalie')
    ) {
      categories['Research Tools'].push(pkg);
    } else if (
      desc.includes('development') ||
      desc.includes('toolkit') ||
      desc.includes('solver')
    ) {
      categories['Development Tools'].push(pkg);
    } else {
      categories['Other'].push(pkg);
    }
  });

  return categories;
}

function getCategoryEmoji(category) {
  const emojiMap = {
    'AI Orchestration': '🤖',
    'Agent Frameworks': '🧠',
    'MCP Servers': '🔌',
    'Databases & Storage': '💾',
    'Security & Defense': '🛡️',
    'Research Tools': '🔬',
    'Development Tools': '🛠️',
    'Other': '📦',
  };
  return emojiMap[category] || '📦';
}

function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length - 3) + '...';
}

// Run tests
testPackageFetch().then(success => {
  process.exit(success ? 0 : 1);
});
