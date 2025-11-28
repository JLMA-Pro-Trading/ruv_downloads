#!/usr/bin/env node

/**
 * List all npm packages for a given author/maintainer
 * Usage: node list-npm-packages.js [username]
 * Example: node list-npm-packages.js ruvnet
 *
 * Note: Requires Node.js 18+ (native fetch API)
 */

const username = process.argv[2] || 'ruvnet';
const NPM_SEARCH_API = 'https://registry.npmjs.org/-/v1/search';

async function fetchAllPackages(author, size = 250) {
  const url = `${NPM_SEARCH_API}?text=author:${author}&size=${size}`;

  try {
    console.log(`\n🔍 Fetching npm packages for author: ${author}\n`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const packages = data.objects || [];

    console.log(`📦 Found ${packages.length} packages:\n`);
    console.log('─'.repeat(80));

    packages.forEach((pkg, index) => {
      const { name, version, description, date } = pkg.package;
      const downloads = pkg.searchScore || 'N/A';

      console.log(`\n${index + 1}. ${name}`);
      console.log(`   Version: ${version}`);
      console.log(`   Description: ${description || 'No description'}`);
      console.log(`   Last updated: ${new Date(date).toLocaleDateString()}`);
      console.log(`   NPM: https://www.npmjs.com/package/${name}`);
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\n✅ Total: ${packages.length} packages\n`);

    // Return data for potential JSON export
    return packages.map(pkg => ({
      name: pkg.package.name,
      version: pkg.package.version,
      description: pkg.package.description,
      downloads: pkg.package.downloads,
      lastPublished: pkg.package.date,
      url: `https://www.npmjs.com/package/${pkg.package.name}`,
    }));

  } catch (error) {
    console.error('❌ Error fetching packages:', error.message);
    process.exit(1);
  }
}

async function fetchPackagesByMaintainer(username, size = 250) {
  const url = `${NPM_SEARCH_API}?text=maintainer:${username}&size=${size}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return data.objects || [];
  } catch (error) {
    console.error('Error fetching by maintainer:', error.message);
    return [];
  }
}

// Main execution
(async () => {
  const authorPackages = await fetchAllPackages(username);

  // Optionally check maintainer field as well
  console.log(`\n🔍 Checking packages where you're listed as maintainer...\n`);
  const maintainerPackages = await fetchPackagesByMaintainer(username);

  if (maintainerPackages.length > authorPackages.length) {
    console.log(`\n📊 Found ${maintainerPackages.length} packages as maintainer (may include contributions)\n`);
  }

  // Export to JSON if needed
  if (process.argv.includes('--json')) {
    const fs = await import('fs');
    const outputFile = `npm-packages-${username}.json`;
    fs.writeFileSync(outputFile, JSON.stringify(authorPackages, null, 2));
    console.log(`\n💾 Exported to ${outputFile}\n`);
  }
})();
