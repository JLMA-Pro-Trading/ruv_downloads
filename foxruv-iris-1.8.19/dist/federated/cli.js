#!/usr/bin/env node
/**
 * FoxRUV Prime CLI
 *
 * Command-line interface for federated learning control plane:
 * - npx foxruv-prime analyze - Run AI Council analysis
 * - npx foxruv-prime decisions - View recent decisions
 * - npx foxruv-prime test-transfer - Test pattern transfer
 * - npx foxruv-prime start - Start control plane
 * - npx foxruv-prime status - View system status
 *
 * @module CLI
 */
import { Command } from 'commander';
import { FederatedControlPlane } from './FederatedControlPlane.js';
import { ScheduledJobs } from './ScheduledJobs.js';
import { VectorStore } from '../core/VectorStore.js';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
const program = new Command();
// Load configuration from environment or config file
function loadConfig() {
    return {
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_KEY || '',
        vectorStorePath: process.env.VECTOR_STORE_PATH || './data/vectors',
        intervalMinutes: parseInt(process.env.INTERVAL_MINUTES || '5'),
    };
}
// Initialize control plane
async function initControlPlane() {
    const config = loadConfig();
    if (!config.supabaseUrl || !config.supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_KEY must be set');
    }
    const vectorStore = new VectorStore({
        dimension: 1536,
        persistPath: config.vectorStorePath,
    });
    await vectorStore.initialize();
    const projectWebhooks = new Map([
        ['nfl-picks', process.env.NFL_WEBHOOK || ''],
        ['microbiome', process.env.MICROBIOME_WEBHOOK || ''],
        ['crypto-trading', process.env.CRYPTO_WEBHOOK || ''],
    ]);
    const controlPlane = new FederatedControlPlane({
        vectorStore,
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
        intervalMinutes: config.intervalMinutes,
        projectWebhooks,
        autoExecute: true,
    });
    return controlPlane;
}
// Command: analyze
program
    .command('analyze')
    .description('Run AI Council analysis on detected patterns')
    .option('-f, --force', 'Force re-analysis of all patterns')
    .action(async () => {
    const spinner = ora('Initializing control plane...').start();
    try {
        const controlPlane = await initControlPlane();
        spinner.text = 'Running AI Council analysis...';
        await controlPlane.runCycle();
        const metrics = controlPlane.getMetrics();
        spinner.succeed('Analysis complete');
        console.log('\n' + chalk.bold('Results:'));
        console.log(`  Telemetry Events: ${chalk.cyan(metrics.totalTelemetryEvents)}`);
        console.log(`  Patterns Detected: ${chalk.cyan(metrics.patternsDetected)}`);
        console.log(`  Decisions Proposed: ${chalk.cyan(metrics.decisionsProposed)}`);
        console.log(`  Decisions Approved: ${chalk.green(metrics.decisionsApproved)}`);
        console.log(`  Average Consensus: ${chalk.yellow((metrics.averageConsensus * 100).toFixed(1) + '%')}`);
    }
    catch (error) {
        spinner.fail('Analysis failed');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
});
// Command: decisions
program
    .command('decisions')
    .description('View recent AI Council decisions')
    .option('-r, --recent <n>', 'Number of recent decisions to show', '10')
    .option('-p, --project <name>', 'Filter by project')
    .action(async (options) => {
    const spinner = ora('Loading decisions...').start();
    try {
        const config = loadConfig();
        const supabase = createClient(config.supabaseUrl, config.supabaseKey);
        let query = supabase
            .from('council_decisions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(parseInt(options.recent));
        if (options.project) {
            query = query.eq('source_project', options.project);
        }
        const { data, error } = await query;
        if (error)
            throw error;
        spinner.stop();
        if (!data || data.length === 0) {
            console.log(chalk.yellow('No decisions found'));
            return;
        }
        const table = new Table({
            head: ['ID', 'Pattern', 'Status', 'Consensus', 'Votes', 'Created'],
            colWidths: [10, 30, 12, 12, 8, 20],
        });
        data.forEach(decision => {
            table.push([
                decision.id.substring(0, 8),
                decision.pattern_id.substring(0, 28) + '...',
                decision.approved ? chalk.green('Approved') : chalk.red('Rejected'),
                chalk.yellow((decision.consensus_score * 100).toFixed(1) + '%'),
                `${decision.votes_for}/${decision.votes_total}`,
                new Date(decision.created_at).toLocaleString(),
            ]);
        });
        console.log(table.toString());
    }
    catch (error) {
        spinner.fail('Failed to load decisions');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
});
// Command: test-transfer
program
    .command('test-transfer')
    .description('Test pattern transfer to target project')
    .requiredOption('-p, --pattern <id>', 'Pattern ID to test')
    .requiredOption('-t, --target <project>', 'Target project name')
    .option('--traffic <percent>', 'Traffic percentage for test', '10')
    .action(async (options) => {
    const spinner = ora('Initializing test...').start();
    try {
        const controlPlane = await initControlPlane();
        spinner.text = `Testing pattern ${options.pattern} on ${options.target}...`;
        const results = await controlPlane.testPattern(options.pattern, [options.target]);
        spinner.succeed('Test complete');
        console.log('\n' + chalk.bold('Test Results:'));
        results.forEach(result => {
            console.log(`\n  Project: ${chalk.cyan(result.project)}`);
            console.log(`  Success: ${result.success ? chalk.green('Yes') : chalk.red('No')}`);
            console.log(`  Improvement: ${chalk.yellow((result.improvement * 100).toFixed(2) + '%')}`);
            console.log(`  Duration: ${result.duration}ms`);
        });
    }
    catch (error) {
        spinner.fail('Test failed');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
});
// Command: start
program
    .command('start')
    .description('Start federated control plane with scheduled jobs')
    .option('-d, --daemon', 'Run as daemon')
    .action(async () => {
    console.log(chalk.bold.cyan('\n🦊 FoxRUV Prime - Federated Learning Control Plane\n'));
    try {
        const controlPlane = await initControlPlane();
        const scheduler = new ScheduledJobs(controlPlane, {
            intervalMinutes: loadConfig().intervalMinutes,
            enabled: true,
            maxRetries: 3,
            retryDelaySeconds: 30,
        });
        // Event handlers
        scheduler.on('started', (data) => {
            console.log(chalk.green('✓ Scheduler started'));
            console.log(`  Interval: ${data.interval / 60000} minutes`);
            console.log(`  Next run: ${data.nextRun.toLocaleString()}`);
        });
        scheduler.on('job:start', (execution) => {
            console.log(chalk.cyan(`\n→ Job ${execution.id} started`));
        });
        scheduler.on('job:complete', (execution) => {
            console.log(chalk.green(`✓ Job ${execution.id} completed in ${execution.duration}ms`));
            if (execution.metrics) {
                console.log(`  Patterns: ${execution.metrics.patternsDetected}`);
                console.log(`  Decisions: ${execution.metrics.decisionsApproved}/${execution.metrics.decisionsProposed}`);
            }
        });
        scheduler.on('job:error', ({ execution, error }) => {
            console.log(chalk.red(`✗ Job ${execution.id} failed: ${error.message}`));
        });
        scheduler.on('job:retry', ({ execution, retryCount, maxRetries }) => {
            console.log(chalk.yellow(`↻ Job ${execution.id} retrying (${retryCount}/${maxRetries})`));
        });
        scheduler.start();
        // Keep process running
        process.on('SIGINT', () => {
            console.log(chalk.yellow('\n\nShutting down...'));
            scheduler.stop();
            process.exit(0);
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Failed to start control plane:'), message);
        process.exit(1);
    }
});
// Command: status
program
    .command('status')
    .description('View control plane status and metrics')
    .action(async () => {
    const spinner = ora('Loading status...').start();
    try {
        const controlPlane = await initControlPlane();
        const metrics = controlPlane.getMetrics();
        const health = await controlPlane.getHealth();
        spinner.stop();
        console.log(chalk.bold.cyan('\n🦊 FoxRUV Prime Status\n'));
        // Health status
        const statusColor = health.status === 'healthy' ? chalk.green :
            health.status === 'degraded' ? chalk.yellow : chalk.red;
        console.log(`Status: ${statusColor(health.status.toUpperCase())}`);
        console.log(`Last Cycle: ${chalk.cyan(health.lastCycle.toLocaleString())}\n`);
        // Metrics
        console.log(chalk.bold('Metrics:'));
        const metricsTable = new Table({
            chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' }
        });
        metricsTable.push(['Total Telemetry Events', chalk.cyan(metrics.totalTelemetryEvents)], ['Patterns Detected', chalk.cyan(metrics.patternsDetected)], ['Decisions Proposed', chalk.cyan(metrics.decisionsProposed)], ['Decisions Approved', chalk.green(metrics.decisionsApproved)], ['Decisions Executed', chalk.green(metrics.decisionsExecuted)], ['Patterns Transferred', chalk.green(metrics.patternsTransferred)], ['Average Consensus', chalk.yellow((metrics.averageConsensus * 100).toFixed(1) + '%')]);
        console.log(metricsTable.toString());
        // Component health
        console.log('\n' + chalk.bold('Components:'));
        Object.entries(health.components).forEach(([name, status]) => {
            const icon = status ? chalk.green('✓') : chalk.red('✗');
            console.log(`  ${icon} ${name}`);
        });
    }
    catch (error) {
        spinner.fail('Failed to load status');
        console.error(chalk.red(error.message));
        process.exit(1);
    }
});
program.parse();
