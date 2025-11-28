/**
 * Analytics and time-series data helpers
 * Provides trend analysis and visualization data for dashboards
 */
import { getSupabase } from './client.js';
import { withRetry } from './retry-wrapper.js';
/**
 * Get health trends over time for a project
 * Returns time-series data for health score chart
 */
export async function getHealthTrends(projectId, hours = 24) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        const { data, error } = await supabase
            .from('iris_reports')
            .select('created_at, health_score')
            .eq('project', projectId)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });
        if (error)
            throw new Error(`Failed to get health trends: ${error.message}`);
        if (!data || data.length === 0)
            return [];
        return data.map(report => ({
            time: report.created_at,
            healthScore: report.health_score,
        }));
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get success rate trends over time
 * Returns time-series data for success rate chart
 */
export async function getSuccessRateTrends(projectId, hours = 24) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        const { data, error } = await supabase
            .from('model_run_log')
            .select('timestamp, outcome, error_message')
            .eq('project', projectId)
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: true });
        if (error)
            throw new Error(`Failed to get success rate trends: ${error.message}`);
        if (!data || data.length === 0)
            return [];
        // Group by hour
        const hourlyMap = new Map();
        data.forEach(log => {
            const timestamp = new Date(log.timestamp);
            const hourKey = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours()).toISOString();
            if (!hourlyMap.has(hourKey)) {
                hourlyMap.set(hourKey, { total: 0, success: 0 });
            }
            const stats = hourlyMap.get(hourKey);
            stats.total++;
            if (log.outcome === 'success' && !log.error_message) {
                stats.success++;
            }
        });
        // Calculate success rate for each hour
        const trends = Array.from(hourlyMap.entries()).map(([time, stats]) => ({
            time,
            successRate: stats.total > 0 ? stats.success / stats.total : 0,
        }));
        return trends.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get latency trends over time
 * Returns time-series data for latency chart
 */
export async function getLatencyTrends(projectId, hours = 24) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        const { data, error } = await supabase
            .from('model_run_log')
            .select('timestamp, latency_ms')
            .eq('project', projectId)
            .gte('timestamp', startDate.toISOString())
            .not('latency_ms', 'is', null)
            .order('timestamp', { ascending: true });
        if (error)
            throw new Error(`Failed to get latency trends: ${error.message}`);
        if (!data || data.length === 0)
            return [];
        // Group by hour
        const hourlyMap = new Map();
        data.forEach(log => {
            const timestamp = new Date(log.timestamp);
            const hourKey = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours()).toISOString();
            if (!hourlyMap.has(hourKey)) {
                hourlyMap.set(hourKey, []);
            }
            hourlyMap.get(hourKey).push(log.latency_ms);
        });
        // Calculate average latency for each hour
        const trends = Array.from(hourlyMap.entries()).map(([time, latencies]) => {
            const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            return {
                time,
                avgLatency,
            };
        });
        return trends.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get reflexion impact statistics
 * Returns reflexion usage and impact metrics
 */
export async function getReflexionImpactStats(projectId) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('reflexion_bank')
            .select('reflexion_type, impact_score, success')
            .eq('project', projectId);
        if (error)
            throw new Error(`Failed to get reflexion impact stats: ${error.message}`);
        if (!data || data.length === 0)
            return [];
        // Group by reflexion type
        const typeMap = new Map();
        data.forEach(reflexion => {
            const type = reflexion.reflexion_type || 'unknown';
            if (!typeMap.has(type)) {
                typeMap.set(type, { count: 0, totalImpact: 0 });
            }
            const stats = typeMap.get(type);
            stats.count++;
            stats.totalImpact += reflexion.impact_score || 0;
        });
        // Calculate average impact for each type
        const impactStats = Array.from(typeMap.entries()).map(([category, stats]) => ({
            category,
            count: stats.count,
            avg_impact: stats.count > 0 ? stats.totalImpact / stats.count : 0,
        }));
        return impactStats.sort((a, b) => b.count - a.count);
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get token consumption trends over time
 * Returns time-series data for token usage chart
 */
export async function getTokenConsumptionTrends(projectId, hours = 24) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        const { data, error } = await supabase
            .from('model_run_log')
            .select('timestamp, tokens_in, tokens_out, cost_usd')
            .eq('project', projectId)
            .gte('timestamp', startDate.toISOString())
            .order('timestamp', { ascending: true });
        if (error)
            throw new Error(`Failed to get token consumption trends: ${error.message}`);
        if (!data || data.length === 0)
            return [];
        // Group by hour
        const hourlyMap = new Map();
        data.forEach(log => {
            const timestamp = new Date(log.timestamp);
            const hourKey = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate(), timestamp.getHours()).toISOString();
            if (!hourlyMap.has(hourKey)) {
                hourlyMap.set(hourKey, { tokensIn: 0, tokensOut: 0, cost: 0 });
            }
            const stats = hourlyMap.get(hourKey);
            stats.tokensIn += log.tokens_in || 0;
            stats.tokensOut += log.tokens_out || 0;
            stats.cost += parseFloat(log.cost_usd || '0') || 0;
        });
        // Create time-series data
        const trends = Array.from(hourlyMap.entries()).map(([time, stats]) => ({
            time,
            totalTokens: stats.tokensIn + stats.tokensOut,
            tokensIn: stats.tokensIn,
            tokensOut: stats.tokensOut,
            cost: stats.cost,
        }));
        return trends.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }, { maxRetries: 3, timeoutMs: 30000 });
}
/**
 * Get error distribution by type
 * Returns error categories and their frequencies
 */
export async function getErrorDistribution(projectId, hours = 24) {
    return await withRetry(async () => {
        const supabase = getSupabase();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - hours);
        const { data, error } = await supabase
            .from('model_run_log')
            .select('error_message')
            .eq('project', projectId)
            .gte('timestamp', startDate.toISOString())
            .not('error_message', 'is', null);
        if (error)
            throw new Error(`Failed to get error distribution: ${error.message}`);
        if (!data || data.length === 0)
            return [];
        // Categorize errors
        const errorMap = new Map();
        const totalErrors = data.length;
        data.forEach(log => {
            // Simple categorization - can be enhanced with more sophisticated parsing
            const errorMsg = log.error_message || 'Unknown';
            let category = 'Other';
            if (errorMsg.toLowerCase().includes('timeout'))
                category = 'Timeout';
            else if (errorMsg.toLowerCase().includes('rate limit'))
                category = 'Rate Limit';
            else if (errorMsg.toLowerCase().includes('auth'))
                category = 'Authentication';
            else if (errorMsg.toLowerCase().includes('network'))
                category = 'Network';
            else if (errorMsg.toLowerCase().includes('parse'))
                category = 'Parsing';
            else if (errorMsg.toLowerCase().includes('validation'))
                category = 'Validation';
            errorMap.set(category, (errorMap.get(category) || 0) + 1);
        });
        // Convert to array with percentages
        const distribution = Array.from(errorMap.entries()).map(([errorType, count]) => ({
            errorType,
            count,
            percentage: (count / totalErrors) * 100,
        }));
        return distribution.sort((a, b) => b.count - a.count);
    }, { maxRetries: 3, timeoutMs: 30000 });
}
