#!/usr/bin/env node
/**
 * FoxRuv Agent CLI - Complete Version with Smart Defaults
 *
 * Automatically uses agentic-flow + AgentDB for all operations
 * Configurable via .iris/config/settings.json
 */
import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runMcpImport } from './commands/mcp-import.js';
import { runMcpSync } from './commands/mcp-sync.js';
import { runEnhancedInit } from './commands/init-enhanced.js';
import { runMcpInstall, runMcpList } from './commands/mcp-install.js';
import { runConfigShow, runConfigWizard, runConfigToggle, runConfigReset, runConfigTopology } from './commands/execution-config.js';
import { showSmartExecutionBanner, withSmartDefaults } from './interceptor.js';
import chalk from 'chalk';
const program = new Command();
program
    .name('iris')
    .description('FoxRuv Agent Learning CLI - Self-improving MCP platform with agentic-flow + AgentDB')
    .version('0.6.0')
    .hook('preAction', async () => {
    // Show smart execution banner if enabled
    await showSmartExecutionBanner();
});
// ============================================================================
// INIT Commands
// ============================================================================
program
    .command('init')
    .description('Initialize FoxRuv agent infrastructure')
    .option('--enhanced', 'Create .iris folder + context-aware CLAUDE.md (recommended)')
    .option('--force', 'Force overwrite existing files')
    .option('--no-claude-md', 'Skip CLAUDE.md generation')
    .option('--no-skills', 'Skip mcp-skills directory creation')
    .option('--no-contexts', 'Skip context-aware CLAUDE.md files')
    .option('--enable-agentdb', 'Enable AgentDB tracking', true)
    .option('--enable-supabase', 'Enable Supabase integration', false)
    .option('--install-defaults', 'Install recommended MCPs')
    .action(withSmartDefaults(async (options) => {
    console.log(chalk.blue('\n🦊 Initializing FoxRuv Agent Learning infrastructure...\n'));
    if (options.enhanced) {
        await runEnhancedInit(process.cwd(), {
            createFoxruvFolder: true,
            createContexts: !options.contexts,
            installDefaultMcps: options.installDefaults,
            enableAgentDB: options.enableAgentdb,
            enableSupabase: options.enableSupabase
        });
    }
    else {
        await runInit(process.cwd(), options);
    }
    console.log(chalk.green('\n✅ Initialization complete!\n'));
    console.log(chalk.blue('💡 Tip: Run with --enhanced for full features:\n'));
    console.log(chalk.cyan('   npx iris init --enhanced\n'));
}));
// ============================================================================
// CONFIG Commands - Smart Defaults Management
// ============================================================================
const configCommand = program
    .command('config')
    .description('Manage execution configuration (agentic-flow + AgentDB defaults)');
configCommand
    .command('show')
    .description('Show current execution configuration')
    .action(async () => {
    try {
        await runConfigShow();
    }
    catch (error) {
        console.error(chalk.red('\n❌ Failed to show config:'), error);
        process.exit(1);
    }
});
configCommand
    .command('wizard')
    .alias('setup')
    .description('Interactive configuration wizard')
    .action(async () => {
    try {
        await runConfigWizard();
    }
    catch (error) {
        console.error(chalk.red('\n❌ Configuration wizard failed:'), error);
        process.exit(1);
    }
});
configCommand
    .command('toggle <setting>')
    .description('Toggle a setting on/off (agentic-flow|agentdb|learning|caching)')
    .option('--enable', 'Enable the setting')
    .option('--disable', 'Disable the setting')
    .action(async (setting, options) => {
    try {
        const enable = options.enable ? true : options.disable ? false : undefined;
        await runConfigToggle(setting, enable);
    }
    catch (error) {
        console.error(chalk.red('\n❌ Toggle failed:'), error);
        process.exit(1);
    }
});
configCommand
    .command('topology <type>')
    .description('Set swarm topology (mesh|hierarchical|ring|star)')
    .action(async (type) => {
    try {
        await runConfigTopology(type);
    }
    catch (error) {
        console.error(chalk.red('\n❌ Failed to set topology:'), error);
        process.exit(1);
    }
});
configCommand
    .command('reset')
    .description('Reset all settings to defaults')
    .action(async () => {
    try {
        await runConfigReset();
    }
    catch (error) {
        console.error(chalk.red('\n❌ Reset failed:'), error);
        process.exit(1);
    }
});
// ============================================================================
// MCP Commands
// ============================================================================
const mcpCommand = program
    .command('mcp')
    .description('MCP server and skill management');
mcpCommand
    .command('list')
    .description('List available MCP servers from registry')
    .option('--category <category>', 'Filter by category (payments|database|communication|development)')
    .option('--search <term>', 'Search MCPs by name or description')
    .action(withSmartDefaults(async (options) => {
    try {
        await runMcpList(options);
    }
    catch (error) {
        console.error(chalk.red('\n❌ List failed:'), error);
        process.exit(1);
    }
}));
mcpCommand
    .command('install <mcp-id>')
    .description('Install MCP server (auto-generates skills + TypeScript wrappers)')
    .option('--yes', 'Skip confirmation prompts')
    .option('--skip-wrappers', 'Skip TypeScript wrapper generation')
    .option('--skip-skills', 'Skip skill documentation generation')
    .action(withSmartDefaults(async (mcpId, options) => {
    try {
        console.log(chalk.blue(`\n🔧 Installing ${mcpId}...\n`));
        await runMcpInstall(mcpId, options);
    }
    catch (error) {
        console.error(chalk.red('\n❌ Installation failed:'), error);
        process.exit(1);
    }
}));
mcpCommand
    .command('import')
    .description('Import MCPs from Claude global settings into project skills')
    .option('--backup', 'Backup Claude settings before modification', true)
    .option('--disable-global', 'Disable global MCPs after import', false)
    .option('--dry-run', 'Show what would be imported without making changes')
    .action(withSmartDefaults(async (options) => {
    try {
        console.log(chalk.blue('\n🔄 Importing MCPs from Claude settings...\n'));
        await runMcpImport(process.cwd(), options);
        console.log(chalk.green('\n✅ MCP import complete!\n'));
    }
    catch (error) {
        console.error(chalk.red('\n❌ Import failed:'), error);
        process.exit(1);
    }
}));
mcpCommand
    .command('sync-index')
    .alias('sync')
    .description('Synchronize mcp-skills/INDEX.md with actual skill files')
    .action(withSmartDefaults(async () => {
    try {
        console.log(chalk.blue('\n🔄 Synchronizing skill index...\n'));
        await runMcpSync(process.cwd());
        console.log(chalk.green('\n✅ Index synchronized!\n'));
    }
    catch (error) {
        console.error(chalk.red('\n❌ Sync failed:'), error);
        process.exit(1);
    }
}));
// ============================================================================
// PARSE & HELP
// ============================================================================
program.parse(process.argv);
// Show help if no command provided
if (!process.argv.slice(2).length) {
    console.log(chalk.blue('\n🦊 FoxRuv Agent - Self-Improving MCP Platform\n'));
    console.log(chalk.yellow('💡 Smart Defaults Enabled:\n'));
    console.log(chalk.gray('   ✓ agentic-flow for all operations (configurable)'));
    console.log(chalk.gray('   ✓ AgentDB tracking automatically'));
    console.log(chalk.gray('   ✓ Learning from every execution\n'));
    program.outputHelp();
}
