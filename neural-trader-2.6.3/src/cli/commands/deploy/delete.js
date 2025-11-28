#!/usr/bin/env node

/**
 * Delete deployment command
 * Permanently delete a deployment and all its resources
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const inquirer = require('inquirer');
const DeploymentTracker = require('../../lib/deployment-tracker');
const E2BManager = require('../../lib/e2b-manager');
const FlowNexusClient = require('../../lib/flow-nexus-client');

/**
 * Create delete command
 */
function createDeleteCommand() {
  const deleteCmd = new Command('delete')
    .description('Delete a deployment permanently')
    .argument('<deployment-id>', 'Deployment ID')
    .option('-y, --yes', 'Skip confirmation prompt')
    .option('--force', 'Force delete even if running')
    .option('--keep-data', 'Keep deployment data/logs')
    .action(handleDelete);

  return deleteCmd;
}

/**
 * Handle delete deployment
 */
async function handleDelete(deploymentId, options) {
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

    spinner.succeed('Deployment loaded');

    // Check if deployment is running
    if (deployment.status === 'running' && !options.force) {
      console.log();
      console.log(chalk.red('Cannot delete a running deployment'));
      console.log();
      console.log(chalk.yellow('Please stop the deployment first:'));
      console.log(chalk.cyan(`  neural-trader deploy stop ${deploymentId}`));
      console.log();
      console.log(chalk.gray('Or use --force to delete anyway:'));
      console.log(chalk.cyan(`  neural-trader deploy delete ${deploymentId} --force`));
      process.exit(1);
    }

    // Show delete plan
    console.log();
    console.log(chalk.bold.red('⚠️  Delete Deployment'));
    console.log();
    console.log(chalk.yellow('This will permanently delete:'));
    console.log(`  ${chalk.gray('•')} Deployment ${chalk.cyan(deploymentId)}`);
    console.log(`  ${chalk.gray('•')} Strategy: ${chalk.cyan(deployment.strategy || 'Unknown')}`);
    console.log(`  ${chalk.gray('•')} Platform: ${chalk.cyan(formatPlatform(deployment.platform))}`);
    console.log(`  ${chalk.gray('•')} All ${chalk.cyan(deployment.instances || 1)} instance(s)`);

    if (!options.keepData) {
      console.log(`  ${chalk.gray('•')} All logs and data`);
    }

    console.log();
    console.log(chalk.red.bold('This action cannot be undone!'));
    console.log();

    // Confirm deletion (unless --yes)
    if (!options.yes) {
      const { confirmed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmed',
          message: 'Are you sure you want to delete this deployment?',
          default: false
        }
      ]);

      if (!confirmed) {
        console.log(chalk.yellow('Deletion cancelled'));
        process.exit(0);
      }

      // Double confirmation for force delete
      if (options.force && deployment.status === 'running') {
        const { doubleConfirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'doubleConfirmed',
            message: chalk.red('Deployment is still running. Really force delete?'),
            default: false
          }
        ]);

        if (!doubleConfirmed) {
          console.log(chalk.yellow('Deletion cancelled'));
          process.exit(0);
        }
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

    // Stop deployment if running
    if (deployment.status === 'running' && options.force) {
      spinner.start('Stopping deployment...');
      await manager.stopDeployment(deploymentId, { graceful: false, timeout: 10 });
      spinner.succeed('Deployment stopped');
    }

    // Delete deployment
    spinner.start('Deleting deployment...');

    const deleteOptions = {
      keepData: options.keepData || false
    };

    const result = await manager.deleteDeployment(deploymentId, deleteOptions);

    spinner.succeed('Deployment deleted from platform');

    // Remove from local tracker
    spinner.start('Removing local deployment data...');
    await tracker.deleteDeployment(deploymentId);
    spinner.succeed('Local deployment data removed');

    // Show results
    console.log();
    console.log(chalk.bold.green('✓ Deployment deleted successfully!'));
    console.log();
    console.log(chalk.bold('Deletion Summary:'));
    console.log(`  ${chalk.gray('Deployment ID:')} ${chalk.cyan(deploymentId)}`);
    console.log(`  ${chalk.gray('Instances deleted:')} ${chalk.cyan(result.instancesDeleted || 0)}`);

    if (options.keepData) {
      console.log(`  ${chalk.gray('Data preserved:')} ${chalk.green('Yes')}`);
    } else {
      console.log(`  ${chalk.gray('Data deleted:')} ${chalk.cyan(result.dataDeleted || 0)} items`);
    }

    console.log(`  ${chalk.gray('Duration:')} ${chalk.cyan(`${result.duration || 0}s`)}`);
    console.log();

    // Show next steps
    console.log(chalk.bold('Next Steps:'));
    console.log(`  ${chalk.cyan('neural-trader deploy list')}                    - View remaining deployments`);
    console.log(`  ${chalk.cyan('neural-trader deploy e2b <strategy>')}         - Create new E2B deployment`);
    console.log(`  ${chalk.cyan('neural-trader deploy flow-nexus <strategy>')}  - Create new Flow Nexus deployment`);

  } catch (error) {
    spinner.fail('Failed to delete deployment');
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
  createDeleteCommand,
  handleDelete
};
