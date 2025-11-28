/**
 * Supabase integration for MCP skill tracking
 */

import { getSupabase, isSupabaseInitialized } from '../../supabase/client.js';

export interface McpInvocationLog {
  skill_id: string;
  tool_name: string;
  args: Record<string, any>;
  success: boolean;
  latency_ms?: number;
  error_message?: string;
  result_summary?: string;
  project_name?: string;
  user_id?: string;
}

export class SupabaseMcpTracker {
  async logInvocation(log: McpInvocationLog): Promise<void> {
    try {
      if (!isSupabaseInitialized()) {
        console.warn('Supabase client not initialized for MCP tracking');
        return;
      }
      const client = getSupabase();

      await client.from('mcp_invocations').insert({
        skill_id: log.skill_id,
        tool_name: log.tool_name,
        args: log.args,
        success: log.success,
        latency_ms: log.latency_ms,
        error_message: log.error_message,
        result_summary: log.result_summary,
        project_name: log.project_name || process.env.PROJECT_NAME,
        user_id: log.user_id || process.env.USER_ID,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log MCP invocation to Supabase:', error);
    }
  }

  async getSkillStats(skillId: string, projectName?: string): Promise<any> {
    try {
      if (!isSupabaseInitialized()) return null;
      const client = getSupabase();

      let query = client
        .from('mcp_invocations')
        .select('*')
        .eq('skill_id', skillId);

      if (projectName) {
        query = query.eq('project_name', projectName);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          skillId,
          totalInvocations: 0,
          successRate: 0,
          avgLatency: 0,
          tools: {}
        };
      }

      const stats = {
        skillId,
        totalInvocations: data.length,
        successRate: data.filter(d => d.success).length / data.length,
        avgLatency: data.reduce((sum: number, d: any) => sum + (d.latency_ms || 0), 0) / data.length,
        tools: data.reduce((acc: any, d: any) => {
          const tool = d.tool_name;
          if (!acc[tool]) {
            acc[tool] = {
              count: 0,
              successCount: 0,
              latencies: []
            };
          }
          acc[tool].count++;
          if (d.success) acc[tool].successCount++;
          if (d.latency_ms) acc[tool].latencies.push(d.latency_ms);
          return acc;
        }, {}),
        recentErrors: data
          .filter((d: any) => !d.success)
          .slice(-5)
          .map((d: any) => ({
            tool: d.tool_name,
            error: d.error_message,
            timestamp: d.timestamp
          }))
      };

      // Calculate per-tool stats
      Object.keys(stats.tools).forEach(tool => {
        const t = stats.tools[tool];
        t.successRate = t.successCount / t.count;
        t.avgLatency = t.latencies.length > 0
          ? t.latencies.reduce((a: number, b: number) => a + b, 0) / t.latencies.length
          : 0;
        delete t.latencies; // Don't include raw data
      });

      return stats;
    } catch (error) {
      console.error('Failed to get skill stats from Supabase:', error);
      return null;
    }
  }

  async getDriftDetection(skillId: string, windowDays: number = 7): Promise<any> {
    try {
      if (!isSupabaseInitialized()) return null;
      const client = getSupabase();

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - windowDays);

      const { data, error } = await client
        .from('mcp_invocations')
        .select('*')
        .eq('skill_id', skillId)
        .gte('timestamp', cutoff.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;
      if (!data || data.length < 10) {
        return { hasDrift: false, reason: 'Insufficient data' };
      }

      // Split into two halves to detect drift
      const mid = Math.floor(data.length / 2);
      const firstHalf = data.slice(0, mid);
      const secondHalf = data.slice(mid);

      const firstSuccess = firstHalf.filter(d => d.success).length / firstHalf.length;
      const secondSuccess = secondHalf.filter(d => d.success).length / secondHalf.length;

      const driftThreshold = 0.15; // 15% change in success rate
      const hasDrift = Math.abs(firstSuccess - secondSuccess) > driftThreshold;

      return {
        hasDrift,
        firstHalfSuccessRate: firstSuccess,
        secondHalfSuccessRate: secondSuccess,
        drift: secondSuccess - firstSuccess,
        recommendation: hasDrift
          ? 'Success rate changed significantly - consider investigating'
          : 'Performance stable'
      };
    } catch (error) {
      console.error('Failed to detect drift:', error);
      return null;
    }
  }
}

let supabaseTracker: SupabaseMcpTracker | null = null;

export function getSupabaseMcpTracker(): SupabaseMcpTracker {
  if (!supabaseTracker) {
    supabaseTracker = new SupabaseMcpTracker();
  }
  return supabaseTracker;
}
