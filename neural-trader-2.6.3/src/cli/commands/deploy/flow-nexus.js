#!/usr/bin/env node

/**
 * Flow Nexus deployment command
 * Deploy trading strategies to Flow Nexus platform with swarm support
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const inquirer = require('inquirer');
const Table = require('cli-table3');
const FlowNexusClient = require('../../lib/flow-nexus-client');
const DeploymentTracker = require('../../lib/deployment-tracker');
const { validateDeploymentConfig, loadTemplate } = require('../../lib/deployment-validator');

/**
 * Create Flow Nexus deployment command
 */
function createFlowNexusCommand() {
  const flowNexus = new Command('flow-nexus')
    .description('Deploy trading strategy to Flow Nexus platform')
    .argument('<strategy>', 'Trading strategy name')
    .option('-s, --swarm <count>', 'Number of swarm agents', '1')
    .option('-t, --topology <type>', 'Swarm topology (mesh, hierarchical, ring)', 'mesh')
    .option('-n, --neural', 'Enable neural network training')
    .option('-e, --env-vars <vars>', 'Environment variables (KEY=value,KEY2=value2)')
    .option('-r, --region <region>', 'Deployment region', 'us-east')
    .option('--cpu <cores>', 'CPU cores per agent', '2')
    .option('--memory <gb>', 'Memory per agent (GB)', '4')
    .option('--workflow', 'Enable workflow automation')
    .option('--realtime', 'Enable real-time monitoring')
    .option('--auto-scale', 'Enable automatic scaling')
    .option('--min-agents <count>', 'Minimum agents for auto-scaling', '1')
    .option('--max-agents <count>', 'Maximum agents for auto-scaling', '10')
    .option('--dry-run', 'Simulate deployment without executing')
    .option('-c, --config <file>', 'Load configuration from file')
    .option('--watch', 'Watch deployment after creation')
    .action(handleFlowNexusDeploy);

  return flowNexus;
}

/**
 * Handle Flow Nexus deployment
 */
async function handleFlowNexusDeploy(strategy, options) {
  const spinner = ora('Initializing Flow Nexus deployment...').start();

  try {
    // Load configuration
    let config = {
      strategy,
      platform: 'flow-nexus',
      swarm: {
        count: parseInt(options.swarm),
        topology: options.topology,
        minAgents: parseInt(options.minAgents || options.swarm),
        maxAgents: parseInt(options.maxAgents || options.swarm)
      },
      neural: options.neural || false,
      workflow: options.workflow || false,
      realtime: options.realtime || false,
      autoScale: options.autoScale || false,
      region: options.region,
      resources: {
        cpu: parseInt(options.cpu),
        memory: parseInt(options.memory)
      },
      envVars: parseEnvVars(options.envVars)
    };

    // Load config file if specified
    if (options.config) {
      spinner.text = 'Loading configuration file...';
      const fileConfig = await loadTemplate(options.config);
      config = { ...config, ...fileConfig };
    }

    // Validate configuration
    spinner.text = 'Validating deployment configuration...';
    const validation = validateDeploymentConfig(config);
    if (!validation.valid) {
      spinner.fail('Configuration validation failed');
      console.log();
      console.log(chalk.red('Validation Errors:'));
      validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
      process.exit(1);
    }

    spinner.succeed('Configuration validated');

    // Initialize Flow Nexus client
    spinner.start('Connecting to Flow Nexus...');
    const client = new FlowNexusClient();

    // Check authentication
    const isAuthenticated = await client.checkAuth();
    if (!isAuthenticated) {
      spinner.warn('Not authenticated with Flow Nexus');
      console.log();
      console.log(chalk.yellow('Please authenticate with Flow Nexus:'));
      console.log(chalk.cyan('  npx flow-nexus@latest login'));
      console.log(chalk.gray('Or:'));
      console.log(chalk.cyan('  neural-trader auth flow-nexus'));
      process.exit(1);
    }

    await client.initialize();
    spinner.succeed('Connected to Flow Nexus');

    // Show deployment summary
    console.log();
    console.log(chalk.bold('Deployment Configuration:'));
    const summaryTable = new Table({
      colWidths: [25, 50]
    });
    summaryTable.push(
      ['Strategy', chalk.cyan(config.strategy)],
      ['Platform', chalk.cyan('Flow Nexus')],
      ['Swarm Agents', chalk.cyan(config.swarm.count)],
      ['Topology', chalk.cyan(config.swarm.topology)],
      ['Neural Network', chalk.cyan(config.neural ? 'Enabled' : 'Disabled')],
      ['Workflow Automation', chalk.cyan(config.workflow ? 'Enabled' : 'Disabled')],
      ['Real-time Monitoring', chalk.cyan(config.realtime ? 'Enabled' : 'Disabled')],
      ['Auto-Scaling', chalk.cyan(config.autoScale ? `${config.swarm.minAgents}-${config.swarm.maxAgents} agents` : 'Disabled')],
      ['Region', chalk.cyan(config.region)],
      ['CPU per Agent', chalk.cyan(`${config.resources.cpu} cores`)],
      ['Memory per Agent', chalk.cyan(`${config.resources.memory} GB`)]
    );
    console.log(summaryTable.toString());
    console.log();

    // Confirm deployment (unless dry-run)
    if (!options.dryRun) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Proceed with deployment?',
          default: true
        }
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Deployment cancelled'));
        process.exit(0);
      }
    }

    if (options.dryRun) {
      console.log(chalk.yellow('DRY RUN MODE - No actual deployment'));
      console.log(chalk.green('✓ Configuration is valid and ready for deployment'));
      return;
    }

    // Create swarm deployment
    spinner.start('Initializing swarm...');
    const deployment = await client.createSwarmDeployment(config);
    spinner.succeed('Swarm initialized');

    // Upload strategy
    spinner.start('Uploading strategy code...');
    await client.uploadStrategy(deployment.id, config.strategy);
    spinner.succeed('Strategy code uploaded');

    // Configure neural network if enabled
    if (config.neural) {
      spinner.start('Configuring neural network...');
      await client.configureNeuralNetwork(deployment.id, {
        architecture: 'lstm',
        layers: [128, 64, 32],
        optimizer: 'adam'
      });
      spinner.succeed('Neural network configured');
    }

    // Configure workflow automation if enabled
    if (config.workflow) {
      spinner.start('Setting up workflow automation...');
      await client.configureWorkflow(deployment.id, {
        events: ['trade_signal', 'position_update', 'risk_alert'],
        actions: ['execute_trade', 'adjust_position', 'notify']
      });
      spinner.succeed('Workflow automation configured');
    }

    // Start deployment
    spinner.start('Starting deployment...');
    await client.startDeployment(deployment.id);
    spinner.succeed('Deployment started');

    // Save deployment metadata
    const tracker = new DeploymentTracker();
    await tracker.saveDeployment({
      ...deployment,
      config,
      createdAt: new Date().toISOString()
    });

    // Show deployment info
    console.log();
    console.log(chalk.bold.green('✓ Deployment successful!'));
    console.log();
    console.log(chalk.bold('Deployment Information:'));
    const infoTable = new Table({
      colWidths: [25, 70]
    });
    infoTable.push(
      ['Deployment ID', chalk.cyan(deployment.id)],
      ['Status', chalk.green('Running')],
      ['Swarm Agents', chalk.cyan(deployment.agents.length)],
      ['Topology', chalk.cyan(config.swarm.topology)],
      ['Region', chalk.cyan(config.region)],
      ['Dashboard URL', chalk.cyan(deployment.dashboardUrl || 'https://flow-nexus.ruv.io/dashboard')],
      ['Created', chalk.cyan(new Date().toLocaleString())]
    );
    console.log(infoTable.toString());
    console.log();

    // Show next steps
    console.log(chalk.bold('Next Steps:'));
    console.log(`  ${chalk.cyan(`neural-trader deploy status ${deployment.id}`)}  - Check deployment status`);
    console.log(`  ${chalk.cyan(`neural-trader deploy logs ${deployment.id}`)}    - View logs`);
    console.log(`  ${chalk.cyan(`neural-trader deploy scale ${deployment.id} 10`)} - Scale to 10 agents`);
    console.log(`  ${chalk.cyan(`neural-trader deploy stop ${deployment.id}`)}    - Stop deployment`);

    // Watch deployment if requested
    if (options.watch) {
      console.log();
      console.log(chalk.bold('Monitoring deployment...'));
      console.log(chalk.gray('Press Ctrl+C to stop'));
      console.log();
      await client.watchDeployment(deployment.id);
    }

  } catch (error) {
    spinner.fail('Deployment failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    if (error.details) {
      console.error(chalk.gray(error.details));
    }
    process.exit(1);
  }
}

/**
 * Parse environment variables from string
 */
function parseEnvVars(envVarsString) {
  if (!envVarsString) return {};

  const envVars = {};
  envVarsString.split(',').forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });

  return envVars;
}

module.exports = {
  createFlowNexusCommand,
  handleFlowNexusDeploy
};
