#!/usr/bin/env node

/**
 * E2B Sandbox deployment command
 * Deploy trading strategies to E2B secure sandboxes
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const inquirer = require('inquirer');
const Table = require('cli-table3');
const E2BManager = require('../../lib/e2b-manager');
const DeploymentTracker = require('../../lib/deployment-tracker');
const { validateDeploymentConfig, loadTemplate } = require('../../lib/deployment-validator');

/**
 * Create E2B deployment command
 */
function createE2BCommand() {
  const e2b = new Command('e2b')
    .description('Deploy trading strategy to E2B sandbox')
    .argument('<strategy>', 'Trading strategy name (momentum, mean-reversion, etc.)')
    .option('-t, --template <name>', 'E2B template to use', 'neural-trader-base')
    .option('-e, --env-vars <vars>', 'Environment variables (KEY=value,KEY2=value2)')
    .option('-s, --scale <count>', 'Number of sandbox instances', '1')
    .option('-r, --region <region>', 'Deployment region (us-east, us-west, eu-central)', 'us-east')
    .option('--cpu <cores>', 'CPU cores per sandbox', '2')
    .option('--memory <gb>', 'Memory per sandbox (GB)', '4')
    .option('--timeout <seconds>', 'Execution timeout', '3600')
    .option('--auto-restart', 'Automatically restart on failure')
    .option('--dry-run', 'Simulate deployment without executing')
    .option('-c, --config <file>', 'Load configuration from file')
    .option('--watch', 'Watch logs after deployment')
    .action(handleE2BDeploy);

  return e2b;
}

/**
 * Handle E2B deployment
 */
async function handleE2BDeploy(strategy, options) {
  const spinner = ora('Initializing E2B deployment...').start();

  try {
    // Load configuration
    let config = {
      strategy,
      platform: 'e2b',
      template: options.template,
      scale: parseInt(options.scale),
      region: options.region,
      resources: {
        cpu: parseInt(options.cpu),
        memory: parseInt(options.memory),
        timeout: parseInt(options.timeout)
      },
      autoRestart: options.autoRestart || false,
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

    // Show deployment summary
    console.log();
    console.log(chalk.bold('Deployment Configuration:'));
    const summaryTable = new Table({
      colWidths: [25, 50]
    });
    summaryTable.push(
      ['Strategy', chalk.cyan(config.strategy)],
      ['Platform', chalk.cyan('E2B Sandbox')],
      ['Template', chalk.cyan(config.template)],
      ['Instances', chalk.cyan(config.scale)],
      ['Region', chalk.cyan(config.region)],
      ['CPU Cores', chalk.cyan(`${config.resources.cpu} cores`)],
      ['Memory', chalk.cyan(`${config.resources.memory} GB`)],
      ['Timeout', chalk.cyan(`${config.resources.timeout}s`)],
      ['Auto-Restart', chalk.cyan(config.autoRestart ? 'Enabled' : 'Disabled')]
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

    // Initialize E2B manager
    spinner.start('Connecting to E2B...');
    const e2bManager = new E2BManager();
    await e2bManager.initialize();
    spinner.succeed('Connected to E2B');

    // Create sandboxes
    spinner.start(`Creating ${config.scale} sandbox instance(s)...`);
    const deployment = await e2bManager.createDeployment(config);
    spinner.succeed(`Created ${config.scale} sandbox instance(s)`);

    // Upload strategy code
    spinner.start('Uploading strategy code...');
    await e2bManager.uploadStrategy(deployment.id, config.strategy);
    spinner.succeed('Strategy code uploaded');

    // Configure environment
    spinner.start('Configuring environment...');
    await e2bManager.configureEnvironment(deployment.id, config.envVars);
    spinner.succeed('Environment configured');

    // Start execution
    spinner.start('Starting strategy execution...');
    await e2bManager.startExecution(deployment.id);
    spinner.succeed('Strategy execution started');

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
      ['Sandboxes', chalk.cyan(deployment.sandboxes.map(s => s.id).join(', '))],
      ['Region', chalk.cyan(config.region)],
      ['Created', chalk.cyan(new Date().toLocaleString())]
    );
    console.log(infoTable.toString());
    console.log();

    // Show next steps
    console.log(chalk.bold('Next Steps:'));
    console.log(`  ${chalk.cyan(`neural-trader deploy status ${deployment.id}`)}  - Check deployment status`);
    console.log(`  ${chalk.cyan(`neural-trader deploy logs ${deployment.id}`)}    - View logs`);
    console.log(`  ${chalk.cyan(`neural-trader deploy scale ${deployment.id} 5`)} - Scale to 5 instances`);
    console.log(`  ${chalk.cyan(`neural-trader deploy stop ${deployment.id}`)}    - Stop deployment`);

    // Watch logs if requested
    if (options.watch) {
      console.log();
      console.log(chalk.bold('Streaming logs...'));
      console.log(chalk.gray('Press Ctrl+C to stop'));
      console.log();
      await e2bManager.watchLogs(deployment.id);
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
  createE2BCommand,
  handleE2BDeploy
};
