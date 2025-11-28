#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { generateCommand } from './commands/generate.js';
import { serverCommand } from './commands/server.js';
import { initCommand } from './commands/init.js';
import { importCommand } from './commands/import.js';
import { syncCommand } from './commands/sync.js';
import { healthCommand } from './commands/health.js';
import { discoverCommand } from './commands/discover.js';
import { detectMcpCommand } from './commands/detect-mcp.js';
import { autoInvokeCommand } from './commands/auto-invoke.js';
const program = new Command();
program
    .name('ultrathink')
    .description('CLI tool for ultrathink auto-skills and MCP management')
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--debug', 'Enable debug mode');
// Register commands
program.addCommand(generateCommand);
program.addCommand(serverCommand);
program.addCommand(initCommand);
program.addCommand(importCommand);
program.addCommand(syncCommand);
program.addCommand(healthCommand);
program.addCommand(discoverCommand);
program.addCommand(detectMcpCommand);
program.addCommand(autoInvokeCommand);
// Error handling
program.configureOutput({
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(chalk.red(str)),
    outputError: (str, write) => write(chalk.red(`Error: ${str}`))
});
// Parse arguments
try {
    await program.parseAsync(process.argv);
}
catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
}
// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
//# sourceMappingURL=index.js.map