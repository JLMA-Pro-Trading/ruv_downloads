/**
 * MCP Configure Command
 * Interactive MCP configuration
 */

const { McpConfig } = require('../../lib/mcp-config');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  yellow: '\x1b[33m'
};

async function configureCommand(options = {}) {
  const configManager = new McpConfig();

  console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.cyan}${c.bright}     Neural Trader MCP Configuration${c.reset}`);
  console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}\n`);

  if (options.show) {
    // Show current configuration
    const config = configManager.load();
    console.log(`${c.blue}Current Configuration:${c.reset}\n`);
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    return;
  }

  if (options.reset) {
    // Reset to defaults
    configManager.reset();
    console.log(`${c.green}✓ Configuration reset to defaults${c.reset}\n`);
    return;
  }

  if (options.export) {
    // Export configuration
    const format = options.format || 'json';
    const exported = configManager.export(format);
    console.log(exported);
    return;
  }

  if (options.import) {
    // Import configuration
    const fs = require('fs');
    const data = fs.readFileSync(options.import, 'utf8');
    const format = options.format || 'json';
    configManager.import(data, format);
    console.log(`${c.green}✓ Configuration imported${c.reset}\n`);
    return;
  }

  if (options.get) {
    // Get specific value
    const value = configManager.get(options.get);
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (options.set) {
    // Set specific value
    const [key, value] = options.set.split('=');
    if (!key || value === undefined) {
      console.error(`${c.red}✗ Invalid format. Use: --set key=value${c.reset}`);
      process.exit(1);
    }

    // Try to parse value as JSON
    let parsedValue;
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }

    configManager.set(key, parsedValue);
    console.log(`${c.green}✓ ${key} = ${JSON.stringify(parsedValue)}${c.reset}\n`);
    return;
  }

  // Interactive configuration
  try {
    await configManager.configure();
  } catch (error) {
    console.error(`${c.red}✗ Configuration failed:${c.reset}`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

module.exports = { configureCommand };
