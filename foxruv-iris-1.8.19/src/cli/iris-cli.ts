#!/usr/bin/env node
/**
 * @foxruv/iris - Iris CLI
 *
 * Unified CLI for MCP orchestration, swarm intelligence, and agent learning
 * Consolidates: MCP management, evaluation, council, federated learning
 */

// CRITICAL: Set MCP mode and suppress stdout BEFORE any imports if running as MCP server
// MCP protocol requires clean stdout - any pollution breaks the JSON-RPC protocol
const isMcpServer = process.argv.includes('mcp:server') || process.argv.includes('serve');
if (isMcpServer) {
  process.env.IRIS_MCP_MODE = 'true';
  // Suppress ALL stdout during module loading - MCP needs clean stdout
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    // Only allow through if it's JSON (MCP protocol)
    if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('{')) {
      originalLog(...args);
    }
    // Otherwise suppress
  };
}

import { Command } from 'commander';
import { runInit } from './commands/init.js';
import { runMcpImport } from './commands/mcp-import.js';
import { runMcpSync } from './commands/mcp-sync.js';
import { runEnhancedInit } from './commands/init-enhanced.js';
import { runMcpInstall, runMcpList } from './commands/mcp-install.js';
import { runConfigShow, runConfigWizard, runConfigToggle, runConfigReset, runConfigTopology } from './commands/execution-config.js';
import { loginCommand, logoutCommand, statusCommand } from './commands/auth-login.js';
import { runTelemetryMigrate, runTelemetrySync, runTelemetryStatus } from './commands/telemetry.js';
import { showSmartExecutionBanner } from './interceptor.js';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();

program
  .name('iris')
  .description('Iris - Self-improving MCP orchestration with agent vision and swarm intelligence')
  .version('1.0.0')
  .hook('preAction', async (thisCommand) => {
    // Skip banner for MCP server (needs clean stdout for protocol)
    const commandName = thisCommand.name();
    if (commandName === 'mcp:server' || commandName === 'serve') {
      return;
    }
    // Show smart execution banner if enabled
    await showSmartExecutionBanner();
  })
  .hook('postAction', async (thisCommand) => {
    // Skip forced exit for MCP server (it needs to stay running)
    const commandName = thisCommand.name();
    if (commandName === 'mcp:server' || commandName === 'serve') {
      return;
    }
    // Force exit after command completes to avoid lingering DB connections
    setTimeout(() => process.exit(0), 100);
  });

program
  .command('init')
  .description('Initialize FoxRuv agent infrastructure in current project')
  .option('--enhanced', 'Create .iris folder and context-aware CLAUDE.md files')
  .option('--force', 'Force overwrite existing files')
  .option('--no-claude-md', 'Skip CLAUDE.md generation')
  .option('--no-skills', 'Skip mcp-skills directory creation')
  .option('--no-contexts', 'Skip context detection and creation')
  .option('--no-claude', 'Skip Claude Code targeting (CLAUDE.md)')
  .option('--no-gemini', 'Skip Gemini targeting (GEMINI.md)')
  .option('--enable-agentdb', 'Enable AgentDB tracking (default: true)')
  .option('--enable-supabase', 'Enable Supabase integration (default: false)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🌈 Initializing Iris platform infrastructure...\n'));

      if (options.enhanced) {
        await runEnhancedInit(process.cwd(), {
          ...options,
          createClaudeContexts: options.claude, // Commander handles --no-claude -> options.claude = false
          createGeminiMd: options.gemini        // Commander handles --no-gemini -> options.gemini = false
        });
      } else {
        await runInit(process.cwd(), options);
      }

      console.log(chalk.green('\n✅ Initialization complete!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed:'), error);
      process.exit(1);
    }
  });

// MCP Management Commands
const mcpCommand = program
  .command('mcp')
  .description('MCP skill management commands');

mcpCommand
  .command('list')
  .description('List available MCP servers from registry')
  .option('--category <category>', 'Filter by category')
  .option('--search <term>', 'Search MCPs by name or description')
  .action(async (options) => {
    try {
      await runMcpList(options);
    } catch (error) {
      console.error(chalk.red('\n❌ List failed:'), error);
      process.exit(1);
    }
  });

mcpCommand
  .command('install <mcp-id>')
  .description('Install MCP server and generate skill files + wrappers')
  .option('--yes', 'Skip confirmation prompts')
  .option('--skip-wrappers', 'Skip TypeScript wrapper generation')
  .option('--skip-skills', 'Skip skill documentation generation')
  .action(async (mcpId, options) => {
    try {
      await runMcpInstall(mcpId, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Installation failed:'), error);
      process.exit(1);
    }
  });

mcpCommand
  .command('import')
  .description('Import MCPs from Claude global settings into project skills')
  .option('--backup', 'Backup Claude settings before modification', true)
  .option('--disable-global', 'Disable global MCPs after import', false)
  .option('--dry-run', 'Show what would be imported without making changes')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n🔄 Importing MCPs from Claude settings...\n'));
      await runMcpImport(process.cwd(), options);
      console.log(chalk.green('\n✅ MCP import complete!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Import failed:'), error);
      process.exit(1);
    }
  });

mcpCommand
  .command('sync-index')
  .alias('sync')
  .description('Synchronize mcp-skills/INDEX.md with actual skill files')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🔄 Synchronizing skill index...\n'));
      await runMcpSync(process.cwd());
      console.log(chalk.green('\n✅ Index synchronized!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Sync failed:'), error);
      process.exit(1);
    }
  });

// MCP Context management (Claude Code integration)
const contextCommand = mcpCommand
  .command('context')
  .description('Manage MCP context usage in Claude Code');

contextCommand
  .command('list')
  .alias('ls')
  .description('List MCPs and their enabled/disabled status')
  .action(async () => {
    try {
      const { runMcpContextList } = await import('./commands/mcp-context.js');
      await runMcpContextList();
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

contextCommand
  .command('disable <mcps...>')
  .description('Disable MCPs to reduce context token usage')
  .action(async (mcpIds: string[]) => {
    try {
      const { runMcpContextDisable } = await import('./commands/mcp-context.js');
      await runMcpContextDisable(mcpIds);
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

contextCommand
  .command('enable <mcps...>')
  .description('Re-enable disabled MCPs')
  .action(async (mcpIds: string[]) => {
    try {
      const { runMcpContextEnable } = await import('./commands/mcp-context.js');
      await runMcpContextEnable(mcpIds);
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

contextCommand
  .command('optimize')
  .description('Interactively optimize MCP context usage')
  .option('--keep <mcps...>', 'MCPs to keep enabled')
  .option('--non-interactive', 'Disable all except --keep without prompts')
  .action(async (options) => {
    try {
      const { runMcpContextOptimize } = await import('./commands/mcp-context.js');
      await runMcpContextOptimize({
        keepEnabled: options.keep,
        interactive: !options.nonInteractive
      });
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

contextCommand
  .command('summary')
  .description('Show MCP context usage across all projects')
  .action(async () => {
    try {
      const { runMcpContextSummary } = await import('./commands/mcp-context.js');
      await runMcpContextSummary();
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

// MCP Scan - Extract tool schemas from MCPs
mcpCommand
  .command('scan')
  .description('Scan MCPs and generate skill documentation from their tools')
  .option('--mcps <ids...>', 'Specific MCPs to scan')
  .option('--output <dir>', 'Output directory for skill files')
  .option('--skip-disabled', 'Skip scanning disabled MCPs')
  .action(async (options) => {
    try {
      const { runMcpScan } = await import('./commands/mcp-scan.js');
      await runMcpScan({
        mcpIds: options.mcps,
        output: options.output,
        skipDisabled: options.skipDisabled
      });
    } catch (error) {
      console.error(chalk.red('\n❌ Scan failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// CONFIG Commands - Smart Defaults
// ============================================================================

const configCommand = program
  .command('config')
  .description('Manage execution configuration (agentic-flow + AgentDB smart defaults)');

configCommand
  .command('show')
  .description('Show current execution configuration')
  .action(async () => {
    try {
      await runConfigShow();
    } catch (error) {
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
    } catch (error) {
      console.error(chalk.red('\n❌ Configuration wizard failed:'), error);
      process.exit(1);
    }
  });

configCommand
  .command('toggle <setting>')
  .description('Toggle setting on/off (agentic-flow|agentdb|learning|caching)')
  .option('--enable', 'Enable the setting')
  .option('--disable', 'Disable the setting')
  .action(async (setting, options) => {
    try {
      const enable = options.enable ? true : options.disable ? false : undefined;
      await runConfigToggle(setting as any, enable);
    } catch (error) {
      console.error(chalk.red('\n❌ Toggle failed:'), error);
      process.exit(1);
    }
  });

configCommand
  .command('topology <type>')
  .description('Set swarm topology (mesh|hierarchical|ring|star)')
  .action(async (type) => {
    try {
      await runConfigTopology(type as any);
    } catch (error) {
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
    } catch (error) {
      console.error(chalk.red('\n❌ Reset failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// PROMPT BOOST Commands - Auto-inject agentic-flow + AgentDB
// ============================================================================

const promptBoostCommand = program
  .command('prompt-boost')
  .alias('boost')
  .description('Manage prompt injection (auto-add "agentic-flow AND AgentDB")');

promptBoostCommand
  .command('status')
  .description('Show prompt boost status')
  .action(async () => {
    try {
      const { runPromptBoostStatus } = await import('./commands/prompt-boost.js');
      await runPromptBoostStatus(process.cwd());
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

promptBoostCommand
  .command('on')
  .description('Enable prompt boost (auto-inject agentic-flow AND AgentDB)')
  .action(async () => {
    try {
      const { runPromptBoostOn } = await import('./commands/prompt-boost.js');
      await runPromptBoostOn(process.cwd());
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

promptBoostCommand
  .command('off')
  .description('Disable prompt boost')
  .action(async () => {
    try {
      const { runPromptBoostOff } = await import('./commands/prompt-boost.js');
      await runPromptBoostOff(process.cwd());
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

promptBoostCommand
  .command('shadow <on|off>')
  .description('Enable/disable shadow mode (experimental prompt improvement)')
  .action(async (state) => {
    try {
      const { runPromptBoostShadow } = await import('./commands/prompt-boost.js');
      await runPromptBoostShadow(process.cwd(), state === 'on');
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

promptBoostCommand
  .command('model <name>')
  .description('Configure local model for shadow mode')
  .option('--endpoint <url>', 'Model endpoint (e.g., http://192.168.1.100:1234)')
  .option('--type <type>', 'Model type: lmstudio, ollama, vllm', 'lmstudio')
  .action(async (name, options) => {
    try {
      const { runPromptBoostSetModel } = await import('./commands/prompt-boost.js');
      await runPromptBoostSetModel(process.cwd(), name, options);
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

promptBoostCommand
  .command('review')
  .description('Review shadow mode experiments (compare original vs improved)')
  .action(async () => {
    try {
      const { runPromptBoostReview } = await import('./commands/prompt-boost.js');
      await runPromptBoostReview(process.cwd());
    } catch (error) {
      console.error(chalk.red('\n❌ Failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// AUTO-OPTIMIZE Commands - Self-improving AI
// ============================================================================

program
  .command('auto-check')
  .description('Check if any AI functions need optimization')
  .option('--target <target>', 'Check specific target only')
  .option('--quiet', 'Only output if trigger found')
  .option('--execute', 'Auto-execute optimization if triggered')
  .action(async (options) => {
    try {
      const { runAutoTriggerCheck } = await import('../auto-optimize/auto-trigger.js');
      await runAutoTriggerCheck(process.cwd(), {
        autoExecute: options.execute,
        verbose: !options.quiet
      });
    } catch (error) {
      if (!options.quiet) {
        console.error(chalk.red('\n❌ Auto-check failed:'), error);
      }
      process.exit(1);
    }
  });

program
  .command('track <action>')
  .description('Track AI function performance (record, status, clear)')
  .option('--target <target>', 'Target function/file')
  .option('--success <bool>', 'Record success/failure')
  .option('--tool <tool>', 'Tool that was used')
  .action(async (action, options) => {
    try {
      if (action === 'record') {
        const { recordTelemetry } = await import('../auto-optimize/auto-trigger.js');
        recordTelemetry(process.cwd(), {
          target: options.target || 'unknown',
          success: options.success !== 'false',
          latencyMs: 0
        });
        console.log(chalk.green('✓ Performance recorded'));
      } else if (action === 'status') {
        const { getAllTargets, getTelemetryForTarget, calculateMetrics } = await import('../auto-optimize/auto-trigger.js');
        const targets = getAllTargets(process.cwd());
        
        if (targets.length === 0) {
          console.log(chalk.yellow('\n📭 No performance data yet.'));
          console.log(chalk.gray('   Use AI functions with Iris instrumentation to collect data.'));
          return;
        }
        
        console.log(chalk.cyan(`\n📊 Performance Tracking (${targets.length} targets)\n`));
        
        for (const target of targets) {
          const records = getTelemetryForTarget(process.cwd(), target);
          const metrics = calculateMetrics(records);
          
          const successColor = metrics.successRate >= 0.7 ? chalk.green : chalk.red;
          const trendIcon = metrics.recentTrend === 'improving' ? '↑' : metrics.recentTrend === 'degrading' ? '↓' : '→';
          
          console.log(`  ${chalk.bold(target)}`);
          console.log(`    Calls: ${metrics.callCount} | Success: ${successColor((metrics.successRate * 100).toFixed(1) + '%')} | Latency: ${metrics.avgLatency.toFixed(0)}ms | Trend: ${trendIcon}`);
        }
        console.log('');
      } else if (action === 'clear') {
        const fs = await import('fs');
        const telemetryFile = '.iris/telemetry/calls.json';
        if (fs.existsSync(telemetryFile)) {
          fs.unlinkSync(telemetryFile);
          console.log(chalk.green('✓ Performance data cleared'));
        } else {
          console.log(chalk.yellow('No data to clear'));
        }
      } else {
        console.log(chalk.yellow(`Unknown action: ${action}`));
        console.log(chalk.gray('Available: record, status, clear'));
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Track command failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// IRIS PRIME Commands - Core Intelligence Features
// ============================================================================

program
  .command('discover [path]')
  .description('Discover and instrument expert agents in project')
  .option('--project <path>', 'Project path (alternative to positional arg)')
  .option('--dry-run', 'Show what would be discovered without changes')
  .option('--deep', 'Deep scan (check all subdirectories)')
  .action(async (pathArg, options) => {
    try {
      // Support both positional arg and --project option
      const projectPath = pathArg || options.project || '.';
      
      console.log(chalk.blue(`\n🔍 Iris Discovery - Scanning ${projectPath}...\n`));

      // Dynamic import to avoid loading at startup
      const { default: discover } = await import('../scripts/iris/iris-discover.js');
      await discover({ ...options, project: projectPath });
    } catch (error) {
      console.error(chalk.red('\n❌ Discovery failed:'), error);
      process.exit(1);
    }
  });

program
  .command('evaluate')
  .description('Evaluate project health and expert performance')
  .option('--project <name>', 'Project name', 'current')
  .option('--output-json <file>', 'Output report as JSON')
  .option('--auto-retrain', 'Auto-retrain if drift detected')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n📊 Iris Evaluation - Analyzing project health...\n'));

      const { default: evaluate } = await import('../scripts/iris/iris-evaluate.js');
      await evaluate(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Evaluation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('patterns')
  .description('Discover patterns across all projects')
  .option('--source <project>', 'Source project')
  .option('--target <project>', 'Target project')
  .action(async (options) => {
    try {
      const { default: patterns } = await import('../scripts/iris/iris-patterns.js');
      await patterns(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Pattern discovery failed:'), error);
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Quick health check for current project')
  .option('--detailed', 'Show detailed health information')
  .option('--project <name>', 'Project name (auto-detected from .iris/config.yaml or directory name)')
  .action(async (options) => {
    try {
      // Auto-detect project name
      let projectName = options.project;
      
      if (!projectName) {
        // Try to read from .iris/config.yaml
        const configPath = path.join(process.cwd(), '.iris', 'config.yaml');
        if (fs.existsSync(configPath)) {
          const yaml = await import('js-yaml');
          const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
          projectName = config?.project?.name || config?.projectId;
        }
        
        // Fallback to directory name
        if (!projectName) {
          projectName = path.basename(process.cwd());
        }
      }
      
      console.log(chalk.blue(`\n🏥 Health check for project: ${projectName}\n`));
      
      // Check basic health without full evaluate
      const checks = {
        irisFolder: fs.existsSync('.iris'),
        configExists: fs.existsSync('.iris/config.yaml'),
        agentDbExists: fs.existsSync('.iris/agentdb'),
        learningExists: fs.existsSync('.iris/learning'),
      };
      
      console.log('📁 Iris Infrastructure:');
      console.log(`   .iris/ folder: ${checks.irisFolder ? chalk.green('✓') : chalk.red('✗')} ${checks.irisFolder ? '' : '(run: npx iris init)'}`);
      console.log(`   config.yaml: ${checks.configExists ? chalk.green('✓') : chalk.yellow('○')} ${checks.configExists ? '' : '(optional)'}`);
      console.log(`   agentdb/: ${checks.agentDbExists ? chalk.green('✓') : chalk.yellow('○')} ${checks.agentDbExists ? '' : '(created on first use)'}`);
      console.log(`   learning/: ${checks.learningExists ? chalk.green('✓') : chalk.yellow('○')} ${checks.learningExists ? '' : '(created on first use)'}`);
      
      // Check dependencies
      console.log('\n📦 Dependencies:');
      try {
        const { execSync } = await import('child_process');
        
        let hasTsDspy = false;
        let hasPyDspy = false;
        let hasAx = false;
        
        // Check ts-dspy (TypeScript DSPy)
        try {
          execSync('npm ls @ts-dspy/core', { stdio: 'ignore' });
          hasTsDspy = true;
          console.log(`   @ts-dspy/core: ${chalk.green('✓ installed')} (TypeScript prompt optimization)`);
        } catch {
          console.log(`   @ts-dspy/core: ${chalk.yellow('○ not installed')}`);
        }
        
        // Check Python DSPy
        try {
          execSync('python3 -c "import dspy"', { stdio: 'ignore' });
          hasPyDspy = true;
          console.log(`   dspy-ai (Python): ${chalk.green('✓ installed')} (Python prompt optimization)`);
        } catch {
          console.log(`   dspy-ai (Python): ${chalk.yellow('○ not installed')}`);
        }
        
        // Check Ax
        try {
          execSync('python3 -c "import ax"', { stdio: 'ignore' });
          hasAx = true;
          console.log(`   ax-platform: ${chalk.green('✓ installed')} (Bayesian hyperparameter tuning)`);
        } catch {
          console.log(`   ax-platform: ${chalk.yellow('○ not installed')}`);
        }
        
        // Show DSPy recommendation
        if (!hasTsDspy && !hasPyDspy) {
          console.log(chalk.yellow('\n   💡 For prompt optimization, install one of:'));
          console.log(chalk.gray('      npm install @ts-dspy/core  (TypeScript - no Python needed)'));
          console.log(chalk.gray('      pip install dspy-ai        (Python - more features)'));
        } else if (hasTsDspy && !hasPyDspy) {
          console.log(chalk.gray('\n   ℹ️  Using TypeScript DSPy for prompt optimization'));
        } else if (!hasTsDspy && hasPyDspy) {
          console.log(chalk.gray('\n   ℹ️  Using Python DSPy for prompt optimization'));
        } else {
          console.log(chalk.gray('\n   ℹ️  Both TypeScript and Python DSPy available'));
        }
        
        if (!hasAx) {
          console.log(chalk.yellow('   💡 For Bayesian optimization: pip install ax-platform'));
        }
        
      } catch (e) {
        console.log(`   ${chalk.yellow('Could not check dependencies')}`);
      }
      
      console.log(chalk.green('\n✅ Health check complete\n'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Health check failed:'), error);
      process.exit(1);
    }
  });

program
  .command('instrument')
  .description('Guide on how to add AgentDB telemetry to AI functions')
  .option('--project <path>', 'Project path (defaults to current)', '.')
  .action(async (options) => {
    try {
      console.log(chalk.blue('\n📊 Iris Telemetry Instrumentation Guide...\n'));
      const { default: instrument } = await import('../scripts/iris/iris-instrument.js');
      await instrument(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Instrumentation guide failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// FEDERATED Commands
// ============================================================================

const federatedCommand = program
  .command('federated')
  .description('Federated learning control plane');

federatedCommand
  .command('sync')
  .description('Sync local learning to Supabase (Federation)')
  .option('--project <name>', 'Project identifier')
  .action(async (options) => {
    try {
      const { default: sync } = await import('../scripts/federated/iris-federated-sync.js');
      await sync(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Sync failed:'), error);
      process.exit(1);
    }
  });

federatedCommand
  .command('start')
  .description('Start federated control plane')
  .action(async () => {
    try {
      console.log(chalk.blue('\n🌐 Starting Federated Control Plane...\n'));
      await import('../federated/FederatedControlPlane.js');
      console.log('Federated control plane ready. Implementation pending...');
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to start:'), error);
      process.exit(1);
    }
  });

federatedCommand
  .command('status')
  .description('Check federated control plane status')
  .action(async () => {
    console.log('Federated status check...');
  });

// ============================================================================
// COUNCIL Commands
// ============================================================================

const councilCommand = program
  .command('council')
  .description('AI Council operations');

councilCommand
  .command('analyze')
  .description('Run AI Council analysis')
  .action(async (options) => {
    try {
      const { default: analyze } = await import('../scripts/iris/iris-council.js');
      await analyze(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Analysis failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// AUTHENTICATION Commands
// ============================================================================

program
  .command('login')
  .description('Login to IRIS managed service')
  .option('--key <api-key>', 'Login with API key directly')
  .option('--email <email>', 'Email for login')
  .option('--register', 'Register new account')
  .action(async (options) => {
    try {
      await loginCommand(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Login failed:'), error);
      process.exit(1);
    }
  });

program
  .command('logout')
  .description('Logout and clear stored credentials')
  .action(async () => {
    try {
      await logoutCommand();
    } catch (error) {
      console.error(chalk.red('\n❌ Logout failed:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .alias('auth')
  .description('Show authentication status')
  .action(async () => {
    try {
      await statusCommand();
    } catch (error) {
      console.error(chalk.red('\n❌ Status check failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// OPTIMIZATION Commands
// ============================================================================

program
  .command('optimize')
  .description('Run hyperparameter optimization')
  .option('--config <path>', 'Path to iris-config.yaml')
  .option('--target <script>', 'Path to script exporting evaluate()')
  .option('--trials <number>', 'Number of trials to run')
  .action(async (options) => {
    try {
      const { default: optimize } = await import('../scripts/iris/iris-optimize.js');
      await optimize(options);
    } catch (error) {
      console.error(chalk.red('\n❌ Optimization command failed:'), error);
      process.exit(1);
    }
  });

program
  .command('evolve')
  .description('Evolve expert prompts using Hybrid Breeding (Local Mutation + Cloud Evaluation)')
  .requiredOption('--expert <type>', 'Expert type to evolve (e.g., "typescript-expert")')
  .option('--population <size>', 'Population size', '10')
  .option('--generations <count>', 'Number of generations', '5')
  .option('--mutation-rate <rate>', 'Mutation rate (0.0-1.0)', '0.3')
  .option('--model-local <id>', 'Local LLM model ID for mutation', 'qwen3-coder-30b-a3b-instruct-mlx')
  .option('--endpoint-local <url>', 'Local LLM endpoint', 'http://192.168.254.246:1234')
  .action(async (options) => {
    try {
      console.log(chalk.blue(`\n🧬 Starting Hybrid Evolution for expert: ${chalk.bold(options.expert)}\n`));
      
      const { createPromptBreeder } = await import('../evolution/prompt-breeder.js');
      
      const breeder = createPromptBreeder({
        populationSize: parseInt(options.population, 10),
        generations: parseInt(options.generations, 10),
        mutationRate: parseFloat(options.mutationRate),
        llmModel: options.modelLocal,
        llmEndpoint: options.endpointLocal,
        projects: ['current-project'], // Default to current context
        useSupabase: true
      });

      // Seed with a basic prompt if none exists (in production, fetch from registry)
      const seedPrompts = [
        `You are an expert ${options.expert}. Your goal is to provide high-quality, accurate, and actionable outputs.`,
        `As a specialist in ${options.expert}, you prioritize precision, clarity, and user alignment.`
      ];

      console.log(chalk.gray(`   Population: ${options.population}, Generations: ${options.generations}`));
      console.log(chalk.gray(`   Mutation Model: ${options.modelLocal}`));
      console.log(chalk.gray(`   Evaluation: Claude 4.5 (if API key present)\n`));

      const result = await breeder.evolve(options.expert, seedPrompts);

      // Enhanced summary output
      console.log('\n' + '='.repeat(80));
      console.log(chalk.green.bold('\n📊 EVOLUTION SUMMARY'));
      console.log('-'.repeat(80));
      
      console.log(chalk.bold('\n  🧬 Expert Type:'), chalk.cyan(options.expert));
      console.log(chalk.bold('  🎯 Best Fitness:'), chalk.green.bold(result.bestPrompt.fitness.toFixed(4)));
      
      console.log(chalk.bold('\n  📈 Evolution Statistics:'));
      console.log(`       Generations: ${chalk.yellow(options.generations)}`);
      console.log(`       Population Size: ${chalk.yellow(options.population)}`);
      console.log(`       Mutation Rate: ${chalk.yellow(options.mutationRate)}`);
      console.log(`       Mutation Model: ${chalk.blue(options.modelLocal)}`);
      
      console.log(chalk.bold('\n  🏆 Winning Prompt:'));
      console.log(chalk.cyan('  ' + '-'.repeat(76)));
      // Indent the prompt for readability
      const promptLines = result.bestPrompt.prompt.split('\n');
      for (const line of promptLines) {
        console.log(chalk.white('    ' + line));
      }
      console.log(chalk.cyan('  ' + '-'.repeat(76)));
      
      console.log('\n' + '='.repeat(80));
      console.log(chalk.green('\n✅ Evolution complete! The winning prompt has been saved.\n'));
      
      breeder.close();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('\n❌ Evolution failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// TELEMETRY Commands - Dual-Lane Telemetry Management
// ============================================================================

const telemetryCommand = program
  .command('telemetry')
  .description('Telemetry management (AgentDB + Supabase dual-lane)');

telemetryCommand
  .command('migrate')
  .description('Migrate historical data from AgentDB to Supabase')
  .option('--db-path <path>', 'Path to AgentDB database file')
  .option('--project-id <id>', 'Project identifier for Supabase')
  .option('--dry-run', 'Show what would be migrated without making changes')
  .option('--batch-size <size>', 'Number of records to process per batch', '100')
  .action(async (options) => {
    try {
      await runTelemetryMigrate({
        agentDbPath: options.dbPath,
        projectId: options.projectId,
        dryRun: options.dryRun,
        batchSize: options.batchSize ? parseInt(options.batchSize, 10) : undefined,
      });
    } catch (error) {
      console.error(chalk.red('\n--- Migration failed ---'), error);
      process.exit(1);
    }
  });

telemetryCommand
  .command('sync')
  .description('Trigger manual sync of queued telemetry events to upstream')
  .option('--force', 'Force sync even if queue is small')
  .option('--timeout <ms>', 'Timeout for sync operation in milliseconds', '60000')
  .action(async (options) => {
    try {
      const result = await runTelemetrySync({
        force: options.force,
        timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
      });
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('\n--- Sync failed ---'), error);
      process.exit(1);
    }
  });

telemetryCommand
  .command('status')
  .description('Show telemetry sync status and statistics')
  .option('--detailed', 'Show detailed status including environment variables')
  .option('--json', 'Output status as JSON')
  .action(async (options) => {
    try {
      await runTelemetryStatus({
        detailed: options.detailed,
        json: options.json,
      });
    } catch (error) {
      console.error(chalk.red('\n--- Status check failed ---'), error);
      process.exit(1);
    }
  });

// ============================================================================
// MCP SERVER Command - Start Iris as an MCP server
// ============================================================================

program
  .command('mcp:server')
  .alias('serve')
  .description('Start Iris as an MCP server (for Claude Code integration)')
  .action(async () => {
    try {
      // Import and start the MCP server
      const { startMcpServer } = await import('../mcp/iris-prime-mcp-server.js');
      await startMcpServer();
    } catch (error) {
      console.error(chalk.red('MCP server failed to start:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
