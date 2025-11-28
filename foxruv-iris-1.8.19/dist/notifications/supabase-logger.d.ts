/**
 * Supabase Logger for IRIS
 *
 * Logs IRIS reports and events to Supabase for dashboard consumption
 * and historical tracking.
 *
 * @module supabase-logger
 * @version 1.0.0
 */
import type { IrisNotifier, IrisEvent } from './types.js';
import type { IrisReport } from '../orchestrators/iris-prime.js';
/**
 * Supabase Logger for IRIS events and reports
 */
export declare class SupabaseLogger implements IrisNotifier {
    private supabase;
    constructor();
    /**
     * Send (log) IRIS event to Supabase
     */
    send(event: IrisEvent): Promise<void>;
    /**
     * Log full IRIS report to Supabase
     */
    logReport(runId: string, project: string, report: IrisReport): Promise<void>;
    /**
     * Get recent reports from Supabase
     */
    getRecentReports(limit?: number): Promise<any[]>;
    /**
     * Get recent events from Supabase
     */
    getRecentEvents(limit?: number, project?: string): Promise<any[]>;
    /**
     * Get promotions from last N days
     */
    getRecentPromotions(days?: number): Promise<any[]>;
}
/**
 * Create Supabase logger
 */
export declare function createSupabaseLogger(): SupabaseLogger;
//# sourceMappingURL=supabase-logger.d.ts.map