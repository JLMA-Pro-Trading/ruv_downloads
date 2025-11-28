#!/usr/bin/env node

/**
 * MCP Wrapper Generator CLI
 * Universal tool for generating MCP server wrappers
 */

import { createInterface } from 'readline';
import { generateMCPWrappers } from '../dist/tools/mcp-generator/index.js';
import { FileWriter } from '../dist/tools/mcp-generator/writer.js';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    outputDir: './servers',
    target: 'both',
    interactive: !args.includes('--yes') && !args.includes('-y'),
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    update: args.includes('--update') || args.includes('-u'),
    force: args.includes('--force') || args.includes('-f'),
    includeTypes: !args.includes('--no-types'),
    includeTests: args.includes('--tests'),
    help: args.includes('--help') || args.includes('-h'),
    servers: [],
  };

  // Parse --output or -o
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    options.outputDir = args[outputIndex + 1];
  }

  // Parse --target or -t
  const targetIndex = args.findIndex(arg => arg === '--target' || arg === '-t');
  if (targetIndex !== -1 && args[targetIndex + 1]) {
    const target = args[targetIndex + 1];
    if (target === 'frontend' || target === 'backend' || target === 'both') {
      options.target = target;
    }
  }

  // Parse --servers or -s
  const serversIndex = args.findIndex(arg => arg === '--servers' || arg === '-s');
  if (serversIndex !== -1 && args[serversIndex + 1]) {
    options.servers = args[serversIndex + 1].split(',').map(s => s.trim());
  }

  return options;
}

// Show help
function showHelp() {
  console.log(`
MCP Wrapper Generator
Generate TypeScript wrappers for MCP servers

USAGE:
  npx iris-generate-wrappers [OPTIONS]

OPTIONS:
  -o, --output <dir>       Output directory (default: ./servers)
  -t, --target <target>    Target: frontend, backend, both (default: both)
  -s, --servers <names>    Comma-separated server names (default: all)
  -y, --yes                Skip interactive prompts
  -d, --dry-run            Show what would be generated without writing files
  -u, --update             Update existing wrappers
  -f, --force              Force overwrite existing files
  --no-types               Skip TypeScript types generation
  --tests                  Generate test files
  -h, --help               Show this help message

EXAMPLES:
  # Interactive mode (recommended)
  npx iris-generate-wrappers

  # Generate for specific servers
  npx iris-generate-wrappers -s claude-flow,ruv-swarm

  # Frontend only
  npx iris-generate-wrappers -t frontend -o ./src/api/mcp

  # Backend only
  npx iris-generate-wrappers -t backend -o ./lib/mcp

  # Dry run to preview
  npx iris-generate-wrappers --dry-run

  # Non-interactive with force overwrite
  npx iris-generate-wrappers -y -f

INSTALLATION:
  npm install @foxruv/agent-learning-core

  Or add to package.json scripts:
  {
    "scripts": {
      "generate:mcp": "iris-generate-wrappers"
    }
  }

PROGRAMMATIC USAGE:
  import { generateMCPWrappers } from '@foxruv/agent-learning-core/tools';

  const result = await generateMCPWrappers({
    outputDir: './servers',
    target: 'both',
    dryRun: false
  });

MORE INFO:
  https://github.com/ruvnet/agent-learning-core
`);
}

// Interactive prompts
async function promptUser(question, defaultValue = '') {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const prompt = defaultValue
      ? `${question} (default: ${defaultValue}): `
      : `${question}: `;

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Interactive mode
async function runInteractive(options) {
  console.log('\n🚀 MCP Wrapper Generator\n');
  console.log('This tool will generate TypeScript wrappers for your MCP servers.\n');

  // Ask for output directory
  options.outputDir = await promptUser(
    'Output directory',
    options.outputDir
  );

  // Ask for target
  const targetOptions = ['both', 'frontend', 'backend'];
  console.log('\nTarget environment:');
  console.log('  1. both (frontend + backend)');
  console.log('  2. frontend (browser/fetch)');
  console.log('  3. backend (Node.js/stdio)');
  const targetChoice = await promptUser('Choose (1-3)', '1');
  const targetIndex = parseInt(targetChoice, 10) - 1;
  if (targetIndex >= 0 && targetIndex < targetOptions.length) {
    options.target = targetOptions[targetIndex];
  }

  // Ask for specific servers
  const serversInput = await promptUser(
    'Specific servers (comma-separated, or leave empty for all)',
    ''
  );
  if (serversInput) {
    options.servers = serversInput.split(',').map(s => s.trim());
  }

  // Ask for dry run
  const dryRunInput = await promptUser('Dry run? (y/N)', 'n');
  options.dryRun = dryRunInput.toLowerCase() === 'y';

  // Ask for force
  const forceInput = await promptUser('Force overwrite existing files? (y/N)', 'n');
  options.force = forceInput.toLowerCase() === 'y';

  console.log('\n');
}

// Main
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  try {
    // Run interactive mode if enabled
    if (options.interactive) {
      await runInteractive(options);
    }

    console.log('🔍 Detecting MCP servers...\n');

    // Generate wrappers
    const result = await generateMCPWrappers(options);

    // Display result
    console.log(FileWriter.formatResult(result));

    if (!result.success) {
      process.exit(1);
    }

    if (!result.dryRun && result.success) {
      console.log('Next steps:');
      console.log(`  1. Import wrappers: import { YourClient } from '${options.outputDir}'`);
      console.log('  2. Initialize client and use the generated methods');
      console.log('  3. Check the README in each server directory for usage examples\n');
    }

    if (result.dryRun) {
      console.log('To actually generate files, run without --dry-run flag\n');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
