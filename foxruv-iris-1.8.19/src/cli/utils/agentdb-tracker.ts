/**
 * AgentDB integration for MCP skill tracking
 */

import { AgentDBManager } from '../../storage/agentdb-integration.js';

export interface McpInvocation {
  skillId: string;
  tool: string;
  args: Record<string, any>;
  timestamp: number;
  success: boolean;
  latency?: number;
  error?: string;
  result?: any;
}

export class McpTracker {
  private agentDb: AgentDBManager | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize AgentDB if available
      const { createAgentDB } = await import('../../storage/agentdb-integration.js');
      this.agentDb = createAgentDB({
        dbPath: '.iris/agentdb'
      });
      this.initialized = true;
    } catch (error) {
      // AgentDB not available or failed to initialize - gracefully degrade
      console.warn('AgentDB tracking unavailable:', error);
      this.initialized = true; // Don't keep trying
    }
  }

  async trackInvocation(invocation: McpInvocation): Promise<void> {
    if (!this.agentDb) {
      await this.initialize();
    }

    if (!this.agentDb) {
      // Tracking not available
      return;
    }

    try {
      // Store as expert embedding for semantic search
      await this.agentDb.storeExpertEmbedding({
        expertId: `mcp:${invocation.skillId}:${invocation.tool}`,
        name: `${invocation.skillId}`,
        signature: JSON.stringify({
          tool: invocation.tool,
          args: invocation.args
        }),
        embedding: new Array(1536).fill(0), // Placeholder - ideally would generate real embedding
        performance: invocation.success ? 1.0 : 0.0,
        metadata: {
          skillId: invocation.skillId,
          tool: invocation.tool,
          success: invocation.success,
          latency: invocation.latency,
          timestamp: invocation.timestamp
        }
      });

      // Also track as causal decision for pattern learning
      if (invocation.success) {
        await this.agentDb.recordCausalDecision({
          id: `${invocation.skillId}-${invocation.tool}-${invocation.timestamp}`,
          timestamp: new Date(invocation.timestamp),
          expertId: `mcp:${invocation.skillId}`,
          input: invocation.args,
          output: invocation.result,
          reasoning: [`MCP tool ${invocation.tool} invoked successfully`],
          causality: {
            causes: [JSON.stringify(invocation.args)],
            effects: [JSON.stringify(invocation.result)],
            confidence: 1.0
          },
          outcome: {
            success: true,
            metrics: {
              latency: invocation.latency || 0
            }
          }
        });
      }
    } catch (error) {
      console.error('Failed to track MCP invocation:', error);
    }
  }

  async getSkillMetrics(skillId: string): Promise<any> {
    if (!this.agentDb) {
      await this.initialize();
    }

    if (!this.agentDb) {
      return null;
    }

    try {
      // Search for all experts related to this MCP (simplified version)
      // In a real implementation, would use findSimilarExperts with proper embedding
      const expertId = `mcp:${skillId}`;
      const expert = await this.agentDb.getExpert(expertId);

      if (!expert) {
        return {
          skillId,
          totalInvocations: 0,
          tools: {}
        };
      }

      return {
        skillId,
        totalInvocations: 1,
        performance: expert.performance,
        tools: {}
      };
    } catch (error) {
      console.error('Failed to get skill metrics:', error);
      return null;
    }
  }
}

// Singleton instance
let tracker: McpTracker | null = null;

export function getMcpTracker(): McpTracker {
  if (!tracker) {
    tracker = new McpTracker();
  }
  return tracker;
}
