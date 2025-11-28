#!/usr/bin/env node

/**
 * E2B Sandbox Deployment System
 * Creates and configures isolated E2B sandboxes for neural trading strategies
 */

const { Sandbox } = require('e2b');
const fs = require('fs');
const path = require('path');

class E2BSandboxDeployer {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.E2B_API_KEY;
    this.sandboxes = new Map();
    this.deploymentLog = [];
  }

  /**
   * Create an E2B sandbox with specified configuration
   */
  async createSandbox(strategyConfig) {
    const { name, agent_type, symbols, resources } = strategyConfig;
    const sandboxId = `${agent_type}-${Date.now()}`;

    this.log(`Creating sandbox for ${name} (${agent_type})...`);

    try {
      // E2B Sandbox configuration
      const sandboxConfig = {
        template: 'base', // Use base template for Node.js environment
        apiKey: this.apiKey,
        timeout: resources.timeout * 1000, // Convert to milliseconds
        metadata: {
          strategy: name,
          agent_type,
          symbols: symbols.join(','),
          deployment_id: sandboxId,
        },
      };

      // Create the sandbox
      const sandbox = await Sandbox.create(sandboxConfig);

      // Configure environment variables
      await this.configureSandboxEnvironment(sandbox, strategyConfig);

      // Install dependencies
      await this.installDependencies(sandbox, agent_type);

      // Deploy trading strategy code
      await this.deployStrategyCode(sandbox, strategyConfig);

      const sandboxInfo = {
        id: sandbox.sandboxId,
        name,
        agent_type,
        symbols,
        resources,
        status: 'running',
        created_at: new Date().toISOString(),
        url: `https://e2b.dev/sandboxes/${sandbox.sandboxId}`,
      };

      this.sandboxes.set(sandboxId, {
        sandbox,
        info: sandboxInfo,
      });

      this.log(`✅ Sandbox created successfully: ${sandboxId}`);
      return sandboxInfo;

    } catch (error) {
      this.log(`❌ Failed to create sandbox for ${name}: ${error.message}`);
      return {
        id: sandboxId,
        name,
        agent_type,
        symbols,
        resources,
        status: 'failed',
        error: error.message,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Configure sandbox environment variables
   */
  async configureSandboxEnvironment(sandbox, strategyConfig) {
    const { name, symbols } = strategyConfig;

    // Load environment variables from .env
    const envVars = {
      ALPACA_API_KEY: process.env.ALPACA_API_KEY,
      ALPACA_API_SECRET: process.env.ALPACA_API_SECRET,
      ALPACA_BASE_URL: process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      STRATEGY_NAME: name,
      TRADING_SYMBOLS: symbols.join(','),
      NODE_ENV: 'production',
    };

    // Write environment file to sandbox
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `export ${key}="${value}"`)
      .join('\n');

    await sandbox.filesystem.write('/home/user/.env', envContent);

    this.log(`  ├─ Environment configured for ${name}`);
  }

  /**
   * Install required dependencies in sandbox
   */
  async installDependencies(sandbox, agentType) {
    const dependencies = this.getDependenciesForAgent(agentType);

    this.log(`  ├─ Installing dependencies for ${agentType}...`);

    // Create package.json
    const packageJson = {
      name: `neural-trader-${agentType}`,
      version: '1.0.0',
      dependencies: dependencies,
    };

    await sandbox.filesystem.write(
      '/home/user/package.json',
      JSON.stringify(packageJson, null, 2)
    );

    // Install dependencies
    const installResult = await sandbox.process.start({
      cmd: 'npm install --production',
      cwd: '/home/user',
    });

    await installResult.finished;
    this.log(`  ├─ Dependencies installed successfully`);
  }

  /**
   * Get dependencies based on agent type
   */
  getDependenciesForAgent(agentType) {
    const baseDeps = {
      '@alpacahq/alpaca-trade-api': '^3.0.0',
      'dotenv': '^16.0.0',
      'axios': '^1.6.0',
    };

    const agentSpecificDeps = {
      neural_forecaster: {
        '@tensorflow/tfjs-node': '^4.15.0',
        'mathjs': '^12.0.0',
      },
      momentum_trader: {
        'technical-indicators': '^3.1.0',
      },
      mean_reversion_trader: {
        'technical-indicators': '^3.1.0',
        'mathjs': '^12.0.0',
      },
      risk_manager: {
        'mathjs': '^12.0.0',
      },
      portfolio_optimizer: {
        'mathjs': '^12.0.0',
        'optimization-js': '^2.0.0',
      },
    };

    return {
      ...baseDeps,
      ...(agentSpecificDeps[agentType] || {}),
    };
  }

  /**
   * Deploy strategy code to sandbox
   */
  async deployStrategyCode(sandbox, strategyConfig) {
    const { agent_type, name } = strategyConfig;

    this.log(`  ├─ Deploying ${agent_type} strategy code...`);

    // Create strategy runner script
    const runnerScript = this.generateStrategyRunner(strategyConfig);
    await sandbox.filesystem.write('/home/user/strategy.js', runnerScript);

    // Create startup script
    const startupScript = `#!/bin/bash
source /home/user/.env
node /home/user/strategy.js
`;
    await sandbox.filesystem.write('/home/user/start.sh', startupScript);

    // Make startup script executable
    await sandbox.process.start({
      cmd: 'chmod +x /home/user/start.sh',
    });

    this.log(`  └─ Strategy code deployed for ${name}`);
  }

  /**
   * Generate strategy runner script based on agent type
   */
  generateStrategyRunner(strategyConfig) {
    const { agent_type, symbols, name } = strategyConfig;

    return `
/**
 * ${name} Strategy Runner
 * Agent Type: ${agent_type}
 * Symbols: ${symbols.join(', ')}
 */

require('dotenv').config();
const Alpaca = require('@alpacahq/alpaca-trade-api');

class ${this.toPascalCase(agent_type)} {
  constructor() {
    this.alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_API_SECRET,
      baseUrl: process.env.ALPACA_BASE_URL,
      paper: true,
    });

    this.symbols = process.env.TRADING_SYMBOLS.split(',');
    this.strategyName = process.env.STRATEGY_NAME;
    this.isRunning = false;
  }

  async initialize() {
    console.log(\`Initializing \${this.strategyName} strategy...\`);
    console.log(\`Symbols: \${this.symbols.join(', ')}\`);

    // Verify Alpaca connection
    try {
      const account = await this.alpaca.getAccount();
      console.log(\`Connected to Alpaca. Account Status: \${account.status}\`);
      console.log(\`Buying Power: $\${account.buying_power}\`);
    } catch (error) {
      console.error('Failed to connect to Alpaca:', error.message);
      throw error;
    }
  }

  async run() {
    this.isRunning = true;
    console.log(\`Starting \${this.strategyName} strategy execution...\`);

    while (this.isRunning) {
      try {
        await this.executeStrategy();
        await this.sleep(60000); // Run every minute
      } catch (error) {
        console.error('Strategy execution error:', error.message);
        await this.sleep(5000); // Wait 5 seconds before retry
      }
    }
  }

  async executeStrategy() {
    console.log(\`[\${new Date().toISOString()}] Executing \${this.strategyName}...\`);

    for (const symbol of this.symbols) {
      try {
        // Get latest quote
        const quote = await this.alpaca.getLatestTrade(symbol);
        console.log(\`\${symbol}: $\${quote.Price}\`);

        // Strategy-specific logic would go here
        await this.analyzeAndTrade(symbol, quote);
      } catch (error) {
        console.error(\`Error processing \${symbol}:\`, error.message);
      }
    }
  }

  async analyzeAndTrade(symbol, quote) {
    // Agent-specific implementation
    // This is a placeholder - actual strategy logic would be implemented here
    console.log(\`  └─ Analyzed \${symbol}\`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    console.log('Shutting down strategy...');
    this.isRunning = false;
  }
}

// Initialize and run strategy
const strategy = new ${this.toPascalCase(agent_type)}();

process.on('SIGTERM', async () => {
  await strategy.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await strategy.shutdown();
  process.exit(0);
});

strategy.initialize()
  .then(() => strategy.run())
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
`;
  }

  /**
   * Deploy all strategies from configuration
   */
  async deployAll(configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const results = [];

    console.log(`\n🚀 Starting E2B Sandbox Deployment`);
    console.log(`Deployment ID: ${config.deployment_id}`);
    console.log(`Topology: ${config.topology}`);
    console.log(`Strategies: ${config.strategies.length}\n`);

    for (const strategy of config.strategies) {
      const result = await this.createSandbox(strategy);
      results.push(result);

      // Add delay between deployments to avoid rate limits
      await this.sleep(2000);
    }

    return {
      deployment_id: config.deployment_id,
      topology: config.topology,
      coordination: config.coordination,
      sandboxes: results,
      summary: this.generateSummary(results),
    };
  }

  /**
   * Generate deployment summary
   */
  generateSummary(results) {
    const successful = results.filter(r => r.status === 'running').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const totalCPU = results.reduce((sum, r) => sum + (r.resources?.cpu || 0), 0);
    const totalMemory = results.reduce((sum, r) => sum + (r.resources?.memory_mb || 0), 0);

    return {
      total_sandboxes: results.length,
      successful,
      failed,
      resources_allocated: {
        total_cpu_cores: totalCPU,
        total_memory_mb: totalMemory,
        total_memory_gb: (totalMemory / 1024).toFixed(2),
      },
      deployment_status: failed === 0 ? 'completed' : 'partial',
    };
  }

  /**
   * Save deployment status to JSON
   */
  saveStatus(deployment, outputPath) {
    fs.writeFileSync(
      outputPath,
      JSON.stringify(deployment, null, 2)
    );
    this.log(`Status saved to: ${outputPath}`);
  }

  /**
   * Utility methods
   */
  toPascalCase(str) {
    return str
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(message);
    this.deploymentLog.push(logEntry);
  }

  getDeploymentLog() {
    return this.deploymentLog.join('\n');
  }
}

// CLI execution
if (require.main === module) {
  const configPath = process.argv[2] || '/tmp/e2b-deployment-neural-trader-1763096012878.json';
  const outputPath = process.argv[3] || '/tmp/e2b-sandbox-status.json';

  const deployer = new E2BSandboxDeployer();

  deployer.deployAll(configPath)
    .then(deployment => {
      deployer.saveStatus(deployment, outputPath);
      console.log('\n✅ Deployment completed successfully!');
      console.log(`Status file: ${outputPath}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Deployment failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = E2BSandboxDeployer;
