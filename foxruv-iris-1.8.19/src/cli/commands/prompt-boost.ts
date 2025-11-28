/**
 * Prompt Boost Command
 * 
 * Manages the prompt injection and shadow improvement features:
 * - inject: Always prepend "using agentic-flow AND AgentDB" 
 * - shadow: Run local model to improve prompts, log but don't send
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = '.iris/config.json';
const EXPERIMENTS_PATH = '.iris/prompt-experiments.json';

export interface PromptBoostConfig {
  enabled: boolean;
  engine: 'agentic-flow' | 'claude-flow';
  alwaysInjectEngine: boolean;  // Always say "use agentic-flow AND AgentDB"
  experimentalImprove: {
    enabled: boolean;
    shadowMode: boolean;        // Log but don't send improved version
    localModel: string;         // lmstudio, ollama, vllm, etc.
    modelName: string;          // User's local model name
    endpoint: string;           // User's local model endpoint
    // Cloud verification (batch local improvements to Opus for scoring)
    cloudVerify: {
      enabled: boolean;         // Batch to cloud for verification
      model: string;            // claude-opus-4-20250514
      batchSize: number;        // How many to batch before sending
      minConfidence: number;    // Min confidence to accept local improvement
    };
  };
}

const DEFAULT_CONFIG: PromptBoostConfig = {
  enabled: true,
  engine: 'agentic-flow',
  alwaysInjectEngine: true,
  experimentalImprove: {
    enabled: false,             // OFF by default
    shadowMode: true,           // When on, only logs - doesn't change prompt
    localModel: 'lmstudio',     // lmstudio, ollama, vllm, etc.
    modelName: '',              // User configures: e.g., 'qwen3-coder-30b-a3b-instruct-mlx'
    endpoint: '',               // User configures: e.g., 'http://192.168.254.246:1234'
    cloudVerify: {
      enabled: false,           // OFF by default - batch to Opus for verification
      model: 'claude-opus-4-20250514',
      batchSize: 10,            // Batch 10 improvements before sending to Opus
      minConfidence: 0.7        // Accept local improvement if Opus scores it >= 70%
    }
  }
};

function loadConfig(projectPath: string): PromptBoostConfig {
  const configFile = path.join(projectPath, CONFIG_PATH);
  try {
    if (fs.existsSync(configFile)) {
      const raw = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      return {
        ...DEFAULT_CONFIG,
        ...raw.promptBoost,
        experimentalImprove: {
          ...DEFAULT_CONFIG.experimentalImprove,
          ...(raw.promptBoost?.experimentalImprove || {})
        }
      };
    }
  } catch (e) {
    // Ignore parse errors, use defaults
  }
  return DEFAULT_CONFIG;
}

function saveConfig(projectPath: string, config: PromptBoostConfig): void {
  const configFile = path.join(projectPath, CONFIG_PATH);
  const configDir = path.dirname(configFile);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  let existing: any = {};
  try {
    if (fs.existsSync(configFile)) {
      existing = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    }
  } catch (e) {
    // Start fresh
  }
  
  existing.promptBoost = config;
  fs.writeFileSync(configFile, JSON.stringify(existing, null, 2));
}

export async function runPromptBoostStatus(projectPath: string): Promise<void> {
  const config = loadConfig(projectPath);
  
  console.log(chalk.cyan('\n✨ Prompt Boost Status\n'));
  console.log(chalk.white('─'.repeat(50)));
  
  console.log(`  ${chalk.bold('Enabled:')}          ${config.enabled ? chalk.green('ON') : chalk.red('OFF')}`);
  console.log(`  ${chalk.bold('Engine:')}           ${chalk.yellow(config.engine)}`);
  console.log(`  ${chalk.bold('Auto-inject:')}      ${config.alwaysInjectEngine ? chalk.green('YES') : chalk.gray('NO')}`);
  
  if (config.alwaysInjectEngine) {
    console.log(`  ${chalk.gray('  → Every prompt gets: "use agentic-flow AND AgentDB"')}`);
  }
  
  console.log('');
  console.log(chalk.bold('  Experimental Improve:'));
  console.log(`    ${chalk.bold('Enabled:')}        ${config.experimentalImprove.enabled ? chalk.yellow('ON (experimental)') : chalk.gray('OFF')}`);
  console.log(`    ${chalk.bold('Shadow Mode:')}    ${config.experimentalImprove.shadowMode ? chalk.green('YES (log only)') : chalk.red('NO (live)')}`);
  console.log(`    ${chalk.bold('Local Model:')}    ${chalk.cyan(config.experimentalImprove.localModel)}/${chalk.cyan(config.experimentalImprove.modelName)}`);
  console.log(`    ${chalk.bold('Endpoint:')}       ${chalk.gray(config.experimentalImprove.endpoint)}`);
  
  console.log(chalk.white('\n─'.repeat(50)));
  
  // Show experiments count if any
  const experimentsFile = path.join(projectPath, EXPERIMENTS_PATH);
  if (fs.existsSync(experimentsFile)) {
    try {
      const experiments = JSON.parse(fs.readFileSync(experimentsFile, 'utf-8'));
      console.log(`  ${chalk.bold('Experiments logged:')} ${chalk.cyan(experiments.length)}`);
      console.log(`  ${chalk.gray('Run: npx iris prompt-boost review')}`);
    } catch (e) {
      // Ignore
    }
  }
  
  console.log('');
}

export async function runPromptBoostOn(projectPath: string): Promise<void> {
  const config = loadConfig(projectPath);
  config.enabled = true;
  saveConfig(projectPath, config);
  
  console.log(chalk.green('\n✅ Prompt Boost enabled'));
  console.log(chalk.gray('   Every prompt will include "use agentic-flow AND AgentDB"'));
  console.log(chalk.gray('   Statusline will show: ✨Boost:ON\n'));
}

export async function runPromptBoostOff(projectPath: string): Promise<void> {
  const config = loadConfig(projectPath);
  config.enabled = false;
  saveConfig(projectPath, config);
  
  console.log(chalk.yellow('\n⏸️  Prompt Boost disabled'));
  console.log(chalk.gray('   Prompts will be sent as-is\n'));
}

export async function runPromptBoostShadow(projectPath: string, enable: boolean): Promise<void> {
  const config = loadConfig(projectPath);
  
  // Check if endpoint is configured before enabling
  if (enable && (!config.experimentalImprove.endpoint || !config.experimentalImprove.modelName)) {
    console.log(chalk.yellow('\n⚠️  Shadow Mode requires local model configuration\n'));
    console.log(chalk.white('  Configure your local LLM first:'));
    console.log(chalk.cyan('    npx iris prompt-boost model <model-name> --endpoint <url>'));
    console.log('');
    console.log(chalk.gray('  Examples:'));
    console.log(chalk.gray('    # LM Studio'));
    console.log(chalk.gray('    npx iris prompt-boost model qwen3-coder-30b --endpoint http://192.168.1.100:1234'));
    console.log('');
    console.log(chalk.gray('    # Ollama'));
    console.log(chalk.gray('    npx iris prompt-boost model llama3 --endpoint http://localhost:11434 --type ollama'));
    console.log('');
    return;
  }
  
  config.experimentalImprove.enabled = enable;
  config.experimentalImprove.shadowMode = true; // Always shadow when enabling
  saveConfig(projectPath, config);
  
  if (enable) {
    console.log(chalk.yellow('\n🔬 Shadow Mode enabled (experimental)'));
    console.log(chalk.gray(`   Model: ${config.experimentalImprove.modelName}`));
    console.log(chalk.gray(`   Endpoint: ${config.experimentalImprove.endpoint}`));
    console.log(chalk.gray('   Results logged to .iris/prompt-experiments.json'));
    console.log(chalk.gray('   Original prompts still sent (shadow only)\n'));
  } else {
    console.log(chalk.gray('\n🔬 Shadow Mode disabled\n'));
  }
}

export async function runPromptBoostSetModel(
  projectPath: string, 
  model: string, 
  options: { endpoint?: string; type?: string }
): Promise<void> {
  const config = loadConfig(projectPath);
  config.experimentalImprove.modelName = model;
  
  if (options.endpoint) {
    config.experimentalImprove.endpoint = options.endpoint;
  }
  
  if (options.type) {
    config.experimentalImprove.localModel = options.type as any;
  }
  
  saveConfig(projectPath, config);
  
  console.log(chalk.cyan(`\n✅ Local model configured:`));
  console.log(chalk.white(`   Model:    ${model}`));
  console.log(chalk.white(`   Type:     ${config.experimentalImprove.localModel}`));
  console.log(chalk.white(`   Endpoint: ${config.experimentalImprove.endpoint || '(not set)'}`));
  console.log('');
  
  if (config.experimentalImprove.endpoint) {
    console.log(chalk.gray('   Enable shadow mode: npx iris prompt-boost shadow on'));
  } else {
    console.log(chalk.yellow('   ⚠️  Set endpoint: npx iris prompt-boost model <model> --endpoint <url>'));
  }
  console.log('');
}

export async function runPromptBoostReview(projectPath: string): Promise<void> {
  const experimentsFile = path.join(projectPath, EXPERIMENTS_PATH);
  
  if (!fs.existsSync(experimentsFile)) {
    console.log(chalk.yellow('\n📭 No experiments logged yet.'));
    console.log(chalk.gray('   Enable shadow mode: npx iris prompt-boost shadow on\n'));
    return;
  }
  
  try {
    const experiments = JSON.parse(fs.readFileSync(experimentsFile, 'utf-8'));
    
    if (experiments.length === 0) {
      console.log(chalk.yellow('\n📭 No experiments logged yet.\n'));
      return;
    }
    
    console.log(chalk.cyan(`\n📊 Prompt Experiments (${experiments.length} total)\n`));
    console.log(chalk.white('═'.repeat(70)));
    
    // Show last 10
    const recent = experiments.slice(-10);
    
    for (const exp of recent) {
      console.log(chalk.gray(`\n${exp.timestamp}`));
      console.log(chalk.white('─'.repeat(70)));
      console.log(chalk.bold('Original:'));
      console.log(chalk.white(`  ${exp.original}`));
      console.log('');
      console.log(chalk.bold('Would have sent:'));
      console.log(chalk.green(`  ${exp.improved || '(no improvement generated)'}`));
      console.log('');
      console.log(chalk.gray(`Sent: ${exp.sent} | Outcome: ${exp.outcome || 'unknown'}`));
    }
    
    console.log(chalk.white('\n═'.repeat(70)));
    console.log(chalk.gray(`Showing last ${recent.length} of ${experiments.length} experiments\n`));
    
  } catch (e) {
    console.error(chalk.red('\n❌ Failed to read experiments file\n'));
  }
}

/**
 * Log an experiment (called by the hook)
 */
export function logExperiment(
  projectPath: string,
  original: string,
  improved: string | null,
  context?: Record<string, any>
): void {
  const experimentsFile = path.join(projectPath, EXPERIMENTS_PATH);
  const experimentsDir = path.dirname(experimentsFile);
  
  if (!fs.existsSync(experimentsDir)) {
    fs.mkdirSync(experimentsDir, { recursive: true });
  }
  
  let experiments: any[] = [];
  try {
    if (fs.existsSync(experimentsFile)) {
      experiments = JSON.parse(fs.readFileSync(experimentsFile, 'utf-8'));
    }
  } catch (e) {
    // Start fresh
  }
  
  experiments.push({
    timestamp: new Date().toISOString(),
    original,
    improved,
    context,
    sent: 'original',  // In shadow mode, always original
    outcome: null      // To be filled later
  });
  
  // Keep last 1000 experiments
  if (experiments.length > 1000) {
    experiments = experiments.slice(-1000);
  }
  
  fs.writeFileSync(experimentsFile, JSON.stringify(experiments, null, 2));
}

/**
 * Generate the injection text based on config
 */
export function getInjectionText(config: PromptBoostConfig): string {
  if (!config.enabled || !config.alwaysInjectEngine) {
    return '';
  }
  
  if (config.engine === 'agentic-flow') {
    return '[IRIS] Using agentic-flow AND AgentDB for this task. All operations tracked.';
  } else {
    return '[IRIS] Using claude-flow orchestration. AgentDB tracking enabled.';
  }
}

/**
 * Call local model to improve prompt (for shadow mode)
 * Supports: LM Studio (OpenAI-compatible), Ollama, vLLM
 */
export async function improvePromptWithLocalModel(
  prompt: string,
  config: PromptBoostConfig
): Promise<string | null> {
  if (!config.experimentalImprove.enabled) {
    return null;
  }
  
  const systemPrompt = `You are a prompt improvement assistant for AI coding workflows. Given a user's prompt, improve it by:
1. Making it more specific and actionable
2. Adding relevant context about files/functions if detectable from the prompt
3. Suggesting appropriate agent counts for complex tasks (e.g., "spawn 3 coder agents")
4. Including relevant skill references if the task matches known patterns
5. Keeping the core intent intact - don't change what they want, just make it clearer

The improved prompt should work with agentic-flow and AgentDB.

Respond with ONLY the improved prompt text, nothing else. No explanations.`;

  try {
    // LM Studio uses OpenAI-compatible API at /v1/chat/completions
    if (config.experimentalImprove.localModel === 'lmstudio') {
      const response = await fetch(`${config.experimentalImprove.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.experimentalImprove.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Original prompt: "${prompt}"` }
          ],
          temperature: 0.3,  // Lower for more consistent improvements
          max_tokens: 500
        })
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || null;
    }
    
    // Ollama API
    if (config.experimentalImprove.localModel === 'ollama') {
      const response = await fetch(`${config.experimentalImprove.endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.experimentalImprove.modelName,
          prompt: `${systemPrompt}\n\nOriginal prompt: "${prompt}"\n\nImproved prompt:`,
          stream: false
        })
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.response?.trim() || null;
    }
    
    // vLLM / other OpenAI-compatible
    const response = await fetch(`${config.experimentalImprove.endpoint}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.experimentalImprove.modelName,
        prompt: `${systemPrompt}\n\nOriginal prompt: "${prompt}"\n\nImproved prompt:`,
        max_tokens: 500,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.choices?.[0]?.text?.trim() || null;
    
  } catch (e) {
    // Local model not available, that's fine - shadow mode just logs null
    return null;
  }
}

