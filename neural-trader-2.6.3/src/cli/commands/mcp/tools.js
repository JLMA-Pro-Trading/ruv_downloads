/**
 * MCP Tools Command
 * List available MCP tools
 */

const { McpClient } = require('../../lib/mcp-client');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function toolsCommand(options = {}) {
  const client = new McpClient();

  // Handle both object and array arguments from commander
  let parsedOptions = options;
  if (Array.isArray(options) && options.length > 0) {
    parsedOptions = {};
  } else if (typeof options !== 'object') {
    parsedOptions = {};
  }

  const { category = null, format = 'table', search = null } = parsedOptions;

  try {
    let tools;

    if (search) {
      console.log(`${c.blue}${c.bright}Searching for: "${search}"${c.reset}\n`);
      tools = await client.searchTools(search);
    } else if (category) {
      console.log(`${c.blue}${c.bright}Tools in category: ${category}${c.reset}\n`);
      tools = await client.listTools(category);
    } else {
      console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}`);
      console.log(`${c.cyan}${c.bright}     Neural Trader MCP Tools (99+)${c.reset}`);
      console.log(`${c.cyan}${c.bright}═══════════════════════════════════════════════════${c.reset}\n`);
      tools = await client.listTools();
    }

    if (tools.length === 0) {
      console.log(`${c.yellow}No tools found${c.reset}\n`);
      return;
    }

    if (format === 'table') {
      // Display as table grouped by category
      const categories = {};

      tools.forEach(tool => {
        if (!categories[tool.category]) {
          categories[tool.category] = [];
        }
        categories[tool.category].push(tool);
      });

      // Sort categories
      const sortedCategories = Object.entries(categories).sort((a, b) => b[1].length - a[1].length);

      for (const [cat, categoryTools] of sortedCategories) {
        console.log(`${c.blue}${c.bright}${cat.toUpperCase()} (${categoryTools.length})${c.reset}`);
        console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);

        categoryTools.forEach(tool => {
          console.log(`  ${c.green}•${c.reset} ${c.bright}${tool.name}${c.reset}`);
          console.log(`    ${c.dim}${tool.description}${c.reset}`);
        });

        console.log('');
      }

      // Summary
      console.log(`${c.cyan}${c.bright}Summary:${c.reset}`);
      console.log(`  Total Tools: ${c.bright}${tools.length}${c.reset}`);
      console.log(`  Categories: ${c.bright}${Object.keys(categories).length}${c.reset}`);
      console.log('');

      // Commands
      console.log(`${c.blue}${c.bright}Commands:${c.reset}`);
      console.log(`  ${c.bright}neural-trader mcp tools --category <category>${c.reset}  - Filter by category`);
      console.log(`  ${c.bright}neural-trader mcp tools --search <query>${c.reset}      - Search tools`);
      console.log(`  ${c.bright}neural-trader mcp test <tool> [args]${c.reset}          - Test a tool`);
      console.log('');

    } else if (format === 'list') {
      // Simple list
      tools.forEach(tool => {
        console.log(`${c.bright}${tool.name}${c.reset} ${c.dim}(${tool.category})${c.reset}`);
      });
      console.log(`\n${c.dim}Total: ${tools.length} tools${c.reset}\n`);

    } else if (format === 'json') {
      // JSON format
      console.log(JSON.stringify(tools, null, 2));

    } else if (format === 'categories') {
      // Show categories only
      const categories = await client.getCategories();
      console.log(`${c.blue}${c.bright}Tool Categories:${c.reset}\n`);

      Object.entries(categories)
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([cat, catTools]) => {
          console.log(`  ${c.green}${cat.padEnd(20)}${c.reset} ${c.bright}${catTools.length}${c.reset} tools`);
        });

      console.log('');
    }

  } catch (error) {
    console.error(`${c.red}✗ Error listing tools:${c.reset}`);
    console.error(`  ${error.message}`);
    process.exit(1);
  }
}

module.exports = { toolsCommand };
