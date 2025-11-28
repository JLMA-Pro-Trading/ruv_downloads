/**
 * MCP Test Command
 * Test an MCP tool
 */

const { McpClient } = require('../../lib/mcp-client');

const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

async function testCommand(toolName, args = {}) {
  if (!toolName) {
    console.error(`${c.red}✗ Tool name required${c.reset}`);
    console.error(`  Usage: neural-trader mcp test <tool> [args]`);
    console.error(`  Example: neural-trader mcp test ping`);
    process.exit(1);
  }

  const client = new McpClient();

  console.log(`${c.blue}${c.bright}Testing Tool: ${toolName}${c.reset}\n`);

  try {
    // Get tool definition
    const tool = await client.getTool(toolName);

    console.log(`${c.cyan}Tool Information:${c.reset}`);
    console.log(`  Name: ${c.bright}${tool.name}${c.reset}`);
    console.log(`  Category: ${c.bright}${tool.category}${c.reset}`);
    console.log(`  Description: ${c.dim}${tool.description}${c.reset}`);
    console.log('');

    // Show schema
    if (tool.inputSchema.properties) {
      console.log(`${c.cyan}Parameters:${c.reset}`);
      for (const [prop, def] of Object.entries(tool.inputSchema.properties)) {
        const required = tool.inputSchema.required?.includes(prop) ? `${c.red}*${c.reset}` : ' ';
        console.log(`  ${required} ${c.bright}${prop}${c.reset} (${def.type})`);
        if (def.description) {
          console.log(`    ${c.dim}${def.description}${c.reset}`);
        }
        if (def.enum) {
          console.log(`    ${c.dim}Values: ${def.enum.join(', ')}${c.reset}`);
        }
      }
      console.log('');
    }

    // Parse arguments
    let parsedArgs = {};
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (error) {
        console.error(`${c.red}✗ Invalid JSON arguments${c.reset}`);
        console.error(`  Use: neural-trader mcp test ${toolName} '{"key": "value"}'`);
        process.exit(1);
      }
    } else {
      parsedArgs = args;
    }

    // Show what we're testing with
    if (Object.keys(parsedArgs).length > 0) {
      console.log(`${c.cyan}Test Arguments:${c.reset}`);
      console.log(JSON.stringify(parsedArgs, null, 2));
      console.log('');
    }

    // Test the tool
    console.log(`${c.blue}Running test...${c.reset}\n`);

    const result = await client.testTool(toolName, parsedArgs);

    if (result.success) {
      console.log(`${c.green}✓ Test completed successfully${c.reset}\n`);
      console.log(`${c.cyan}Result:${c.reset}`);
      console.log(JSON.stringify(result.result, null, 2));
      console.log('');
    } else {
      console.log(`${c.red}✗ Test failed${c.reset}\n`);
      console.log(`${c.red}Error:${c.reset}`);
      console.log(JSON.stringify(result.error, null, 2));
      console.log('');
      process.exit(1);
    }

  } catch (error) {
    console.error(`${c.red}✗ Test error:${c.reset}`);
    console.error(`  ${error.message}`);
    console.error('');

    if (error.message.includes('Tool not found')) {
      console.log(`${c.yellow}Tip: Use 'neural-trader mcp tools' to see available tools${c.reset}`);
    } else if (error.message.includes('Invalid arguments')) {
      console.log(`${c.yellow}Tip: Check the tool's parameter requirements${c.reset}`);
    }

    process.exit(1);
  }
}

module.exports = { testCommand };
