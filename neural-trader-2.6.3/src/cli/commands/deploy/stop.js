#!/usr/bin/env node

/**
 * Stop deployment command
 * Stop a running deployment
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const inquirer = require('inquirer');
const DeploymentTracker = require('../../lib/deployment-tracker');
const E2BManager = require('../../lib/e2b-manager');
const FlowNexusClient = require('../../lib/flow-nexus-client');

/**
 * Create stop command
 */
function createStopCommand() {
  const stop = new Command('stop')
    .description('Stop a running deployment')
    .argument('<deployment-id>', 'Deployment ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--graceful', 'Graceful shutdown with cleanup', true)
    .option('--timeout <seconds>', 'Shutdown timeout', '30')
    .action(handleStop);

  return stop;
}

/**
 * Handle stop deployment
 */
async function handleStop(deploymentId, options) {
  const spinner = ora('Loading deployment...').start();

  try {
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

    if (deployment.status === 'stopped') {
      spinner.warn('Deployment already stopped');
      console.log();
      console.log(chalk.yellow(`Deployment ${deploymentId} is already stopped`));
      return;
    }

    spinner.succeed('Deployment loaded');

    // Show stop plan
    console.log();
    console.log(chalk.bold('Stop Deployment:'));
    console.log(`  ${chalk.gray('Deployment:')} ${chalk.cyan(deploymentId)}`);
    console.log(`  ${chalk.gray('Strategy:')} ${chalk.cyan(deployment.strategy || 'Unknown')}`);
    console.log(`  ${chalk.gray('Platform:')} ${chalk.cyan(formatPlatform(deployment.platform))}`);
    console.log(`  ${chalk.gray('Instances:')} ${chalk.cyan(deployment.instances || 1)}`);
    console.log(`  ${chalk.gray('Shutdown mode:')} ${chalk.cyan(options.graceful ? 'Graceful' : 'Immediate')}`);
    console.log();

    // Confirm stop (unless --yes)
    if (!options.yes) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Stop this deployment?',
          default: true
        }
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Stop cancelled'));
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

    // Stop deployment
    spinner.start('Stopping deployment...');

    const stopOptions = {
      graceful: options.graceful,
      timeout: parseInt(options.timeout)
    };

    const result = await manager.stopDeployment(deploymentId, stopOptions);

    spinner.succeed('Deployment stopped');

    // Update tracker
    await tracker.updateDeployment(deploymentId, {
      status: 'stopped',
      stoppedAt: new Date().toISOString()
    });

    // Show results
    console.log();
    console.log(chalk.bold.green('✓ Deployment stopped successfully!'));
    console.log();
    console.log(chalk.bold('Summary:'));
    console.log(`  ${chalk.gray('Instances stopped:')} ${chalk.cyan(result.instancesStopped || 0)}`);
    console.log(`  ${chalk.gray('Duration:')} ${chalk.cyan(`${result.duration || 0}s`)}`);
    console.log();

    // Show next steps
    console.log(chalk.bold('Next Steps:'));
    console.log(`  ${chalk.cyan(`neural-trader deploy status ${deploymentId}`)}  - Check deployment status`);
    console.log(`  ${chalk.cyan(`neural-trader deploy delete ${deploymentId}`)}  - Delete deployment`);
    console.log(`  ${chalk.cyan(`neural-trader deploy e2b <strategy>`)}          - Create new deployment`);

  } catch (error) {
    spinner.fail('Failed to stop deployment');
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

module.exports = {
  createStopCommand,
  handleStop
};
