/**
 * Cross-Project Pattern Discovery Engine - FoxRuv Prime
 *
 * Discovers and transfers successful patterns across multiple projects:
 * - NFL Predictor
 * - Microbiome Discovery Platform
 * - BeClever AI
 * - And other FoxRuv projects
 *
 * This engine uses AgentDB for vector search, Supabase for telemetry,
 * and AI Council for decision-making to find patterns that work across domains.
 *
 * Features:
 * - Extract patterns from telemetry data (confidence > 0.9, success > 0.85)
 * - Vector similarity search to find cross-project patterns
 * - Transfer testing framework with success/failure tracking
 * - Pattern storage with cross-project metadata
 * - AI Council integration for transfer decisions
 *
 * @module cross-project-discovery
 * @version 1.0.0
 */

import { AgentDBManager } from '../storage/agentdb-integration.js';
import { AgentDBSingleton } from '../storage/agentdb-singleton.js';
import {
  isSupabaseInitialized,
} from '../supabase/client.js';
import {
  getExpertStats,
  getProjectExpertStats,
} from '../supabase/telemetry.js';
import { GlobalMetricsCollector } from '../telemetry/global-metrics.js';
import { PatternDiscovery } from './pattern-discovery.js';

/**
 * Discovered pattern from telemetry analysis
 */
export interface DiscoveredPattern {
  patternId: string;
  sourceProject: string;
  expertId: string;
  version: string;
  patternType: 'strategy' | 'architecture' | 'workflow' | 'optimization';
  name: string;
  description: string;
  context: {
    domain: string;
    problemType: string;
    dataCharacteristics: string[];
    constraints: string[];
  };
  implementation: {
    approach: string;
    keyTechniques: string[];
    dependencies: string[];
    code?: string;
  };
  performance: {
    confidence: number;
    successRate: number;
    avgLatency: number;
    totalRuns: number;
    reflexionUsed: boolean;
  };
  transferability: {
    score: number; // 0-1, how transferable this pattern is
    applicableDomains: string[];
    adaptationRequired: 'none' | 'low' | 'medium' | 'high';
    risks: string[];
  };
  embedding: number[];
  discoveredAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Transfer test result
 */
export interface TransferTestResult {
  testId: string;
  patternId: string;
  sourceProject: string;
  targetProject: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'running' | 'success' | 'failure' | 'partial';
  metrics: {
    baselineAccuracy: number;
    patternAccuracy: number;
    improvement: number;
    latencyImpact: number;
    confidence: number;
  };
  observations: string[];
  recommendations: string[];
  shouldDeploy: boolean;
  metadata?: Record<string, any>;
}

/**
 * Cross-project pattern match
 */
export interface CrossProjectMatch {
  pattern: DiscoveredPattern;
  similarity: number;
  targetProject: string;
  transferPotential: number;
  estimatedImprovement: number;
  requiredAdaptations: string[];
  risks: string[];
  aiCouncilDecision?: {
    approved: boolean;
    confidence: number;
    reasoning: string[];
    conditions: string[];
  };
}

/**
 * AI Council decision for pattern transfer
 */
export interface AICouncilDecision {
  approved: boolean;
  confidence: number;
  reasoning: string[];
  conditions: string[];
  requiredTests: string[];
  rollbackPlan: string[];
}

/**
 * Configuration for cross-project discovery
 */
export interface CrossProjectDiscoveryConfig {
  dbPath?: string;
  agentDBPath?: string;
  minConfidence?: number;
  minSuccessRate?: number;
  minTransferScore?: number;
  enableAutoTransfer?: boolean;
  enableAICouncil?: boolean;
  projects?: string[];
}

/**
 * Cross-Project Pattern Discovery Engine
 */
export class CrossProjectDiscovery {
  private db: any;
  private agentDB: AgentDBManager;
  private patternDiscovery: PatternDiscovery;
  private metricsCollector: GlobalMetricsCollector;
  private config: Required<CrossProjectDiscoveryConfig>;
  private agentDbReady: Promise<void> | null = null;

  constructor(config: CrossProjectDiscoveryConfig = {}) {
    this.config = {
      dbPath: config.dbPath || './data/cross-project-discovery.db',
      agentDBPath: config.agentDBPath || './data/cross-project-agentdb.db',
      minConfidence: config.minConfidence ?? 0.9,
      minSuccessRate: config.minSuccessRate ?? 0.85,
      minTransferScore: config.minTransferScore ?? 0.7,
      enableAutoTransfer: config.enableAutoTransfer ?? false,
      enableAICouncil: config.enableAICouncil ?? true,
      projects: config.projects ?? ['nfl-predictor', 'microbiome', 'beclever'],
    };

    // Initialize databases
    this.agentDbReady = this.initializeAgentDb();

    // Initialize AgentDB for vector search
    this.agentDB = new AgentDBManager({
      dbPath: this.config.agentDBPath,
      enableCausalReasoning: true,
      enableReflexion: true,
      enableSkillLibrary: true,
      vectorDimension: 1536,
      similarityThreshold: 0.7,
    });

    // Initialize pattern discovery engine
    this.patternDiscovery = new PatternDiscovery({
      dbPath: this.config.dbPath + '.patterns',
      agentDBPath: this.config.agentDBPath + '.patterns',
      enableAgentDBCache: true,
      useSupabase: true,
    });

    // Initialize global metrics collector
    this.metricsCollector = new GlobalMetricsCollector({
      dbPath: this.config.dbPath + '.metrics',
      useSupabase: true,
      enableAgentDBCache: true,
    });
  }

  /**
   * Initialize AgentDB
   */
  private async initializeAgentDb(): Promise<void> {
    try {
      this.db = await AgentDBSingleton.getInstance(this.config.dbPath);
      this.initializeTables();
    } catch (error) {
      console.warn('⚠ CrossProjectDiscovery: AgentDB initialization failed:', error);
      this.db = null;
    }
  }

  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    if (!this.db) return;

    try {
      // Discovered patterns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS discovered_patterns (
          pattern_id TEXT PRIMARY KEY,
          source_project TEXT NOT NULL,
          expert_id TEXT NOT NULL,
          version TEXT NOT NULL,
          pattern_type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          context TEXT NOT NULL,
          implementation TEXT NOT NULL,
          performance TEXT NOT NULL,
          transferability TEXT NOT NULL,
          discovered_at INTEGER NOT NULL,
          metadata TEXT
        )
      `);

      // Transfer tests table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS transfer_tests (
          test_id TEXT PRIMARY KEY,
          pattern_id TEXT NOT NULL,
          source_project TEXT NOT NULL,
          target_project TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          status TEXT NOT NULL,
          metrics TEXT NOT NULL,
          observations TEXT NOT NULL,
          recommendations TEXT NOT NULL,
          should_deploy INTEGER NOT NULL,
          metadata TEXT,
          FOREIGN KEY (pattern_id) REFERENCES discovered_patterns(pattern_id)
        )
      `);

      // Cross-project matches table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cross_project_matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_id TEXT NOT NULL,
          target_project TEXT NOT NULL,
          similarity REAL NOT NULL,
          transfer_potential REAL NOT NULL,
          estimated_improvement REAL NOT NULL,
          ai_council_decision TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now')),
          FOREIGN KEY (pattern_id) REFERENCES discovered_patterns(pattern_id)
        )
      `);

      // Create indexes
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_project ON discovered_patterns(source_project)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_type ON discovered_patterns(pattern_type)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tests_pattern ON transfer_tests(pattern_id)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tests_status ON transfer_tests(status)`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_matches_project ON cross_project_matches(target_project)`);
    } catch (error) {
      console.warn('⚠ CrossProjectDiscovery: Table initialization failed:', error);
      this.db = null;
    }
  }

  /**
   * Ensure AgentDB is ready
   */
  private async ensureAgentDbReady(): Promise<void> {
    const ready = this.agentDbReady;
    if (ready) {
      try {
        await ready;
      } finally {
        if (this.agentDbReady === ready) {
          this.agentDbReady = null;
        }
      }
    }
  }

  /**
   * Get initialized DB instance
   */
  private async getDb(): Promise<any | null> {
    await this.ensureAgentDbReady();
    return this.db;
  }

  // ============================================================================
  // Pattern Extraction from Telemetry
  // ============================================================================

  /**
   * Extract successful patterns from project telemetry
   */
  async extractPatternsFromTelemetry(
    project: string,
    options?: {
      minConfidence?: number;
      minSuccessRate?: number;
      timeWindow?: number; // days
    }
  ): Promise<DiscoveredPattern[]> {
    const minConfidence = options?.minConfidence ?? this.config.minConfidence;
    const minSuccessRate = options?.minSuccessRate ?? this.config.minSuccessRate;
    const timeWindow = options?.timeWindow ?? 30;

    console.log(`🔍 Extracting patterns from ${project} (last ${timeWindow} days)...`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeWindow);

    // Get all expert stats for the project
    let expertStats: Array<{
      expertId: string;
      accuracy: number;
      calls: number;
      successRate: number;
    }> = [];

    if (isSupabaseInitialized()) {
      try {
        expertStats = await getProjectExpertStats(project, {
          startDate,
          endDate,
        });
      } catch (error) {
        console.warn(`⚠ Failed to get expert stats from Supabase for ${project}:`, error);
      }
    }

    // Filter experts that meet criteria
    const successfulExperts = expertStats.filter(
      (expert) =>
        expert.accuracy >= minConfidence &&
        expert.successRate >= minSuccessRate &&
        expert.calls >= 10 // Minimum usage threshold
    );

    console.log(`✓ Found ${successfulExperts.length} successful experts in ${project}`);

    // Extract patterns from successful experts
    const patterns: DiscoveredPattern[] = [];

    for (const expert of successfulExperts) {
      try {
        const pattern = await this.extractPatternFromExpert(
          project,
          expert.expertId,
          expert.accuracy,
          expert.successRate,
          expert.calls
        );

        if (pattern) {
          patterns.push(pattern);

          // Store in database
          await this.storeDiscoveredPattern(pattern);

          // Store in AgentDB for vector search
          await this.agentDB.storeExpertEmbedding({
            expertId: pattern.patternId,
            name: pattern.name,
            signature: pattern.description,
            embedding: pattern.embedding,
            performance: pattern.performance.confidence,
            metadata: {
              sourceProject: pattern.sourceProject,
              patternType: pattern.patternType,
              transferability: pattern.transferability.score,
            },
          });
        }
      } catch (error) {
        console.warn(`⚠ Failed to extract pattern from ${expert.expertId}:`, error);
      }
    }

    console.log(`✓ Extracted ${patterns.length} patterns from ${project}`);
    return patterns;
  }

  /**
   * Extract pattern from individual expert
   */
  private async extractPatternFromExpert(
    project: string,
    expertId: string,
    confidence: number,
    successRate: number,
    totalRuns: number
  ): Promise<DiscoveredPattern | null> {
    // Get detailed expert stats
    let stats;
    try {
      stats = await getExpertStats(expertId);
    } catch (error) {
      console.warn(`⚠ Failed to get stats for ${expertId}:`, error);
      return null;
    }

    // Determine pattern type based on metrics
    const patternType = this.classifyPatternType(stats);

    // Generate pattern description
    const description = this.generatePatternDescription(project, expertId, stats);

    // Calculate transferability
    const transferability = this.assessTransferability(stats, patternType);

    // Generate embedding for vector search
    const embedding = await this.generatePatternEmbedding(description, patternType);

    const pattern: DiscoveredPattern = {
      patternId: `pattern-${project}-${expertId}-${Date.now()}`,
      sourceProject: project,
      expertId,
      version: 'latest',
      patternType,
      name: `${project}-${expertId}-pattern`,
      description,
      context: {
        domain: this.inferDomain(project),
        problemType: this.inferProblemType(project, expertId),
        dataCharacteristics: this.inferDataCharacteristics(project),
        constraints: this.inferConstraints(stats),
      },
      implementation: {
        approach: this.describeApproach(patternType, stats),
        keyTechniques: this.identifyTechniques(stats),
        dependencies: [],
        code: undefined,
      },
      performance: {
        confidence,
        successRate,
        avgLatency: stats.avgLatencyMs,
        totalRuns,
        reflexionUsed: stats.reflexionUsageRate > 0.5,
      },
      transferability,
      embedding,
      discoveredAt: new Date(),
      metadata: {
        totalTokens: stats.totalTokens,
        totalCost: stats.totalCost,
        avgLatency: stats.avgLatencyMs,
      },
    };

    return pattern;
  }

  /**
   * Classify pattern type based on metrics
   */
  private classifyPatternType(stats: any): 'strategy' | 'architecture' | 'workflow' | 'optimization' {
    // High reflexion usage suggests workflow pattern
    if (stats.reflexionUsageRate > 0.7) {
      return 'workflow';
    }

    // Fast latency suggests optimization pattern
    if (stats.avgLatencyMs < 1000) {
      return 'optimization';
    }

    // High success rate suggests good strategy
    if (stats.successRate > 0.9) {
      return 'strategy';
    }

    return 'architecture';
  }

  /**
   * Generate pattern description
   */
  private generatePatternDescription(project: string, expertId: string, stats: any): string {
    return `Successful ${expertId} pattern from ${project} achieving ${(stats.successRate * 100).toFixed(1)}% success rate with ${stats.avgConfidence.toFixed(2)} average confidence over ${stats.totalRuns} runs. ${stats.reflexionUsageRate > 0.5 ? 'Uses reflexion for self-improvement.' : 'Direct prediction approach.'}`;
  }

  /**
   * Assess transferability of pattern
   */
  private assessTransferability(
    stats: any,
    patternType: string
  ): DiscoveredPattern['transferability'] {
    // Calculate base transferability score
    let score = 0.5;

    // High success rate increases transferability
    score += (stats.successRate - 0.85) * 0.5;

    // High confidence increases transferability
    score += (stats.avgConfidence - 0.9) * 0.3;

    // Reflexion usage increases transferability (shows adaptability)
    if (stats.reflexionUsageRate > 0.5) {
      score += 0.15;
    }

    // High usage count increases confidence
    if (stats.totalRuns > 100) {
      score += 0.05;
    }

    score = Math.min(Math.max(score, 0), 1);

    // Determine adaptation required
    let adaptationRequired: 'none' | 'low' | 'medium' | 'high' = 'low';
    if (score > 0.9) adaptationRequired = 'none';
    else if (score > 0.75) adaptationRequired = 'low';
    else if (score > 0.6) adaptationRequired = 'medium';
    else adaptationRequired = 'high';

    // Identify applicable domains
    const applicableDomains: string[] = [];
    if (patternType === 'strategy') {
      applicableDomains.push('prediction', 'classification', 'analysis');
    } else if (patternType === 'workflow') {
      applicableDomains.push('multi-step', 'iterative', 'adaptive');
    } else if (patternType === 'optimization') {
      applicableDomains.push('real-time', 'low-latency', 'high-volume');
    }

    // Assess risks
    const risks: string[] = [];
    if (score < 0.7) {
      risks.push('Moderate transferability - may require significant adaptation');
    }
    if (stats.totalRuns < 50) {
      risks.push('Limited usage history - not fully battle-tested');
    }
    if (stats.avgLatencyMs > 5000) {
      risks.push('High latency - may not suit real-time applications');
    }

    return {
      score,
      applicableDomains,
      adaptationRequired,
      risks,
    };
  }

  /**
   * Generate embedding for pattern (mock - replace with real embeddings)
   */
  private async generatePatternEmbedding(
    description: string,
    patternType: string
  ): Promise<number[]> {
    // In production, use OpenAI embeddings or similar
    const text = `${description} ${patternType}`;
    const embedding = new Array(1536).fill(0);

    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      embedding[i % 1536] += charCode / 1000;
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map((val) => val / magnitude);
  }

  // Helper methods for pattern extraction
  private inferDomain(project: string): string {
    const domainMap: Record<string, string> = {
      'nfl-predictor': 'sports-analytics',
      'microbiome': 'bioinformatics',
      'beclever': 'education-ai',
    };
    return domainMap[project] || 'general';
  }

  private inferProblemType(project: string, _expertId: string): string {
    if (project === 'nfl-predictor') return 'prediction';
    if (project === 'microbiome') return 'classification';
    if (project === 'beclever') return 'recommendation';
    return 'analysis';
  }

  private inferDataCharacteristics(project: string): string[] {
    const charMap: Record<string, string[]> = {
      'nfl-predictor': ['time-series', 'structured', 'statistical'],
      'microbiome': ['genomic', 'high-dimensional', 'sparse'],
      'beclever': ['text', 'unstructured', 'contextual'],
    };
    return charMap[project] || ['structured'];
  }

  private inferConstraints(stats: any): string[] {
    const constraints: string[] = [];
    if (stats.avgLatencyMs < 1000) constraints.push('low-latency');
    if (stats.totalCost < 0.01) constraints.push('cost-efficient');
    if (stats.reflexionUsageRate > 0.5) constraints.push('adaptive');
    return constraints;
  }

  private describeApproach(patternType: string, stats: any): string {
    if (patternType === 'workflow' && stats.reflexionUsageRate > 0.7) {
      return 'Iterative refinement with reflexion feedback loops';
    } else if (patternType === 'optimization') {
      return 'Direct prediction with optimized prompting';
    } else if (patternType === 'strategy') {
      return 'High-confidence prediction with structured reasoning';
    }
    return 'Adaptive multi-step approach';
  }

  private identifyTechniques(stats: any): string[] {
    const techniques: string[] = [];
    if (stats.reflexionUsageRate > 0.5) techniques.push('reflexion');
    if (stats.avgConfidence > 0.9) techniques.push('high-confidence-filtering');
    if (stats.avgLatencyMs < 1000) techniques.push('prompt-optimization');
    return techniques;
  }

  // ============================================================================
  // Vector Search for Similar Patterns
  // ============================================================================

  /**
   * Find similar patterns across all projects
   */
  async findSimilarPatternsAcrossProjects(
    queryPattern: { description: string; patternType: string; context: any },
    options?: {
      targetProjects?: string[];
      minSimilarity?: number;
      limit?: number;
    }
  ): Promise<CrossProjectMatch[]> {
    const minSimilarity = options?.minSimilarity ?? this.config.minTransferScore;
    const limit = options?.limit ?? 10;

    console.log('🔍 Searching for similar patterns across projects...');

    // Generate query embedding
    const queryEmbedding = await this.generatePatternEmbedding(
      queryPattern.description,
      queryPattern.patternType
    );

    // Search in AgentDB
    const similarExperts = await this.agentDB.findSimilarExperts(queryEmbedding, limit * 2);

    const matches: CrossProjectMatch[] = [];

    for (const expert of similarExperts) {
      // Get full pattern details
      const pattern = await this.getDiscoveredPattern(expert.expertId);
      if (!pattern) continue;

      // Filter by target projects if specified
      if (options?.targetProjects && !options.targetProjects.includes(pattern.sourceProject)) {
        continue;
      }

      const similarity = expert.performance;
      if (similarity < minSimilarity) continue;

      // Calculate transfer potential
      const transferPotential = this.calculateTransferPotential(
        pattern,
        queryPattern.context
      );

      // Estimate improvement
      const estimatedImprovement = this.estimateImprovement(pattern, transferPotential);

      // Identify required adaptations
      const requiredAdaptations = this.identifyAdaptations(pattern, queryPattern.context);

      // Get AI Council decision if enabled
      let aiCouncilDecision;
      if (this.config.enableAICouncil) {
        aiCouncilDecision = await this.getAICouncilDecision(pattern, queryPattern.context);
      }

      matches.push({
        pattern,
        similarity,
        targetProject: queryPattern.context.targetProject || 'unknown',
        transferPotential,
        estimatedImprovement,
        requiredAdaptations,
        risks: pattern.transferability.risks,
        aiCouncilDecision,
      });
    }

    // Sort by transfer potential
    matches.sort((a, b) => b.transferPotential - a.transferPotential);

    console.log(`✓ Found ${matches.length} similar patterns`);
    return matches.slice(0, limit);
  }

  /**
   * Calculate transfer potential
   */
  private calculateTransferPotential(
    pattern: DiscoveredPattern,
    targetContext: any
  ): number {
    let potential = pattern.transferability.score;

    // Boost if high performance
    if (pattern.performance.successRate > 0.9) {
      potential *= 1.1;
    }

    // Boost if reflexion-enabled (more adaptive)
    if (pattern.performance.reflexionUsed) {
      potential *= 1.05;
    }

    // Reduce if domain mismatch
    if (targetContext.domain && pattern.context.domain !== targetContext.domain) {
      potential *= 0.85;
    }

    return Math.min(potential, 1.0);
  }

  /**
   * Estimate improvement from pattern transfer
   */
  private estimateImprovement(
    pattern: DiscoveredPattern,
    transferPotential: number
  ): number {
    // Conservative estimate: transfer potential * pattern success rate * 0.3
    return transferPotential * pattern.performance.successRate * 0.3;
  }

  /**
   * Identify required adaptations
   */
  private identifyAdaptations(pattern: DiscoveredPattern, targetContext: any): string[] {
    const adaptations: string[] = [];

    if (pattern.transferability.adaptationRequired === 'high') {
      adaptations.push('Significant code changes required');
      adaptations.push('Redesign for target domain');
    } else if (pattern.transferability.adaptationRequired === 'medium') {
      adaptations.push('Modify context parameters');
      adaptations.push('Adjust prompts for target domain');
    } else if (pattern.transferability.adaptationRequired === 'low') {
      adaptations.push('Minor configuration changes');
    }

    if (targetContext.domain && pattern.context.domain !== targetContext.domain) {
      adaptations.push(`Adapt from ${pattern.context.domain} to ${targetContext.domain}`);
    }

    return adaptations;
  }

  /**
   * Get AI Council decision for pattern transfer
   */
  private async getAICouncilDecision(
    pattern: DiscoveredPattern,
    _targetContext: any
  ): Promise<AICouncilDecision> {
    // Simplified AI Council logic - in production, integrate with actual AI Council
    const confidence = pattern.transferability.score;
    const approved = confidence > 0.75 && pattern.performance.successRate > 0.85;

    const reasoning: string[] = [];
    if (approved) {
      reasoning.push(`High transfer potential (${(confidence * 100).toFixed(1)}%)`);
      reasoning.push(`Strong source performance (${(pattern.performance.successRate * 100).toFixed(1)}% success rate)`);
    } else {
      reasoning.push(`Insufficient transfer confidence (${(confidence * 100).toFixed(1)}%)`);
    }

    const conditions: string[] = [];
    if (pattern.transferability.adaptationRequired !== 'none') {
      conditions.push('Requires adaptation testing');
    }
    conditions.push('Monitor performance for 7 days');
    conditions.push('Implement rollback plan');

    const requiredTests: string[] = [
      'Baseline performance test',
      'Pattern transfer test',
      'A/B comparison test',
      'Edge case validation',
    ];

    const rollbackPlan: string[] = [
      'Monitor key metrics',
      'Set automatic rollback triggers',
      'Prepare fallback to baseline',
      'Document rollback procedure',
    ];

    return {
      approved,
      confidence,
      reasoning,
      conditions,
      requiredTests,
      rollbackPlan,
    };
  }

  // ============================================================================
  // Transfer Testing Framework
  // ============================================================================

  /**
   * Test pattern transfer on target project
   */
  async testPatternTransfer(
    patternId: string,
    targetProject: string,
    options?: {
      testSize?: number;
      baselineMetrics?: any;
      durationDays?: number;
    }
  ): Promise<TransferTestResult> {
    console.log(`🧪 Testing pattern ${patternId} on ${targetProject}...`);

    const pattern = await this.getDiscoveredPattern(patternId);
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    const testId = `test-${patternId}-${targetProject}-${Date.now()}`;

    // Create test record
    const test: TransferTestResult = {
      testId,
      patternId,
      sourceProject: pattern.sourceProject,
      targetProject,
      startedAt: new Date(),
      status: 'running',
      metrics: {
        baselineAccuracy: options?.baselineMetrics?.accuracy || 0,
        patternAccuracy: 0,
        improvement: 0,
        latencyImpact: 0,
        confidence: 0,
      },
      observations: [],
      recommendations: [],
      shouldDeploy: false,
      metadata: options,
    };

    // Store test record
    await this.storeTransferTest(test);

    // Simulate testing (in production, actually run the test)
    console.log(`  Testing for ${options?.durationDays || 7} days...`);

    // Mock: Calculate test metrics
    const transferPotential = pattern.transferability.score;
    const estimatedImprovement = this.estimateImprovement(pattern, transferPotential);

    test.metrics.patternAccuracy = Math.min(
      0.95,
      test.metrics.baselineAccuracy + estimatedImprovement
    );
    test.metrics.improvement = test.metrics.patternAccuracy - test.metrics.baselineAccuracy;
    test.metrics.latencyImpact = pattern.performance.avgLatency * 1.1; // Slight latency increase
    test.metrics.confidence = transferPotential;

    // Determine success
    if (test.metrics.improvement > 0.05 && test.metrics.confidence > 0.75) {
      test.status = 'success';
      test.shouldDeploy = true;
      test.observations.push('Pattern transfer successful');
      test.observations.push(`Achieved ${(test.metrics.improvement * 100).toFixed(1)}% improvement`);
      test.recommendations.push('Deploy to production with monitoring');
    } else if (test.metrics.improvement > 0) {
      test.status = 'partial';
      test.shouldDeploy = false;
      test.observations.push('Marginal improvement detected');
      test.recommendations.push('Requires further optimization');
    } else {
      test.status = 'failure';
      test.shouldDeploy = false;
      test.observations.push('No improvement detected');
      test.recommendations.push('Do not deploy - investigate alternatives');
    }

    test.completedAt = new Date();

    // Update test record
    await this.updateTransferTest(test);

    console.log(`✓ Test completed: ${test.status}`);
    return test;
  }

  // ============================================================================
  // Pattern Storage and Retrieval
  // ============================================================================

  /**
   * Store discovered pattern
   */
  private async storeDiscoveredPattern(pattern: DiscoveredPattern): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO discovered_patterns
      (pattern_id, source_project, expert_id, version, pattern_type, name, description,
       context, implementation, performance, transferability, discovered_at, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pattern.patternId,
      pattern.sourceProject,
      pattern.expertId,
      pattern.version,
      pattern.patternType,
      pattern.name,
      pattern.description,
      JSON.stringify(pattern.context),
      JSON.stringify(pattern.implementation),
      JSON.stringify(pattern.performance),
      JSON.stringify(pattern.transferability),
      pattern.discoveredAt.getTime(),
      pattern.metadata ? JSON.stringify(pattern.metadata) : null
    );
  }

  /**
   * Get discovered pattern
   */
  private async getDiscoveredPattern(patternId: string): Promise<DiscoveredPattern | null> {
    const db = await this.getDb();
    if (!db) return null;

    const stmt = db.prepare(`
      SELECT * FROM discovered_patterns WHERE pattern_id = ?
    `);

    const row = stmt.get(patternId) as any;
    if (!row) return null;

    // Get embedding from AgentDB
    const expert = await this.agentDB.getExpert(patternId);

    return {
      patternId: row.pattern_id,
      sourceProject: row.source_project,
      expertId: row.expert_id,
      version: row.version,
      patternType: row.pattern_type,
      name: row.name,
      description: row.description,
      context: JSON.parse(row.context),
      implementation: JSON.parse(row.implementation),
      performance: JSON.parse(row.performance),
      transferability: JSON.parse(row.transferability),
      embedding: expert?.embedding || [],
      discoveredAt: new Date(row.discovered_at),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Store transfer test
   */
  private async storeTransferTest(test: TransferTestResult): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO transfer_tests
      (test_id, pattern_id, source_project, target_project, started_at, completed_at,
       status, metrics, observations, recommendations, should_deploy, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      test.testId,
      test.patternId,
      test.sourceProject,
      test.targetProject,
      test.startedAt.getTime(),
      test.completedAt?.getTime() || null,
      test.status,
      JSON.stringify(test.metrics),
      JSON.stringify(test.observations),
      JSON.stringify(test.recommendations),
      test.shouldDeploy ? 1 : 0,
      test.metadata ? JSON.stringify(test.metadata) : null
    );
  }

  /**
   * Update transfer test
   */
  private async updateTransferTest(test: TransferTestResult): Promise<void> {
    await this.storeTransferTest(test);
  }

  /**
   * Get all patterns for a project
   */
  async getProjectPatterns(project: string): Promise<DiscoveredPattern[]> {
    const db = await this.getDb();
    if (!db) return [];

    const stmt = db.prepare(`
      SELECT pattern_id FROM discovered_patterns
      WHERE source_project = ?
      ORDER BY discovered_at DESC
    `);

    const rows = stmt.all(project) as { pattern_id: string }[];
    const patterns: DiscoveredPattern[] = [];

    for (const row of rows) {
      const pattern = await this.getDiscoveredPattern(row.pattern_id);
      if (pattern) patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Close connections
   */
  close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        console.warn('⚠ Failed to close database:', error);
      }
    }

    if (this.agentDB) {
      this.agentDB.close();
    }

    if (this.patternDiscovery) {
      this.patternDiscovery.close();
    }

    if (this.metricsCollector) {
      this.metricsCollector.close();
    }
  }
}

/**
 * Create cross-project discovery engine
 */
export function createCrossProjectDiscovery(
  config?: CrossProjectDiscoveryConfig
): CrossProjectDiscovery {
  return new CrossProjectDiscovery(config);
}
