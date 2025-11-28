#!/usr/bin/env node

/**
 * Scale deployment command
 * Scale deployment instances up or down
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const inquirer = require('inquirer');
const DeploymentTracker = require('../../lib/deployment-tracker');
const E2BManager = require('../../lib/e2b-manager');
const FlowNexusClient = require('../../lib/flow-nexus-client');

/**
 * Create scale command
 */
function createScaleCommand() {
  const scale = new Command('scale')
    .description('Scale deployment instances')
    .argument('<deployment-id>', 'Deployment ID')
    .argument('<count>', 'Target number of instances')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--strategy <strategy>', 'Scaling strategy (gradual, immediate)', 'gradual')
    .option('--max-concurrent <count>', 'Maximum concurrent scaling operations', '3')
    .action(handleScale);

  return scale;
}

/**
 * Handle scale deployment
 */
async function handleScale(deploymentId, targetCount, options) {
  const spinner = ora('Loading deployment...').start();

  try {
    const count = parseInt(targetCount);
    if (isNaN(count) || count < 1) {
      spinner.fail('Invalid instance count');
      console.log();
      console.log(chalk.red('Instance count must be a positive number'));
      process.exit(1);
    }

    // Get deployment info
    const tracker = new DeploymentTracker();
    const deployment = await tracker.getDeployment(deploymentId);

    if (!deployment) {
      spinner.fail('Deployment not found');
      console.log();
      console.log(chalk.red(`Deployment ${deploymentId} not found`));
      console.log();
      console.log(chalk.gray('List all deployments:'));
      console.log(chalk.cyan('  neural-trader deploy list'));
      process.exit(1);
    }

    // Get current instance count
    const currentCount = deployment.instances || deployment.agents?.length || 1;
    const diff = count - currentCount;

    spinner.succeed('Deployment loaded');

    // Show scaling plan
    console.log();
    console.log(chalk.bold('Scaling Plan:'));
    console.log(`  ${chalk.gray('Deployment:')} ${chalk.cyan(deploymentId)}`);
    console.log(`  ${chalk.gray('Platform:')} ${chalk.cyan(formatPlatform(deployment.platform))}`);
    console.log(`  ${chalk.gray('Current instances:')} ${chalk.cyan(currentCount)}`);
    console.log(`  ${chalk.gray('Target instances:')} ${chalk.cyan(count)}`);

    if (diff > 0) {
      console.log(`  ${chalk.gray('Action:')} ${chalk.green(`Scale up by ${diff} instance(s)`)}`);
    } else if (diff < 0) {
      console.log(`  ${chalk.gray('Action:')} ${chalk.yellow(`Scale down by ${Math.abs(diff)} instance(s)`)}`);
    } else {
      console.log(`  ${chalk.gray('Action:')} ${chalk.blue('No scaling needed (already at target)')}`);
      return;
    }

    console.log(`  ${chalk.gray('Strategy:')} ${chalk.cyan(options.strategy)}`);
    console.log();

    // Confirm scaling (unless --yes)
    if (!options.yes) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: `Proceed with scaling to ${count} instance(s)?`,
          default: true
        }
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Scaling cancelled'));
        process.exit(0);
      }
    }

    // Initialize platform manager
    let manager;
    if (deployment.platform === 'e2b') {
      manager = new E2BManager();
    } else if (deployment.platform === 'flow-nexus' || deployment.platform === 'flow_nexus') {
      manager = new FlowNexusClient();
    } else {
      throw new Error(`Unsupported platform: ${deployment.platform}`);
    }

    await manager.initialize();

    // Perform scaling
    spinner.start(`Scaling deployment to ${count} instance(s)...`);

    const scaleOptions = {
      strategy: options.strategy,
      maxConcurrent: parseInt(options.maxConcurrent)
    };

    const result = await manager.scaleDeployment(deploymentId, count, scaleOptions);

    spinner.succeed(`Deployment scaled to ${count} instance(s)`);

    // Update tracker
    await tracker.updateDeployment(deploymentId, {
      instances: count,
      lastScaled: new Date().toISOString()
    });

    // Show results
    console.log();
    console.log(chalk.bold.green('✓ Scaling successful!'));
    console.log();
    console.log(chalk.bold('Scaling Results:'));
    console.log(`  ${chalk.gray('New instances:')} ${chalk.green(result.added || 0)}`);
    console.log(`  ${chalk.gray('Removed instances:')} ${chalk.yellow(result.removed || 0)}`);
    console.log(`  ${chalk.gray('Total instances:')} ${chalk.cyan(count)}`);
    console.log(`  ${chalk.gray('Duration:')} ${chalk.cyan(`${result.duration || 0}s`)}`);
    console.log();

    // Show instance details
    if (result.instances && result.instances.length > 0) {
      console.log(chalk.bold('Active Instances:'));
      result.instances.forEach((instance, index) => {
        console.log(`  ${index + 1}. ${chalk.cyan(instance.id)} - ${formatStatus(instance.status)}`);
      });
      console.log();
    }

    // Show next steps
    console.log(chalk.bold('Next Steps:'));
    console.log(`  ${chalk.cyan(`neural-trader deploy status ${deploymentId}`)}  - Check deployment status`);
    console.log(`  ${chalk.cyan(`neural-trader deploy logs ${deploymentId}`)}    - View logs`);

  } catch (error) {
    spinner.fail('Scaling failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    if (error.details) {
      console.error(chalk.gray(error.details));
    }
    process.exit(1);
  }
}

/**
 * Format platform name
 */
function formatPlatform(platform) {
  const platformMap = {
    'e2b': 'E2B Sandbox',
    'flow-nexus': 'Flow Nexus',
    'flow_nexus': 'Flow Nexus'
  };

  return platformMap[platform?.toLowerCase()] || platform || 'Unknown';
}

/**
 * Format status with colors
 */
function formatStatus(status) {
  const statusMap = {
    running: chalk.green('Running'),
    starting: chalk.blue('Starting'),
    stopped: chalk.yellow('Stopped'),
    failed: chalk.red('Failed')
  };

  return statusMap[status?.toLowerCase()] || chalk.gray(status || 'Unknown');
}

module.exports = {
  createScaleCommand,
  handleScale
};
