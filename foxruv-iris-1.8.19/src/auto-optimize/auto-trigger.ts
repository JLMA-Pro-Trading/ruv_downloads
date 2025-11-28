/**
 * Iris Auto-Optimization Trigger System
 * 
 * Automatically triggers optimization when:
 * 1. Enough telemetry data exists (>10 calls)
 * 2. Success rate drops below threshold (< 70%)
 * 3. Drift detected (performance degradation)
 * 
 * This is THE main feature - self-improving AI without manual intervention.
 * 
 * @module auto-optimize/auto-trigger
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface TelemetryRecord {
  id: string;
  target: string;           // File path or function name
  timestamp: Date;
  success: boolean;
  latencyMs: number;
  tokenCount?: number;
  errorMessage?: string;
  input?: string;
  output?: string;
  confidence?: number;
}

export interface OptimizationTrigger {
  target: string;
  reason: 'low_success_rate' | 'high_latency' | 'drift_detected' | 'manual';
  metrics: {
    callCount: number;
    successRate: number;
    avgLatency: number;
    recentTrend: 'improving' | 'stable' | 'degrading';
  };
  recommendation: string;
}

export interface AutoTriggerConfig {
  enabled: boolean;
  minCallsBeforeTrigger: number;      // Min calls before considering optimization
  successRateThreshold: number;        // Trigger if success rate below this
  latencyThresholdMs: number;          // Trigger if avg latency above this
  cooldownMinutes: number;             // Don't re-trigger within this window
  autoApply: boolean;                  // Auto-apply optimizations or just suggest
}

const DEFAULT_CONFIG: AutoTriggerConfig = {
  enabled: true,
  minCallsBeforeTrigger: 10,
  successRateThreshold: 0.7,
  latencyThresholdMs: 5000,
  cooldownMinutes: 60,
  autoApply: false  // Default to suggest, not auto-apply
};

// ============================================================================
// Telemetry Storage (uses AgentDB under the hood)
// ============================================================================

const TELEMETRY_DIR = '.iris/telemetry';
const TRIGGERS_LOG = '.iris/optimization-triggers.json';

export function ensureTelemetryDir(projectPath: string = process.cwd()): void {
  const dir = path.join(projectPath, TELEMETRY_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Record a telemetry event for an AI function call
 */
export function recordTelemetry(
  projectPath: string,
  record: Omit<TelemetryRecord, 'id' | 'timestamp'>
): void {
  ensureTelemetryDir(projectPath);
  
  const telemetryFile = path.join(projectPath, TELEMETRY_DIR, 'calls.json');
  
  let records: TelemetryRecord[] = [];
  try {
    if (fs.existsSync(telemetryFile)) {
      records = JSON.parse(fs.readFileSync(telemetryFile, 'utf-8'));
    }
  } catch (e) {
    // Start fresh
  }
  
  const newRecord: TelemetryRecord = {
    ...record,
    id: `tel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date()
  };
  
  records.push(newRecord);
  
  // Keep last 10000 records
  if (records.length > 10000) {
    records = records.slice(-10000);
  }
  
  fs.writeFileSync(telemetryFile, JSON.stringify(records, null, 2));
}

/**
 * Get telemetry records for a specific target
 */
export function getTelemetryForTarget(
  projectPath: string,
  target: string
): TelemetryRecord[] {
  const telemetryFile = path.join(projectPath, TELEMETRY_DIR, 'calls.json');
  
  if (!fs.existsSync(telemetryFile)) {
    return [];
  }
  
  try {
    const records: TelemetryRecord[] = JSON.parse(fs.readFileSync(telemetryFile, 'utf-8'));
    return records.filter(r => r.target === target || r.target.includes(target));
  } catch (e) {
    return [];
  }
}

/**
 * Get all unique targets with telemetry
 */
export function getAllTargets(projectPath: string): string[] {
  const telemetryFile = path.join(projectPath, TELEMETRY_DIR, 'calls.json');
  
  if (!fs.existsSync(telemetryFile)) {
    return [];
  }
  
  try {
    const records: TelemetryRecord[] = JSON.parse(fs.readFileSync(telemetryFile, 'utf-8'));
    return [...new Set(records.map(r => r.target))];
  } catch (e) {
    return [];
  }
}

// ============================================================================
// Auto-Trigger Logic
// ============================================================================

/**
 * Calculate metrics for a target
 */
export function calculateMetrics(records: TelemetryRecord[]): OptimizationTrigger['metrics'] {
  if (records.length === 0) {
    return {
      callCount: 0,
      successRate: 1,
      avgLatency: 0,
      recentTrend: 'stable'
    };
  }
  
  const callCount = records.length;
  const successRate = records.filter(r => r.success).length / callCount;
  const avgLatency = records.reduce((sum, r) => sum + r.latencyMs, 0) / callCount;
  
  // Calculate trend from last 5 vs previous 5
  let recentTrend: 'improving' | 'stable' | 'degrading' = 'stable';
  if (records.length >= 10) {
    const recent5 = records.slice(-5);
    const prev5 = records.slice(-10, -5);
    
    const recentSuccess = recent5.filter(r => r.success).length / 5;
    const prevSuccess = prev5.filter(r => r.success).length / 5;
    
    if (recentSuccess > prevSuccess + 0.1) {
      recentTrend = 'improving';
    } else if (recentSuccess < prevSuccess - 0.1) {
      recentTrend = 'degrading';
    }
  }
  
  return { callCount, successRate, avgLatency, recentTrend };
}

/**
 * Check if optimization should be triggered for a target
 */
export function shouldTriggerOptimization(
  projectPath: string,
  target: string,
  config: AutoTriggerConfig = DEFAULT_CONFIG
): OptimizationTrigger | null {
  if (!config.enabled) {
    return null;
  }
  
  const records = getTelemetryForTarget(projectPath, target);
  const metrics = calculateMetrics(records);
  
  // Not enough data yet
  if (metrics.callCount < config.minCallsBeforeTrigger) {
    return null;
  }
  
  // Check cooldown
  const triggersFile = path.join(projectPath, TRIGGERS_LOG);
  if (fs.existsSync(triggersFile)) {
    try {
      const triggers = JSON.parse(fs.readFileSync(triggersFile, 'utf-8'));
      const lastTrigger = triggers.find((t: any) => t.target === target);
      if (lastTrigger) {
        const lastTime = new Date(lastTrigger.timestamp).getTime();
        const cooldownMs = config.cooldownMinutes * 60 * 1000;
        if (Date.now() - lastTime < cooldownMs) {
          return null; // Still in cooldown
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  
  // Check triggers
  let reason: OptimizationTrigger['reason'] | null = null;
  let recommendation = '';
  
  if (metrics.successRate < config.successRateThreshold) {
    reason = 'low_success_rate';
    recommendation = `Success rate (${(metrics.successRate * 100).toFixed(1)}%) is below threshold (${config.successRateThreshold * 100}%). DSPy optimization can improve prompt effectiveness.`;
  } else if (metrics.avgLatency > config.latencyThresholdMs) {
    reason = 'high_latency';
    recommendation = `Average latency (${metrics.avgLatency.toFixed(0)}ms) exceeds threshold (${config.latencyThresholdMs}ms). Consider Ax optimization for hyperparameters.`;
  } else if (metrics.recentTrend === 'degrading') {
    reason = 'drift_detected';
    recommendation = `Performance is degrading. Recent success rate is lower than historical. Re-optimization recommended.`;
  }
  
  if (!reason) {
    return null;
  }
  
  return {
    target,
    reason,
    metrics,
    recommendation
  };
}

/**
 * Log that an optimization was triggered
 */
export function logOptimizationTrigger(
  projectPath: string,
  trigger: OptimizationTrigger
): void {
  const triggersFile = path.join(projectPath, TRIGGERS_LOG);
  
  let triggers: any[] = [];
  try {
    if (fs.existsSync(triggersFile)) {
      triggers = JSON.parse(fs.readFileSync(triggersFile, 'utf-8'));
    }
  } catch (e) {
    // Start fresh
  }
  
  triggers.push({
    ...trigger,
    timestamp: new Date().toISOString()
  });
  
  // Keep last 100 triggers
  if (triggers.length > 100) {
    triggers = triggers.slice(-100);
  }
  
  fs.writeFileSync(triggersFile, JSON.stringify(triggers, null, 2));
}

/**
 * Check all targets and return any that need optimization
 */
export function checkAllTargets(
  projectPath: string,
  config: AutoTriggerConfig = DEFAULT_CONFIG
): OptimizationTrigger[] {
  const targets = getAllTargets(projectPath);
  const triggers: OptimizationTrigger[] = [];
  
  for (const target of targets) {
    const trigger = shouldTriggerOptimization(projectPath, target, config);
    if (trigger) {
      triggers.push(trigger);
    }
  }
  
  return triggers;
}

// ============================================================================
// CLI Integration
// ============================================================================

/**
 * Run auto-trigger check and optionally execute optimizations
 */
export async function runAutoTriggerCheck(
  projectPath: string = process.cwd(),
  options: { autoExecute?: boolean; verbose?: boolean } = {}
): Promise<void> {
  console.log(chalk.blue('\n🔍 Iris Auto-Optimization Check\n'));
  
  // Load config
  const configFile = path.join(projectPath, '.iris/config.json');
  let config = DEFAULT_CONFIG;
  try {
    if (fs.existsSync(configFile)) {
      const rawConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      config = { ...DEFAULT_CONFIG, ...rawConfig.autoOptimize };
    }
  } catch (e) {
    // Use defaults
  }
  
  if (!config.enabled) {
    console.log(chalk.yellow('Auto-optimization is disabled. Enable with:'));
    console.log(chalk.gray('  npx iris config set autoOptimize.enabled true'));
    return;
  }
  
  // Check all targets
  const triggers = checkAllTargets(projectPath, config);
  
  if (triggers.length === 0) {
    console.log(chalk.green('✅ All targets performing well. No optimization needed.'));
    
    const targets = getAllTargets(projectPath);
    if (targets.length === 0) {
      console.log(chalk.yellow('\n⚠️  No telemetry data yet.'));
      console.log(chalk.gray('   Run: npx iris discover --deep'));
      console.log(chalk.gray('   Then use your AI functions to collect data.'));
    } else {
      console.log(chalk.gray(`\n   Monitoring ${targets.length} target(s)`));
    }
    return;
  }
  
  console.log(chalk.yellow(`🎯 Found ${triggers.length} target(s) needing optimization:\n`));
  
  for (const trigger of triggers) {
    console.log(chalk.white('─'.repeat(60)));
    console.log(chalk.bold(`Target: ${trigger.target}`));
    console.log(`Reason: ${chalk.red(trigger.reason.replace(/_/g, ' '))}`);
    console.log(`Calls: ${trigger.metrics.callCount} | Success: ${(trigger.metrics.successRate * 100).toFixed(1)}% | Latency: ${trigger.metrics.avgLatency.toFixed(0)}ms`);
    console.log(`Trend: ${trigger.metrics.recentTrend === 'degrading' ? chalk.red('↓ degrading') : trigger.metrics.recentTrend === 'improving' ? chalk.green('↑ improving') : chalk.gray('→ stable')}`);
    console.log(chalk.cyan(`\n💡 ${trigger.recommendation}\n`));
    
    // Log the trigger
    logOptimizationTrigger(projectPath, trigger);
    
    // Execute if requested
    if (options.autoExecute || config.autoApply) {
      console.log(chalk.blue(`🚀 Auto-executing optimization for ${trigger.target}...`));
      
      try {
        // Dynamic import to avoid circular deps
        const { default: optimize } = await import('../scripts/iris/iris-optimize.js');
        await optimize({
          target: trigger.target,
          auto: true,
          reason: trigger.reason
        });
        console.log(chalk.green(`✅ Optimization complete for ${trigger.target}`));
      } catch (error) {
        console.error(chalk.red(`❌ Optimization failed: ${error}`));
      }
    } else {
      console.log(chalk.gray('To optimize manually:'));
      console.log(chalk.cyan(`  npx iris optimize --target ${trigger.target}`));
    }
  }
  
  console.log(chalk.white('\n' + '─'.repeat(60)));
  console.log(chalk.gray('\nTo enable auto-execution:'));
  console.log(chalk.gray('  npx iris config set autoOptimize.autoApply true'));
}

// ============================================================================
// Hook Integration - Called from PostToolUse
// ============================================================================

/**
 * Record outcome from a tool use and check for triggers
 * This is called from the PostToolUse hook
 */
export async function recordAndCheck(
  projectPath: string,
  target: string,
  success: boolean,
  latencyMs: number,
  metadata?: { input?: string; output?: string; error?: string }
): Promise<OptimizationTrigger | null> {
  // Record the telemetry
  recordTelemetry(projectPath, {
    target,
    success,
    latencyMs,
    errorMessage: metadata?.error,
    input: metadata?.input,
    output: metadata?.output
  });
  
  // Check if optimization should trigger
  return shouldTriggerOptimization(projectPath, target);
}

