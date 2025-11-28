#!/usr/bin/env node
/**
 * IRIS Evaluate Batch - Queue-based Batch Evaluation CLI
 *
 * Reads a queue file, groups events by project, invokes Iris once per project,
 * and clears the queue on successful completion.
 *
 * Queue File Format (JSONL):
 *   {"project": "nfl-predictor", "event": "file_edit", "file": "src/expert.ts", "timestamp": "2024-01-01T00:00:00Z"}
 *   {"project": "microbiome-platform", "event": "model_train", "expertId": "DrDysbiosis", "timestamp": "2024-01-01T01:00:00Z"}
 *
 * Usage:
 *   npm run iris:evaluate-batch -- --queue .claude/iris-queue.jsonl
 *   npm run iris:evaluate-batch -- --queue queue.jsonl --clear-on-success
 *   npm run iris:evaluate-batch -- --help
 *
 * Exit Codes:
 *   0 = Success
 *   1 = Error
 *   2 = Invalid arguments
 *   3 = Queue processing failed
 */
import { randomUUID } from 'crypto';
import { createIrisPrime } from '../../orchestrators/iris-prime.js';
import { logTelemetry } from '../../supabase/index.js';
import { initSupabaseFromEnv, isSupabaseInitialized } from '../../supabase/client.js';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return null;
    }
    const options = {
        clearOnSuccess: true // Default to clearing queue
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--queue':
            case '-q':
                options.queue = args[++i];
                break;
            case '--clear-on-success':
                options.clearOnSuccess = true;
                break;
            case '--no-clear':
                options.clearOnSuccess = false;
                break;
            case '--db-base-path':
                options.dbBasePath = args[++i];
                break;
            case '--log-path':
                options.logPath = args[++i];
                break;
            case '--output-dir':
            case '-o':
                options.outputDir = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--dry-run':
                options.dryRun = true;
                break;
            default:
                console.error(`Unknown argument: ${arg}`);
                printHelp();
                process.exit(2);
        }
    }
    if (!options.queue) {
        console.error('Error: --queue is required');
        printHelp();
        process.exit(2);
    }
    return options;
}
/**
 * Print help message
 */
function printHelp() {
    console.log(`
IRIS Evaluate Batch - Queue-based Batch Evaluation

Usage:
  npm run iris:evaluate-batch -- --queue <file> [options]

Required Arguments:
  --queue, -q <file>        Path to queue file (JSONL format)

Options:
  --clear-on-success        Clear queue file after successful evaluation (default)
  --no-clear                Keep queue file after evaluation
  --db-base-path <path>     Base path for AgentDB databases
  --log-path <path>         Path for log files
  --output-dir, -o <dir>    Directory to save evaluation reports
  --dry-run                 Parse queue but don't run evaluations
  --verbose, -v             Enable verbose logging
  --help, -h                Show this help message

Queue File Format (JSONL):
  {"project": "nfl-predictor", "event": "file_edit", "file": "src/expert.ts", "timestamp": "2024-01-01T00:00:00Z"}
  {"project": "microbiome-platform", "event": "model_train", "expertId": "DrDysbiosis", "timestamp": "2024-01-01T01:00:00Z"}

Examples:
  npm run iris:evaluate-batch -- --queue .claude/iris-queue.jsonl
  npm run iris:evaluate-batch -- -q queue.jsonl --output-dir ./reports
  npm run iris:evaluate-batch -- -q queue.jsonl --dry-run --verbose

Exit Codes:
  0 = Success
  1 = Error
  2 = Invalid arguments
  3 = Queue processing failed
`);
}
/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
/**
 * Log to file and console
 */
function log(message, logPath, verbose) {
    if (verbose) {
        console.log(message);
    }
    if (logPath) {
        ensureDir(path.dirname(logPath));
        fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
    }
}
/**
 * Read and parse queue file
 */
function readQueue(queuePath) {
    if (!fs.existsSync(queuePath)) {
        throw new Error(`Queue file not found: ${queuePath}`);
    }
    const content = fs.readFileSync(queuePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const events = [];
    for (let i = 0; i < lines.length; i++) {
        try {
            const event = JSON.parse(lines[i]);
            if (!event.project || !event.event) {
                throw new Error('Missing required fields: project, event');
            }
            events.push(event);
        }
        catch (err) {
            throw new Error(`Invalid JSON at line ${i + 1}: ${err}`);
        }
    }
    return events;
}
/**
 * Group events by project
 */
function groupByProject(events) {
    const grouped = new Map();
    for (const event of events) {
        const existing = grouped.get(event.project) || [];
        existing.push(event);
        grouped.set(event.project, existing);
    }
    return grouped;
}
/**
 * Clear queue file
 */
function clearQueue(queuePath) {
    fs.writeFileSync(queuePath, '');
}
/**
 * Main execution
 */
async function main() {
    const options = parseArgs();
    if (!options) {
        process.exit(0); // Help was shown
    }
    const startTime = Date.now();
    const logPath = options.logPath || path.join(process.cwd(), 'logs', 'iris-evaluate-batch.log');
    try {
        log(`Starting IRIS batch evaluation from queue: ${options.queue}`, logPath, options.verbose);
        // Initialize Supabase if credentials are available
        if (!isSupabaseInitialized()) {
            try {
                initSupabaseFromEnv();
                log('✅ Supabase client initialized', logPath, options.verbose);
            }
            catch (err) {
                log('⚠️  Supabase credentials not configured, using local-only mode', logPath, options.verbose);
            }
        }
        // Read queue
        const queuePath = path.resolve(options.queue);
        const events = readQueue(queuePath);
        log(`Read ${events.length} event(s) from queue`, logPath, true);
        if (events.length === 0) {
            log('Queue is empty, nothing to evaluate', logPath, true);
            process.exit(0);
        }
        // Group by project
        const grouped = groupByProject(events);
        log(`Found ${grouped.size} unique project(s)`, logPath, true);
        for (const [project, projectEvents] of grouped.entries()) {
            log(`  - ${project}: ${projectEvents.length} event(s)`, logPath, true);
        }
        if (options.dryRun) {
            log('Dry run complete (no evaluations performed)', logPath, true);
            process.exit(0);
        }
        // Create IRIS instance
        const irisConfig = {
            dbBasePath: options.dbBasePath || path.join(process.cwd(), 'data', 'iris'),
            defaultAutoRetrain: false,
            defaultAutoPromote: false,
            logPath: path.dirname(logPath)
        };
        const iris = createIrisPrime(irisConfig);
        log('IRIS initialized', logPath, options.verbose);
        // Evaluate each project
        const results = [];
        for (const [project, projectEvents] of grouped.entries()) {
            try {
                log(`\nEvaluating project: ${project} (${projectEvents.length} event(s))...`, logPath, true);
                const report = await iris.evaluateProject(project);
                log(`  Health: ${report.overallHealth.toUpperCase()} (${report.healthScore}/100)`, logPath, true);
                log(`  Drift Alerts: ${report.driftAlerts.length}`, logPath, true);
                log(`  Recommended Actions: ${report.recommendedActions.length}`, logPath, true);
                // Save report if output directory specified
                if (options.outputDir) {
                    ensureDir(options.outputDir);
                    const reportPath = path.join(options.outputDir, `${project}-${Date.now()}.json`);
                    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
                    log(`  Report saved: ${reportPath}`, logPath, options.verbose);
                }
                results.push({ project, success: true });
            }
            catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                log(`  Error evaluating ${project}: ${errorMessage}`, logPath, true);
                results.push({ project, success: false, error: errorMessage });
            }
        }
        // Cleanup IRIS
        iris.close();
        // Summary
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        console.log('\n='.repeat(80));
        console.log('BATCH EVALUATION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Projects: ${grouped.size}`);
        console.log(`Successful: ${successCount}`);
        console.log(`Failed: ${failureCount}`);
        if (failureCount > 0) {
            console.log('\nFailed Projects:');
            results.filter(r => !r.success).forEach(r => {
                console.log(`  - ${r.project}: ${r.error}`);
            });
        }
        // Clear queue if all successful
        if (options.clearOnSuccess && failureCount === 0) {
            clearQueue(queuePath);
            log(`Queue file cleared: ${queuePath}`, logPath, true);
        }
        else if (failureCount > 0) {
            log('Queue file preserved due to failures', logPath, true);
        }
        // Log to Supabase
        try {
            await logTelemetry({
                expertId: 'iris-evaluate-batch-cli',
                version: '1.0.0',
                runId: randomUUID(),
                outcome: failureCount === 0 ? 'success' : 'partial_failure',
                metadata: {
                    eventType: 'IRIS_EVALUATE_BATCH_CLI',
                    totalEvents: events.length,
                    projectCount: grouped.size,
                    successCount,
                    failureCount,
                    durationMs: Date.now() - startTime,
                    queueCleared: options.clearOnSuccess && failureCount === 0
                }
            });
        }
        catch {
            // Silently ignore Supabase errors
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`\nBatch evaluation completed in ${duration}s`, logPath, true);
        process.exit(failureCount > 0 ? 3 : 0);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error: ${errorMessage}`, logPath, true);
        // Log error to Supabase
        try {
            await logTelemetry({
                expertId: 'iris-evaluate-batch-cli',
                version: '1.0.0',
                runId: randomUUID(),
                outcome: 'failure',
                metadata: {
                    eventType: 'IRIS_EVALUATE_BATCH_CLI_ERROR',
                    error: errorMessage,
                    durationMs: Date.now() - startTime
                }
            });
        }
        catch {
            // Silently ignore Supabase errors
        }
        process.exit(3);
    }
}
// Run if executed directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
    main();
}
export { main as irisEvaluateBatch };
