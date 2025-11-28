/**
 * Command Interceptor
 *
 * Automatically wraps all CLI commands with agentic-flow + AgentDB
 * Based on .iris/config/settings.json preferences
 */

import { executeWithDefaults, getExecutionEngine } from './execution-engine.js';
import chalk from 'chalk';

/**
 * Intercept and execute command with smart defaults
 */
export async function interceptCommand(
  commandName: string,
  commandFn: (...args: any[]) => Promise<any>,
  ...args: any[]
): Promise<any> {
  const engine = getExecutionEngine();
  const config = await engine.loadConfig();

  // Check if we should use smart execution
  if (!config.use_agentic_flow && !config.use_agentdb) {
    // Direct execution (no interception)
    return commandFn(...args);
  }

  // Execute with smart defaults
  const result = await executeWithDefaults(commandName, args);

  if (!result.success) {
    console.error(chalk.red(`❌ Command failed: ${result.error}`));
    process.exit(1);
  }

  // Show execution metrics if verbose
  if (process.env.VERBOSE === 'true') {
    console.log(chalk.gray(`\n📊 Execution metrics:`));
    console.log(chalk.gray(`   Duration: ${result.metrics.duration_ms}ms`));
    if (result.metrics.agents_used) {
      console.log(chalk.gray(`   Agents used: ${result.metrics.agents_used}`));
    }
  }

  return result.result;
}

/**
 * Decorator for auto-intercepting commands
 */
export function withSmartDefaults(commandFn: (...args: any[]) => Promise<any>) {
  return async (...args: any[]) => {
    const commandName = commandFn.name || 'unknown';
    return interceptCommand(commandName, commandFn, ...args);
  };
}

/**
 * Check if smart execution is enabled
 */
export async function isSmartExecutionEnabled(): Promise<boolean> {
  const engine = getExecutionEngine();
  const config = await engine.loadConfig();
  return config.use_agentic_flow || config.use_agentdb;
}

/**
 * Display smart execution banner
 */
export async function showSmartExecutionBanner(): Promise<void> {
  const engine = getExecutionEngine();
  const config = await engine.loadConfig();

  if (config.use_agentic_flow || config.use_agentdb) {
    const features: string[] = [];

    if (config.use_agentic_flow) {
      features.push(chalk.green('agentic-flow'));
    }
    if (config.use_agentdb) {
      features.push(chalk.blue('AgentDB'));
    }

    if (!process.env.IRIS_MCP_MODE) {
      console.log(chalk.gray(`\n🚀 Smart execution: ${features.join(' + ')}\n`));
    }
  }
}
