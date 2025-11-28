/**
 * Scheduled IRIS Runner
 *
 * Runs IRIS on a schedule (daily, hourly, etc.) to continuously monitor
 * agent health, detect drift, and auto-optimize experts across all projects.
 *
 * Features:
 * - Scheduled execution (cron-like)
 * - JSON logging of reports
 * - Auto-retraining of drifting experts
 * - Email/webhook alerts for critical issues
 * - Supabase integration for metrics storage
 *
 * @example
 * ```bash
 * # Run once
 * npx tsx src/orchestrators/run-iris-scheduled.ts
 *
 * # Run as daemon
 * pm2 start src/orchestrators/run-iris-scheduled.ts --name iris-prime
 * ```
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { createIrisPrime } from './iris-prime.js';
import { buildDailyDigest, formatDailyDigest } from '../notifications/digest-builder.js';
import { createWhatsAppNotifier } from '../notifications/whatsapp-notifier.js';
import { initSupabaseFromEnv } from '../supabase/client.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env file from project root
config({ path: path.resolve(__dirname, '../../.env') });
/**
 * Scheduled IRIS Runner
 */
class ScheduledIrisRunner {
    config;
    intervalId;
    constructor(config = {}) {
        this.config = {
            intervalMs: config.intervalMs || 24 * 60 * 60 * 1000, // 24 hours
            projects: config.projects || ['nfl-predictor', 'microbiome-platform', 'beclever-ai'],
            logPath: config.logPath || './logs/iris',
            autoRetrain: config.autoRetrain ?? true,
            autoPromote: config.autoPromote ?? false,
            webhookUrl: config.webhookUrl,
            supabaseUrl: config.supabaseUrl,
            supabaseKey: config.supabaseKey
        };
        // Ensure log directory exists
        if (!fs.existsSync(this.config.logPath)) {
            fs.mkdirSync(this.config.logPath, { recursive: true });
        }
        console.log('🤖 IRIS Scheduled Runner initialized');
        console.log(`   Interval: ${this.config.intervalMs / 1000 / 60} minutes`);
        console.log(`   Projects: ${this.config.projects.join(', ')}`);
        console.log(`   Log path: ${this.config.logPath}`);
    }
    /**
     * Run IRIS once
     */
    async runOnce() {
        const timestamp = new Date();
        console.log('\n' + '='.repeat(80));
        console.log(`IRIS - Scheduled Run`);
        console.log(`${timestamp.toISOString()}`);
        console.log('='.repeat(80));
        // Initialize Supabase from environment
        try {
            initSupabaseFromEnv();
            console.log('✅ Supabase initialized');
        }
        catch (error) {
            // Only show in verbose mode - local-only is perfectly fine
            if (process.env.IRIS_VERBOSE || process.env.DEBUG) {
                console.info('ℹ️  Using local AgentDB only (Supabase not configured)');
            }
        }
        const iris = createIrisPrime({
            dbBasePath: './data/iris',
            defaultAutoRetrain: this.config.autoRetrain,
            defaultAutoPromote: this.config.autoPromote
        });
        // Create report cache to avoid duplicate evaluations
        const reportCache = new Map();
        try {
            // Configure projects
            for (const projectId of this.config.projects) {
                iris.configureProject({
                    projectId,
                    autoRetrain: this.config.autoRetrain,
                    autoPromote: this.config.autoPromote,
                    retrainingThreshold: 0.1,
                    promotionThreshold: 0.1,
                    minEvaluations: 10
                });
            }
            // Evaluate all projects
            const crossReport = await iris.evaluateAllProjects();
            // Log to JSON
            this.writeReport('cross-project', crossReport);
            // Handle critical issues
            const criticalProjects = crossReport.projects.filter(p => p.criticalAlerts > 0);
            if (criticalProjects.length > 0) {
                console.log(`\n⚠️  CRITICAL: ${criticalProjects.length} project(s) with critical alerts`);
                for (const project of criticalProjects) {
                    console.log(`\n   Processing ${project.projectId}...`);
                    // Evaluate project in detail and cache the result
                    const report = await iris.evaluateProject(project.projectId);
                    reportCache.set(project.projectId, report);
                    // Log detailed report
                    this.writeReport(project.projectId, report);
                    // Auto-retrain if enabled
                    if (this.config.autoRetrain) {
                        const retrained = await iris.autoRetrainExperts(project.projectId);
                        if (retrained.length > 0) {
                            console.log(`   ✓ Retrained ${retrained.length} expert(s)`);
                        }
                    }
                    // Send alert if configured
                    if (this.config.webhookUrl) {
                        await this.sendWebhookAlert(project.projectId, report);
                    }
                    // Log to Supabase if configured
                    if (this.config.supabaseUrl && this.config.supabaseKey) {
                        await this.logToSupabase(report);
                    }
                }
            }
            else {
                console.log('\n✅ All projects healthy - no critical alerts');
            }
            // Summary
            this.writeSummary(timestamp, crossReport);
            // Send daily digest to WhatsApp (pass iris instance and cached reports)
            await this.sendDailyDigest(iris, crossReport, reportCache);
        }
        finally {
            // Clean up cache
            reportCache.clear();
            iris.close();
        }
        console.log('\n✅ IRIS run complete\n');
    }
    /**
     * Send daily digest to WhatsApp
     */
    async sendDailyDigest(iris, crossReport, reportCache) {
        try {
            console.log('\n📱 Sending daily digest to WhatsApp...');
            const digest = await buildDailyDigest(this.config.projects, iris, crossReport, reportCache);
            const digestText = formatDailyDigest(digest);
            const whatsappNotifier = createWhatsAppNotifier({
                enabled: true,
                dailyDigest: true,
                realtimeCriticalAlerts: false
            });
            await whatsappNotifier.sendDigest(digestText);
            console.log('✓ Daily digest sent');
        }
        catch (error) {
            console.error('Failed to send daily digest:', error);
            // Don't fail the entire run if WhatsApp fails
        }
    }
    /**
     * Start scheduled execution
     */
    start() {
        console.log(`\n🚀 Starting IRIS scheduler...`);
        console.log(`   Running every ${this.config.intervalMs / 1000 / 60} minutes\n`);
        // Run immediately
        this.runOnce().catch(console.error);
        // Schedule recurring runs
        this.intervalId = setInterval(() => {
            this.runOnce().catch(console.error);
        }, this.config.intervalMs);
    }
    /**
     * Stop scheduled execution
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            console.log('🛑 IRIS scheduler stopped');
        }
    }
    // ============================================================================
    // Logging & Alerting
    // ============================================================================
    /**
     * Write report to JSON file
     */
    writeReport(name, report) {
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `${name}-${timestamp}.json`;
        const filepath = path.join(this.config.logPath, filename);
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        console.log(`   📄 Report written: ${filepath}`);
    }
    /**
     * Write summary log
     */
    writeSummary(timestamp, crossReport) {
        const summaryPath = path.join(this.config.logPath, 'iris-summary.json');
        let history = [];
        if (fs.existsSync(summaryPath)) {
            history = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        }
        history.push({
            timestamp: timestamp.toISOString(),
            totalProjects: crossReport.projects.length,
            healthyProjects: crossReport.projects.filter(p => p.criticalAlerts === 0).length,
            totalAlerts: crossReport.totalDriftAlerts,
            transferOpportunities: crossReport.transferOpportunities
        });
        // Keep last 30 days
        history = history.slice(-30);
        fs.writeFileSync(summaryPath, JSON.stringify(history, null, 2));
        console.log(`   📊 Summary updated: ${summaryPath}`);
    }
    /**
     * Send webhook alert
     */
    async sendWebhookAlert(projectId, report) {
        if (!this.config.webhookUrl)
            return;
        const criticalActions = report.recommendedActions.filter(a => a.priority === 'critical');
        const payload = {
            project: projectId,
            health: report.overallHealth,
            score: report.healthScore,
            criticalAlerts: report.driftAlerts.filter(a => a.severity === 'critical').length,
            actions: criticalActions.map(a => ({
                action: a.action,
                reason: a.reason
            })),
            timestamp: new Date().toISOString()
        };
        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                console.log(`   ✓ Webhook alert sent for ${projectId}`);
            }
            else {
                console.error(`   ✗ Webhook failed: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error(`   ✗ Webhook error:`, error);
        }
    }
    /**
     * Log to Supabase
     */
    async logToSupabase(report) {
        if (!this.config.supabaseUrl || !this.config.supabaseKey)
            return;
        // TODO: Implement Supabase logging
        // const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey)
        // await supabase.from('iris_reports').insert({ ... })
        console.log(`   [STUB] Would log to Supabase: ${report.projectId}`);
    }
}
/**
 * Main entry point
 */
async function main() {
    const runner = new ScheduledIrisRunner({
        intervalMs: parseInt(process.env.IRIS_INTERVAL_MS || '86400000'), // 24 hours default
        projects: process.env.IRIS_PROJECTS?.split(',') || ['nfl-predictor', 'microbiome-platform'],
        logPath: process.env.IRIS_LOG_PATH || './logs/iris',
        autoRetrain: process.env.IRIS_AUTO_RETRAIN === 'true',
        autoPromote: process.env.IRIS_AUTO_PROMOTE === 'true',
        webhookUrl: process.env.IRIS_WEBHOOK_URL,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_ANON_KEY
    });
    // Check if running in schedule mode or one-off
    if (process.env.IRIS_SCHEDULE === 'true') {
        runner.start();
        // Keep process alive
        process.on('SIGINT', () => {
            runner.stop();
            process.exit(0);
        });
    }
    else {
        // Run once and exit
        await runner.runOnce();
    }
}
// Run if executed directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
    main().catch(console.error);
}
export { ScheduledIrisRunner };
