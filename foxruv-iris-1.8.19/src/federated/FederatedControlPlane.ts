/**
 * Federated Control Plane - Main Orchestrator
 *
 * Coordinates the entire federated learning system:
 * - Aggregates telemetry from all projects
 * - Runs AI Council analysis
 * - Executes approved decisions
 * - Pushes improvements back to projects
 *
 * @module FederatedControlPlane
 */

import { EventEmitter } from 'events';
import { AICouncil } from '../council/AICouncil.js';
// Testing module not yet implemented - using placeholder
// import { PatternTestRunner } from '../testing/PatternTestRunner.js';
class PatternTestRunner {
  constructor(private readonly config?: any) {
    void this.config;
  }

  async runTests(_pattern: any): Promise<any> {
    return { passed: true, results: [] };
  }

  async runTest(...args: any[]): Promise<any> {
    return this.runTests(args[0]);
  }
}
import { VectorStore } from '../core/VectorStore.js';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TelemetryEmitter } from '../telemetry/telemetry-emitter.js';
import { GlobalMetricsCollector } from '../telemetry/global-metrics.js';
import { LLMCouncilAdvisor } from '../council/LLMCouncilAdvisor.js';
import { DraftDecisionStore } from './DraftDecisionStore.js';

type AggregationResult = {
  totalEvents: number;
  patternsDetected: Array<{
    id: string;
    sourceProject: string;
    description: string;
    pattern: any;
  }>;
  metrics: {
    crossProject: any[];
  };
};

class TelemetryAggregator {
  constructor(
    private readonly config: {
      vectorStore: VectorStore;
      supabaseClient: SupabaseClient;
      aggregationWindow: number;
      telemetrySink: TelemetryEmitter;
    },
    private readonly metricsCollector = new GlobalMetricsCollector()
  ) {}

  async aggregateAll(): Promise<AggregationResult> {
    // Avoid unused warnings while placeholders evolve
    void this.config.vectorStore;
    void this.config.supabaseClient;
    void this.config.aggregationWindow;

    // Collect recent metrics from GlobalMetricsCollector (backed by AgentDB/Supabase)
    const crossProjectMetric = await this.metricsCollector.getCrossProjectMetrics('%');
    const crossProject = crossProjectMetric ? [crossProjectMetric] : [];
    const totalEvents = 0; // placeholder until event-level aggregation is added

    // Emit aggregated telemetry snapshot via sink (non-blocking)
    this.config.telemetrySink.record({
      event_type: 'federated_aggregation',
      total_events: totalEvents,
      projects: crossProject.length,
      snapshot: crossProject,
      timestamp: new Date()
    }).catch(() => undefined);

    return {
      totalEvents,
      patternsDetected: [],
      metrics: { crossProject }
    };
  }
}

export interface ControlPlaneConfig {
  /** AgentDB vector store for pattern storage */
  vectorStore: VectorStore;

  /** Supabase for telemetry and decisions */
  supabaseUrl: string;
  supabaseKey: string;

  /** Scheduling configuration */
  intervalMinutes?: number;

  /** AI Council configuration */
  councilSize?: number;
  quorumThreshold?: number;

  /** Pattern testing configuration */
  testTrafficPercentage?: number;
  testDurationMinutes?: number;
  successThreshold?: number;

  /** Project webhooks for pushing decisions */
  projectWebhooks: Map<string, string>;

  /** Enable/disable automatic execution */
  autoExecute?: boolean;
}

export interface ControlPlaneMetrics {
  totalTelemetryEvents: number;
  patternsDetected: number;
  decisionsProposed: number;
  decisionsApproved: number;
  decisionsExecuted: number;
  patternsTransferred: number;
  averageConsensus: number;
  lastRunTime: Date;
  healthStatus: 'healthy' | 'degraded' | 'error';
}

export class FederatedControlPlane extends EventEmitter {
  private aggregator: TelemetryAggregator;
  private council: any;
  private testRunner: PatternTestRunner;
  private supabase: SupabaseClient;
  private telemetry: TelemetryEmitter;
  private advisor?: LLMCouncilAdvisor;
  private replayInterval?: NodeJS.Timeout;
  private drafts: DraftDecisionStore;

  private intervalHandle?: NodeJS.Timeout;
  private isRunning = false;
  private metrics: ControlPlaneMetrics;

  constructor(private config: ControlPlaneConfig) {
    super();

    // Initialize components
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.telemetry = new TelemetryEmitter({
      telemetryApiUrl: process.env.TELEMETRY_API_URL,
      supabaseUrl: config.supabaseUrl,
      supabaseServiceKey: config.supabaseKey,
      tableName: 'iris_telemetry'
    });
    this.advisor = new LLMCouncilAdvisor();
    this.drafts = new DraftDecisionStore();

    this.aggregator = new TelemetryAggregator({
      vectorStore: config.vectorStore,
      supabaseClient: this.supabase,
      telemetrySink: this.telemetry,
      aggregationWindow: (config.intervalMinutes || 5) * 60 * 1000,
    });

    const CouncilCtor: new (...args: any[]) => any = AICouncil as any;
    this.council = new CouncilCtor({
      vectorStore: config.vectorStore,
      supabaseClient: this.supabase,
      councilSize: config.councilSize || 5,
      quorumThreshold: config.quorumThreshold || 0.6,
    } as any) as any;

    this.testRunner = new PatternTestRunner({
      vectorStore: config.vectorStore,
      supabaseClient: this.supabase,
      testTrafficPercentage: config.testTrafficPercentage || 10,
      testDurationMinutes: config.testDurationMinutes || 60,
      successThreshold: config.successThreshold || 0.05,
    });

    this.metrics = {
      totalTelemetryEvents: 0,
      patternsDetected: 0,
      decisionsProposed: 0,
      decisionsApproved: 0,
      decisionsExecuted: 0,
      patternsTransferred: 0,
      averageConsensus: 0,
      lastRunTime: new Date(),
      healthStatus: 'healthy',
    };
  }

  /**
   * Start the control plane with scheduled execution
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Control plane already running');
    }

    this.isRunning = true;
    await this.telemetry.replayPending().catch(() => undefined);
    this.replayInterval = setInterval(() => {
      this.telemetry.replayPending().catch(() => undefined);
    }, 15 * 60 * 1000);
    const intervalMs = (this.config.intervalMinutes || 5) * 60 * 1000;

    this.emit('started', { interval: intervalMs });

    // Run immediately on start
    await this.runCycle();

    // Schedule periodic execution
    this.intervalHandle = setInterval(async () => {
      try {
        await this.runCycle();
      } catch (error) {
        this.emit('error', error);
        this.metrics.healthStatus = 'error';
      }
    }, intervalMs);
  }

  /**
   * Stop the control plane
   */
  async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    if (this.replayInterval) {
      clearInterval(this.replayInterval);
      this.replayInterval = undefined;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Execute one complete cycle of the control plane
   */
  async runCycle(): Promise<void> {
    const cycleStart = Date.now();
    this.emit('cycle:start', { timestamp: new Date() });

    try {
      // Step 1: Aggregate telemetry from all projects
      this.emit('step:aggregate', { step: 1 });
      const aggregation = await this.aggregator.aggregateAll();

      this.metrics.totalTelemetryEvents += aggregation.totalEvents;
      this.metrics.patternsDetected += aggregation.patternsDetected.length;

      this.emit('step:aggregate:complete', {
        events: aggregation.totalEvents,
        patterns: aggregation.patternsDetected.length,
      });

      // Optional AI-driven advice layer
      const decisions: any[] = [];

      if (this.advisor?.isEnabled()) {
        const advice = await this.advisor.proposeDecisions(aggregation.metrics.crossProject).catch(() => null);
        if (advice) {
          const advisory = this.buildAdvisorDecisions(advice);
          decisions.push(...advisory);
          this.metrics.decisionsProposed += advisory.length;

          for (const draft of advisory) {
            await this.drafts.createDraft(draft);
          }

          this.telemetry.record({
            event_type: 'ai_council_advice',
            recommendations: advice.recommendations,
            rationale: advice.rationale,
            timestamp: new Date()
          }).catch(() => undefined);
        }
      }

      // Step 2: Run AI Council analysis on detected patterns
      this.emit('step:council', { step: 2 });

      for (const pattern of aggregation.patternsDetected) {
        const decision = await this.council.analyze({
          patternId: pattern.id,
          sourceProject: pattern.sourceProject,
          targetProjects: this.getEligibleTargets(pattern.sourceProject),
          proposedChange: {
            type: 'pattern_transfer',
            description: pattern.description,
            pattern: pattern.pattern,
          },
        });

        decisions.push(decision);
        this.metrics.decisionsProposed++;

        if (decision.approved) {
          this.metrics.decisionsApproved++;
        }
      }

      this.emit('step:council:complete', {
        decisions: decisions.length,
        approved: decisions.filter(d => d.approved).length,
      });

      // Step 3: Execute approved decisions
      if (this.config.autoExecute) {
        this.emit('step:execute', { step: 3 });

        for (const decision of decisions.filter(d => d.approved && !d.advisory)) {
          await this.executeDecision(decision);
          this.metrics.decisionsExecuted++;
        }

        this.emit('step:execute:complete', {
          executed: decisions.filter(d => d.approved).length,
        });
      }

      // Step 4: Update metrics
      const approvedDecisions = decisions.filter(d => d.approved);
      if (approvedDecisions.length > 0) {
        this.metrics.averageConsensus =
          approvedDecisions.reduce((sum, d) => sum + d.consensusScore, 0) /
          approvedDecisions.length;
      }

      this.metrics.lastRunTime = new Date();
      this.metrics.healthStatus = 'healthy';

      const cycleDuration = Date.now() - cycleStart;

      this.emit('cycle:complete', {
        duration: cycleDuration,
        metrics: this.metrics,
      });

      // Store cycle results in Supabase
      await this.storeCycleResults({
        timestamp: new Date(),
        duration: cycleDuration,
        telemetryEvents: aggregation.totalEvents,
        patternsDetected: aggregation.patternsDetected.length,
        decisionsProposed: decisions.length,
        decisionsApproved: approvedDecisions.length,
        metrics: this.metrics,
      });

    } catch (error) {
      this.metrics.healthStatus = 'error';
      this.emit('cycle:error', error);
      throw error;
    }
  }

  /**
   * Execute an approved AI Council decision
   */
  private async executeDecision(decision: any): Promise<void> {
    this.emit('decision:execute:start', { decisionId: decision.id });

    try {
      // Test pattern on target projects
      const testResults = await this.testRunner.runTest({
        patternId: decision.patternId,
        targetProjects: decision.targetProjects,
        trafficPercentage: this.config.testTrafficPercentage || 10,
      });

      this.emit('decision:test:complete', { testResults });

      // If tests pass, push pattern to projects
      const successfulTargets = testResults.filter((r: any) => r.success);

      for (const target of successfulTargets) {
        await this.pushToProject(target.project, {
          type: 'pattern_deployment',
          patternId: decision.patternId,
          decision: decision,
          testResults: target,
        });

        this.metrics.patternsTransferred++;
      }

      // Mark pattern as universal if successful on all targets
      if (successfulTargets.length === decision.targetProjects.length) {
        await this.markPatternAsUniversal(decision.patternId);
      }

      this.emit('decision:execute:complete', {
        decisionId: decision.id,
        successfulTargets: successfulTargets.length,
        totalTargets: decision.targetProjects.length,
      });

    } catch (error) {
      this.emit('decision:execute:error', { decisionId: decision.id, error });
      throw error;
    }
  }

  /**
   * Push approved pattern to target project via webhook
   */
  private async pushToProject(project: string, payload: any): Promise<void> {
    const webhookUrl = this.config.projectWebhooks.get(project);

    if (!webhookUrl) {
      throw new Error(`No webhook configured for project: ${project}`);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-FoxRUV-Prime': 'federated-control-plane',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to push to ${project}: ${response.statusText}`);
    }

    this.emit('project:push', { project, payload });
  }

  /**
   * Get eligible target projects for pattern transfer
   */
  private getEligibleTargets(sourceProject: string): string[] {
    return Array.from(this.config.projectWebhooks.keys())
      .filter(project => project !== sourceProject);
  }

  /**
   * Mark pattern as universal (successful on all projects)
   */
  private async markPatternAsUniversal(patternId: string): Promise<void> {
    await this.supabase
      .from('patterns')
      .update({
        status: 'universal',
        universalAt: new Date().toISOString(),
      })
      .eq('id', patternId);

    this.emit('pattern:universal', { patternId });
  }

  /**
   * Store cycle results in Supabase for analytics
   */
  private async storeCycleResults(results: any): Promise<void> {
    await this.supabase
      .from('control_plane_cycles')
      .insert({
        timestamp: results.timestamp.toISOString(),
        duration_ms: results.duration,
        telemetry_events: results.telemetryEvents,
        patterns_detected: results.patternsDetected,
        decisions_proposed: results.decisionsProposed,
        decisions_approved: results.decisionsApproved,
        metrics: results.metrics,
      });
  }

  /**
   * Get current control plane metrics
   */
  getMetrics(): ControlPlaneMetrics {
    return { ...this.metrics };
  }

  /**
   * Get control plane health status
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'error';
    uptime: number;
    lastCycle: Date;
    components: Record<string, boolean>;
  }> {
    const components = {
      aggregator: true,
      council: true,
      testRunner: true,
      supabase: false,
    };

    // Test Supabase connection
    try {
      await this.supabase.from('control_plane_cycles').select('count').limit(1);
      components.supabase = true;
    } catch (error) {
      components.supabase = false;
    }

    const allHealthy = Object.values(components).every(v => v);

    return {
      status: allHealthy ? this.metrics.healthStatus : 'degraded',
      uptime: Date.now() - this.metrics.lastRunTime.getTime(),
      lastCycle: this.metrics.lastRunTime,
      components,
    };
  }

  /**
   * Manually trigger a decision analysis
   */
  async analyzePattern(patternId: string, targetProjects: string[]): Promise<any> {
    const pattern = await this.config.vectorStore.retrieve([patternId]);

    if (pattern.length === 0) {
      throw new Error(`Pattern not found: ${patternId}`);
    }

    return this.council.analyze({
      patternId,
      sourceProject: pattern[0].metadata.project,
      targetProjects,
      proposedChange: {
        type: 'pattern_transfer',
        description: pattern[0].metadata.description,
        pattern: pattern[0],
      },
    });
  }

  private buildAdvisorDecisions(advice: any): any[] {
    if (!advice?.recommendations || advice.recommendations.length === 0) return [];
    return advice.recommendations.map((rec: string, idx: number) => ({
      id: `ai-advice-${Date.now()}-${idx}`,
      advisory: true,
      approved: false,
      consensusScore: 1,
      recommendation: rec,
      rationale: advice.rationale,
      proposedChange: {
        type: 'pattern_transfer',
        description: rec,
        confidence: advice?.confidence || 0.5
      }
    }));
  }

  /**
   * Manually test a pattern on target projects
   */
  async testPattern(patternId: string, targetProjects: string[]): Promise<any[]> {
    return this.testRunner.runTest({
      patternId,
      targetProjects,
      trafficPercentage: this.config.testTrafficPercentage || 10,
    });
  }
}

export default FederatedControlPlane;
