#!/usr/bin/env node
/**
 * IRIS Auto Invoke - Smart Invocation with Trigger Checking
 *
 * Uses intelligent trigger engine to decide if Iris should be invoked
 * based on event type, context, and recent history. Records events for context
 * collection and invokes Iris only when triggers fire.
 *
 * Optimized for fast decision-making (<100ms) to be used in hooks.
 *
 * Usage:
 *   npm run iris:auto-invoke -- --event file_edit --file src/expert.ts --project nfl-predictor
 *   npm run iris:auto-invoke -- --event model_train --expert TheAnalyst --project nfl-predictor
 *   npm run iris:auto-invoke -- --event drift_detected --project microbiome-platform
 *   npm run iris:auto-invoke -- --help
 *
 * Exit Codes:
 *   0 = Success (invoked or skipped based on triggers)
 *   1 = Error
 *   2 = Invalid arguments
 */
import { randomUUID } from 'crypto';
import { createIrisPrime } from '../../orchestrators/iris-prime.js';
import { logTelemetry } from '../../supabase/index.js';
import { initSupabaseFromEnv, isSupabaseInitialized } from '../../supabase/client.js';
import * as fs from 'fs';
import * as path from 'path';
const DEFAULT_TRIGGER_CONFIG = {
    eventThresholds: {
        file_edit: 10, // Invoke after 10 file edits
        model_train: 1, // Invoke after each model train
        drift_detected: 1, // Invoke immediately on drift
        test_failure: 3, // Invoke after 3 test failures
        deployment: 1 // Invoke on deployment
    },
    timeWindow: 60 * 60 * 1000, // 1 hour
    cooldownPeriod: 30 * 60 * 1000, // 30 minutes
    criticalEvents: ['drift_detected', 'deployment', 'critical_failure']
};
/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printHelp();
        return null;
    }
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--event':
            case '-e':
                options.event = args[++i];
                break;
            case '--project':
            case '-p':
                options.project = args[++i];
                break;
            case '--file':
            case '-f':
                options.file = args[++i];
                break;
            case '--expert':
                options.expert = args[++i];
                break;
            case '--metadata':
            case '-m':
                options.metadata = args[++i];
                break;
            case '--db-base-path':
                options.dbBasePath = args[++i];
                break;
            case '--log-path':
                options.logPath = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--force':
                options.force = true;
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
    if (!options.event) {
        console.error('Error: --event is required');
        printHelp();
        process.exit(2);
    }
    if (!options.project) {
        console.error('Error: --project is required');
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
IRIS Auto Invoke - Smart Invocation with Trigger Checking

Usage:
  npm run iris:auto-invoke -- --event <type> --project <id> [options]

Required Arguments:
  --event, -e <type>        Event type (file_edit, model_train, drift_detected, etc.)
  --project, -p <id>        Project ID

Options:
  --file, -f <path>         File path (for file_edit events)
  --expert <id>             Expert ID (for model_train, drift_detected events)
  --metadata, -m <json>     Additional metadata as JSON string
  --db-base-path <path>     Base path for AgentDB databases
  --log-path <path>         Path for log files
  --force                   Force invocation regardless of triggers
  --dry-run                 Check triggers but don't invoke
  --verbose, -v             Enable verbose logging
  --help, -h                Show this help message

Event Types:
  file_edit         - File was edited
  model_train       - Model was trained
  drift_detected    - Performance drift detected
  test_failure      - Test failed
  deployment        - Deployment occurred
  critical_failure  - Critical failure occurred

Examples:
  npm run iris:auto-invoke -- --event file_edit --file src/expert.ts --project nfl-predictor
  npm run iris:auto-invoke -- --event model_train --expert TheAnalyst --project nfl-predictor
  npm run iris:auto-invoke -- --event drift_detected --project microbiome-platform --force

Exit Codes:
  0 = Success (invoked or skipped based on triggers)
  1 = Error
  2 = Invalid arguments
`);
}
/**
 * Get event history file path
 */
function getEventHistoryPath(dbBasePath) {
    return path.join(dbBasePath, 'iris-event-history.jsonl');
}
/**
 * Get last invocation file path
 */
function getLastInvocationPath(dbBasePath) {
    return path.join(dbBasePath, 'iris-last-invocation.json');
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
 * Record event to history
 */
function recordEvent(dbBasePath, event) {
    ensureDir(dbBasePath);
    const historyPath = getEventHistoryPath(dbBasePath);
    fs.appendFileSync(historyPath, JSON.stringify(event) + '\n');
}
/**
 * Read event history
 */
function readEventHistory(dbBasePath, timeWindow) {
    const historyPath = getEventHistoryPath(dbBasePath);
    if (!fs.existsSync(historyPath)) {
        return [];
    }
    const cutoffTime = Date.now() - timeWindow;
    const content = fs.readFileSync(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const events = [];
    for (const line of lines) {
        try {
            const event = JSON.parse(line);
            if (event.timestamp >= cutoffTime) {
                events.push(event);
            }
        }
        catch {
            // Skip invalid lines
        }
    }
    return events;
}
/**
 * Get last invocation timestamp
 */
function getLastInvocation(dbBasePath, project) {
    const lastInvocationPath = getLastInvocationPath(dbBasePath);
    if (!fs.existsSync(lastInvocationPath)) {
        return null;
    }
    try {
        const data = JSON.parse(fs.readFileSync(lastInvocationPath, 'utf-8'));
        return data[project] || null;
    }
    catch {
        return null;
    }
}
/**
 * Record invocation timestamp
 */
function recordInvocation(dbBasePath, project, timestamp) {
    ensureDir(dbBasePath);
    const lastInvocationPath = getLastInvocationPath(dbBasePath);
    let data = {};
    if (fs.existsSync(lastInvocationPath)) {
        try {
            data = JSON.parse(fs.readFileSync(lastInvocationPath, 'utf-8'));
        }
        catch {
            // Start fresh if file is corrupted
        }
    }
    data[project] = timestamp;
    fs.writeFileSync(lastInvocationPath, JSON.stringify(data, null, 2));
}
/**
 * Check if triggers are met
 */
function checkTriggers(event, project, eventHistory, lastInvocation, config) {
    const now = Date.now();
    // Check critical events
    if (config.criticalEvents.includes(event)) {
        return { shouldInvoke: true, reason: `Critical event: ${event}` };
    }
    // Check cooldown period
    if (lastInvocation && now - lastInvocation < config.cooldownPeriod) {
        const remainingMs = config.cooldownPeriod - (now - lastInvocation);
        const remainingMin = Math.ceil(remainingMs / 60000);
        return {
            shouldInvoke: false,
            reason: `Cooldown period active (${remainingMin}m remaining)`
        };
    }
    // Count events of this type in the time window
    const projectEvents = eventHistory.filter(e => e.project === project && e.event === event);
    const threshold = config.eventThresholds[event] || 5;
    const count = projectEvents.length;
    if (count >= threshold) {
        return {
            shouldInvoke: true,
            reason: `Event threshold met: ${count}/${threshold} ${event} events in window`
        };
    }
    return {
        shouldInvoke: false,
        reason: `Threshold not met: ${count}/${threshold} ${event} events (need ${threshold - count} more)`
    };
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
    const logPath = options.logPath || path.join(process.cwd(), 'logs', 'iris-auto-invoke.log');
    const dbBasePath = options.dbBasePath || path.join(process.cwd(), 'data', 'iris');
    try {
        log(`Auto-invoke check for event: ${options.event} (project: ${options.project})`, logPath, options.verbose);
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
        // Parse metadata if provided
        let metadata;
        if (options.metadata) {
            try {
                metadata = JSON.parse(options.metadata);
            }
            catch (err) {
                throw new Error(`Invalid metadata JSON: ${err}`);
            }
        }
        // Build event record
        const eventRecord = {
            timestamp: Date.now(),
            event: options.event,
            project: options.project,
            metadata: {
                ...metadata,
                file: options.file,
                expert: options.expert
            }
        };
        // Record event to history
        recordEvent(dbBasePath, eventRecord);
        log('Event recorded to history', logPath, options.verbose);
        // Check triggers (unless forced)
        let shouldInvoke = options.force || false;
        let reason = options.force ? 'Forced invocation' : '';
        if (!options.force) {
            const config = DEFAULT_TRIGGER_CONFIG;
            const eventHistory = readEventHistory(dbBasePath, config.timeWindow);
            const lastInvocation = getLastInvocation(dbBasePath, options.project);
            const triggerResult = checkTriggers(options.event, options.project, eventHistory, lastInvocation, config);
            shouldInvoke = triggerResult.shouldInvoke;
            reason = triggerResult.reason;
            log(`Trigger check: ${reason}`, logPath, true);
        }
        if (!shouldInvoke) {
            log('Iris invocation skipped', logPath, true);
            process.exit(0);
        }
        if (options.dryRun) {
            log('Dry run: Would invoke Iris', logPath, true);
            process.exit(0);
        }
        // Invoke Iris
        log('Invoking Iris evaluation...', logPath, true);
        const irisConfig = {
            dbBasePath,
            defaultAutoRetrain: false,
            defaultAutoPromote: false,
            logPath: path.dirname(logPath)
        };
        const iris = createIrisPrime(irisConfig);
        const report = await iris.evaluateProject(options.project);
        log(`Evaluation complete: ${report.overallHealth.toUpperCase()} (${report.healthScore}/100)`, logPath, true);
        log(`  Drift Alerts: ${report.driftAlerts.length}`, logPath, options.verbose);
        log(`  Recommended Actions: ${report.recommendedActions.length}`, logPath, options.verbose);
        // Record invocation timestamp
        recordInvocation(dbBasePath, options.project, Date.now());
        // Cleanup
        iris.close();
        // Log to Supabase
        try {
            await logTelemetry({
                expertId: 'iris-auto-invoke-cli',
                version: '1.0.0',
                runId: randomUUID(),
                outcome: 'success',
                metadata: {
                    eventType: 'IRIS_AUTO_INVOKE_CLI',
                    triggerEvent: options.event,
                    projectId: options.project,
                    triggerReason: reason,
                    healthScore: report.healthScore,
                    durationMs: Date.now() - startTime
                }
            });
        }
        catch {
            // Silently ignore Supabase errors
        }
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        log(`Auto-invoke completed in ${duration}s`, logPath, true);
        process.exit(0);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error: ${errorMessage}`, logPath, true);
        // Log error to Supabase
        try {
            await logTelemetry({
                expertId: 'iris-auto-invoke-cli',
                version: '1.0.0',
                runId: randomUUID(),
                outcome: 'failure',
                metadata: {
                    eventType: 'IRIS_AUTO_INVOKE_CLI_ERROR',
                    error: errorMessage,
                    durationMs: Date.now() - startTime
                }
            });
        }
        catch {
            // Silently ignore Supabase errors
        }
        process.exit(1);
    }
}
// Run if executed directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
    main();
}
export { main as irisAutoInvoke };
