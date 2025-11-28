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
/**
 * Schedule configuration
 */
interface ScheduleConfig {
    intervalMs: number;
    projects: string[];
    logPath: string;
    autoRetrain: boolean;
    autoPromote: boolean;
    webhookUrl?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
}
/**
 * Scheduled IRIS Runner
 */
declare class ScheduledIrisRunner {
    private config;
    private intervalId?;
    constructor(config?: Partial<ScheduleConfig>);
    /**
     * Run IRIS once
     */
    runOnce(): Promise<void>;
    /**
     * Send daily digest to WhatsApp
     */
    private sendDailyDigest;
    /**
     * Start scheduled execution
     */
    start(): void;
    /**
     * Stop scheduled execution
     */
    stop(): void;
    /**
     * Write report to JSON file
     */
    private writeReport;
    /**
     * Write summary log
     */
    private writeSummary;
    /**
     * Send webhook alert
     */
    private sendWebhookAlert;
    /**
     * Log to Supabase
     */
    private logToSupabase;
}
export { ScheduledIrisRunner };
//# sourceMappingURL=run-iris-scheduled.d.ts.map