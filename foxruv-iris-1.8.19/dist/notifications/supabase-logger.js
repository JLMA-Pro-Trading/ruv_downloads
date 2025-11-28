/**
 * Supabase Logger for IRIS
 *
 * Logs IRIS reports and events to Supabase for dashboard consumption
 * and historical tracking.
 *
 * @module supabase-logger
 * @version 1.0.0
 */
import { createClient } from '@supabase/supabase-js';
/**
 * Supabase Logger for IRIS events and reports
 */
export class SupabaseLogger {
    supabase;
    constructor() {
        const supabaseUrl = process.env.FOXRUV_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.FOXRUV_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not configured (FOXRUV_SUPABASE_URL, FOXRUV_SUPABASE_SERVICE_ROLE_KEY)');
        }
        this.supabase = createClient(supabaseUrl, supabaseKey);
    }
    /**
     * Send (log) IRIS event to Supabase
     */
    async send(event) {
        try {
            const { error } = await this.supabase.from('iris_events').insert({
                run_id: event.runId,
                project: event.project,
                event_type: event.eventType,
                severity: event.severity,
                payload: event.payload,
                created_at: event.createdAt.toISOString()
            });
            if (error) {
                console.error('Failed to log event to Supabase:', error);
            }
            else {
                console.log(`✓ Event logged to Supabase: ${event.eventType}`);
            }
        }
        catch (error) {
            console.error('Supabase logging error:', error);
        }
    }
    /**
     * Log full IRIS report to Supabase
     */
    async logReport(runId, project, report) {
        try {
            const { error } = await this.supabase.from('iris_reports').insert({
                project,
                run_id: runId,
                started_at: report.timestamp.toISOString(),
                finished_at: new Date().toISOString(),
                summary: {
                    overallHealth: report.overallHealth,
                    healthScore: report.healthScore,
                    driftAlerts: report.driftAlerts.length,
                    promptRecommendations: report.promptRecommendations.length,
                    rotationRecommendations: report.rotationRecommendations.length,
                    transferablePatterns: report.transferablePatterns.length,
                    reflexionStatus: report.reflexionStatus,
                    topActions: report.recommendedActions.slice(0, 5)
                }
            });
            if (error) {
                console.error('Failed to log report to Supabase:', error);
            }
            else {
                console.log(`✓ Report logged to Supabase: ${project}`);
            }
        }
        catch (error) {
            console.error('Supabase report logging error:', error);
        }
    }
    /**
     * Get recent reports from Supabase
     */
    async getRecentReports(limit = 20) {
        try {
            const { data, error } = await this.supabase
                .from('iris_reports')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) {
                console.error('Failed to fetch reports:', error);
                return [];
            }
            return data || [];
        }
        catch (error) {
            console.error('Supabase query error:', error);
            return [];
        }
    }
    /**
     * Get recent events from Supabase
     */
    async getRecentEvents(limit = 50, project) {
        try {
            let query = this.supabase
                .from('iris_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (project) {
                query = query.eq('project', project);
            }
            const { data, error } = await query;
            if (error) {
                console.error('Failed to fetch events:', error);
                return [];
            }
            return data || [];
        }
        catch (error) {
            console.error('Supabase query error:', error);
            return [];
        }
    }
    /**
     * Get promotions from last N days
     */
    async getRecentPromotions(days = 7) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        try {
            const { data, error } = await this.supabase
                .from('iris_events')
                .select('*')
                .eq('event_type', 'PROMOTION')
                .gte('created_at', cutoff.toISOString())
                .order('created_at', { ascending: false });
            if (error) {
                console.error('Failed to fetch promotions:', error);
                return [];
            }
            return data || [];
        }
        catch (error) {
            console.error('Supabase query error:', error);
            return [];
        }
    }
}
/**
 * Create Supabase logger
 */
export function createSupabaseLogger() {
    return new SupabaseLogger();
}
