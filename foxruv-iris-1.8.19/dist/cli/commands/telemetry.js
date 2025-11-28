/**
 * iris telemetry - Telemetry management commands
 *
 * Commands for managing the dual-lane telemetry system:
 * - migrate: Migrate historical data from AgentDB to Supabase
 * - sync: Trigger manual sync of queued events
 * - status: Show sync status and statistics
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { migrateAll, } from '../../migration/agentdb-to-supabase.js';
import { TelemetryEmitter } from '../../telemetry/telemetry-emitter.js';
import { isSupabaseInitialized } from '../../supabase/client.js';
// ============================================================================
// Migrate Command
// ============================================================================
/**
 * Migrate historical data from AgentDB to Supabase
 * Usage: npx iris telemetry migrate [options]
 */
export async function runTelemetryMigrate(options = {}) {
    console.log(chalk.cyan.bold('\n--- Telemetry Migration: AgentDB -> Supabase ---\n'));
    // Check Supabase initialization
    const spinner = ora('Checking Supabase connection...').start();
    if (!isSupabaseInitialized()) {
        spinner.fail('Supabase not initialized');
        console.log(chalk.yellow('\nPlease set the following environment variables:'));
        console.log(chalk.gray('  FOXRUV_SUPABASE_URL=<your-supabase-url>'));
        console.log(chalk.gray('  FOXRUV_SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>'));
        console.log(chalk.gray('  FOXRUV_PROJECT_ID=<your-project-id>\n'));
        return {
            success: false,
            migratedRecords: { signatures: 0, reflexions: 0, telemetry: 0, consensus: 0 },
            errors: ['Supabase not initialized'],
            duration: 0,
        };
    }
    spinner.succeed('Supabase connection verified');
    // Resolve AgentDB path
    const agentDbPath = options.agentDbPath || path.join(process.cwd(), 'data', 'agentdb', 'iris.db');
    const projectId = options.projectId || process.env.FOXRUV_PROJECT_ID || 'default';
    // Check if AgentDB file exists
    const dbSpinner = ora(`Checking AgentDB at ${agentDbPath}...`).start();
    try {
        await fs.access(agentDbPath);
        dbSpinner.succeed(`AgentDB found: ${agentDbPath}`);
    }
    catch {
        dbSpinner.fail(`AgentDB not found at ${agentDbPath}`);
        console.log(chalk.yellow('\nTry specifying the path with --db-path <path>\n'));
        return {
            success: false,
            migratedRecords: { signatures: 0, reflexions: 0, telemetry: 0, consensus: 0 },
            errors: [`AgentDB not found at ${agentDbPath}`],
            duration: 0,
        };
    }
    // Display migration config
    console.log(chalk.blue('\nMigration Configuration:'));
    console.log(chalk.gray(`  Source: ${agentDbPath}`));
    console.log(chalk.gray(`  Project ID: ${projectId}`));
    console.log(chalk.gray(`  Batch Size: ${options.batchSize || 100}`));
    console.log(chalk.gray(`  Dry Run: ${options.dryRun ? 'Yes' : 'No'}`));
    console.log();
    if (options.dryRun) {
        console.log(chalk.yellow('--- DRY RUN MODE: No data will be migrated ---\n'));
    }
    // Progress tracking
    let currentPhase = '';
    let progressBar = ora();
    const migrationOptions = {
        agentDbPath,
        projectId,
        dryRun: options.dryRun,
        batchSize: options.batchSize || 100,
        onProgress: (progress) => {
            if (progress.phase !== currentPhase) {
                if (currentPhase) {
                    progressBar.succeed(`${formatPhase(currentPhase)} complete`);
                }
                currentPhase = progress.phase;
                progressBar = ora(`${formatPhase(progress.phase)}: 0%`).start();
            }
            const bar = createProgressBar(progress.percentage);
            progressBar.text = `${formatPhase(progress.phase)}: ${bar} ${progress.current}/${progress.total} (${progress.percentage}%)`;
        },
    };
    // Run migration
    const result = await migrateAll(migrationOptions);
    // Final progress update
    if (currentPhase) {
        progressBar.succeed(`${formatPhase(currentPhase)} complete`);
    }
    // Display results
    console.log(chalk.cyan.bold('\n--- Migration Results ---\n'));
    if (result.success) {
        console.log(chalk.green.bold('Migration completed successfully!'));
    }
    else {
        console.log(chalk.yellow.bold('Migration completed with errors.'));
    }
    console.log(chalk.blue('\nRecords Migrated:'));
    console.log(chalk.gray(`  Signatures: ${result.migratedRecords.signatures}`));
    console.log(chalk.gray(`  Reflexions: ${result.migratedRecords.reflexions}`));
    console.log(chalk.gray(`  Telemetry:  ${result.migratedRecords.telemetry}`));
    console.log(chalk.gray(`  Consensus:  ${result.migratedRecords.consensus}`));
    const total = result.migratedRecords.signatures +
        result.migratedRecords.reflexions +
        result.migratedRecords.telemetry +
        result.migratedRecords.consensus;
    console.log(chalk.blue(`\nTotal: ${total} records in ${(result.duration / 1000).toFixed(2)}s`));
    if (result.errors.length > 0) {
        console.log(chalk.yellow(`\nErrors (${result.errors.length}):`));
        result.errors.slice(0, 5).forEach((err, i) => {
            console.log(chalk.red(`  ${i + 1}. ${err}`));
        });
        if (result.errors.length > 5) {
            console.log(chalk.gray(`  ... and ${result.errors.length - 5} more errors`));
        }
    }
    console.log();
    return result;
}
// ============================================================================
// Sync Command
// ============================================================================
/**
 * Trigger manual sync of queued telemetry events
 * Usage: npx iris telemetry sync [options]
 */
export async function runTelemetrySync(options = {}) {
    const { force = false, timeout = 60000 } = options;
    console.log(chalk.cyan.bold('\n--- Telemetry Sync ---\n'));
    if (force) {
        console.log(chalk.gray('Force sync enabled\n'));
    }
    const spinner = ora('Initializing telemetry emitter...').start();
    // Create telemetry emitter with timeout configuration
    const emitter = new TelemetryEmitter({
        telemetryApiUrl: process.env.TELEMETRY_API_URL,
        supabaseUrl: process.env.FOXRUV_SUPABASE_URL,
        supabaseServiceKey: process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY,
        tableName: 'model_run_log',
        summaryDir: path.join(process.cwd(), '.iris'),
        flushIntervalMs: timeout,
    });
    spinner.text = 'Loading pending events from AgentDB...';
    // Read current stats before sync
    const summaryPath = path.join(process.cwd(), '.iris', 'telemetry-summary.json');
    let beforeStats = { queued: 0, sent: 0, failed: 0, lastFlush: null };
    try {
        const content = await fs.readFile(summaryPath, 'utf8');
        beforeStats = JSON.parse(content);
    }
    catch {
        // No previous summary - this is fine
    }
    spinner.text = 'Replaying pending events...';
    // Trigger replay of pending events
    const syncSpinner = ora('Syncing events to upstream...').start();
    try {
        await emitter.replayPending();
        syncSpinner.succeed('Sync completed');
    }
    catch (error) {
        syncSpinner.fail('Sync failed');
        console.log(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}\n`));
        emitter.stop();
        return {
            success: false,
            synced: 0,
            failed: 0,
            pending: beforeStats.queued,
        };
    }
    // Read stats after sync
    let afterStats = { queued: 0, sent: 0, failed: 0, lastFlush: null };
    try {
        const content = await fs.readFile(summaryPath, 'utf8');
        afterStats = JSON.parse(content);
    }
    catch {
        // Failed to read summary
    }
    const synced = afterStats.sent - beforeStats.sent;
    const failed = afterStats.failed - beforeStats.failed;
    // Display results
    console.log(chalk.blue('\nSync Results:'));
    console.log(chalk.green(`  Events synced: ${synced}`));
    if (failed > 0) {
        console.log(chalk.red(`  Events failed: ${failed}`));
    }
    console.log(chalk.gray(`  Last flush: ${afterStats.lastFlush || 'N/A'}`));
    console.log();
    // Clean up
    emitter.stop();
    return {
        success: failed === 0,
        synced,
        failed,
        pending: 0,
    };
}
// ============================================================================
// Status Command
// ============================================================================
/**
 * Show telemetry sync status and statistics
 * Usage: npx iris telemetry status [options]
 */
export async function runTelemetryStatus(options = {}) {
    if (!options.json) {
        console.log(chalk.cyan.bold('\n--- Telemetry Status ---\n'));
    }
    const summaryPath = path.join(process.cwd(), '.iris', 'telemetry-summary.json');
    const telemetryDbPath = path.join(process.cwd(), 'data', 'telemetry.db');
    // Read telemetry summary
    let summary = null;
    try {
        const content = await fs.readFile(summaryPath, 'utf8');
        summary = JSON.parse(content);
    }
    catch {
        // No summary file
    }
    // Check if telemetry database exists
    let dbExists = false;
    let dbSize = 0;
    try {
        const stats = await fs.stat(telemetryDbPath);
        dbExists = true;
        dbSize = stats.size;
    }
    catch {
        // DB doesn't exist
    }
    // Check Supabase status
    const supabaseConfigured = isSupabaseInitialized();
    // Build status object
    const status = {
        local: {
            dbExists,
            dbPath: telemetryDbPath,
            dbSize: formatBytes(dbSize),
            dbSizeBytes: dbSize,
        },
        sync: summary || {
            queued: 0,
            sent: 0,
            failed: 0,
            lastFlush: null,
        },
        supabase: {
            configured: supabaseConfigured,
            url: process.env.FOXRUV_SUPABASE_URL ? maskUrl(process.env.FOXRUV_SUPABASE_URL) : null,
            projectId: process.env.FOXRUV_PROJECT_ID || null,
        },
        health: {
            status: determineHealth(summary, supabaseConfigured),
            message: getHealthMessage(summary, supabaseConfigured),
        },
    };
    if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
    }
    // Display status
    console.log(chalk.blue('Local Storage:'));
    console.log(chalk.gray(`  Database: ${dbExists ? chalk.green('exists') : chalk.yellow('not found')}`));
    if (dbExists) {
        console.log(chalk.gray(`  Path: ${telemetryDbPath}`));
        console.log(chalk.gray(`  Size: ${status.local.dbSize}`));
    }
    console.log(chalk.blue('\nSync Statistics:'));
    console.log(chalk.gray(`  Queued: ${status.sync.queued}`));
    console.log(chalk.gray(`  Sent: ${status.sync.sent}`));
    console.log(chalk.gray(`  Failed: ${status.sync.failed}`));
    console.log(chalk.gray(`  Last Flush: ${status.sync.lastFlush || 'Never'}`));
    console.log(chalk.blue('\nSupabase:'));
    console.log(chalk.gray(`  Configured: ${supabaseConfigured ? chalk.green('Yes') : chalk.yellow('No')}`));
    if (status.supabase.url) {
        console.log(chalk.gray(`  URL: ${status.supabase.url}`));
    }
    if (status.supabase.projectId) {
        console.log(chalk.gray(`  Project ID: ${status.supabase.projectId}`));
    }
    console.log(chalk.blue('\nHealth:'));
    const healthColor = status.health.status === 'healthy' ? chalk.green : status.health.status === 'warning' ? chalk.yellow : chalk.red;
    console.log(`  Status: ${healthColor(status.health.status.toUpperCase())}`);
    console.log(chalk.gray(`  ${status.health.message}`));
    if (options.detailed) {
        console.log(chalk.blue('\nEnvironment Variables:'));
        console.log(chalk.gray(`  FOXRUV_SUPABASE_URL: ${process.env.FOXRUV_SUPABASE_URL ? 'Set' : 'Not set'}`));
        console.log(chalk.gray(`  FOXRUV_SUPABASE_SERVICE_ROLE_KEY: ${process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set'}`));
        console.log(chalk.gray(`  FOXRUV_PROJECT_ID: ${process.env.FOXRUV_PROJECT_ID || 'Not set'}`));
        console.log(chalk.gray(`  TELEMETRY_API_URL: ${process.env.TELEMETRY_API_URL || 'Not set'}`));
    }
    console.log();
}
// ============================================================================
// Helper Functions
// ============================================================================
function formatPhase(phase) {
    const phases = {
        signatures: 'Expert Signatures',
        reflexions: 'Reflexions',
        telemetry: 'Telemetry Data',
        consensus: 'Consensus Decisions',
    };
    return phases[phase] || phase;
}
function createProgressBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
function maskUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host.substring(0, 8)}...`;
    }
    catch {
        return url.substring(0, 20) + '...';
    }
}
function determineHealth(summary, supabaseConfigured) {
    if (!supabaseConfigured)
        return 'warning';
    if (!summary)
        return 'warning';
    if (summary.failed > summary.sent * 0.1)
        return 'error'; // >10% failure rate
    if (summary.queued > 100)
        return 'warning'; // Large queue
    return 'healthy';
}
function getHealthMessage(summary, supabaseConfigured) {
    if (!supabaseConfigured) {
        return 'Supabase not configured. Events are being stored locally only.';
    }
    if (!summary) {
        return 'No telemetry activity recorded yet.';
    }
    if (summary.failed > summary.sent * 0.1) {
        return `High failure rate detected (${summary.failed} failed / ${summary.sent} sent). Check Supabase connection.`;
    }
    if (summary.queued > 100) {
        return `Large queue detected (${summary.queued} pending). Consider running 'iris telemetry sync'.`;
    }
    return 'Telemetry system is operating normally.';
}
// ============================================================================
// Command Exports for CLI Registration
// ============================================================================
export const telemetryCommands = {
    migrate: runTelemetryMigrate,
    sync: runTelemetrySync,
    status: runTelemetryStatus,
};
export default telemetryCommands;
