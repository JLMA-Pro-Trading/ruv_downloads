#!/usr/bin/env node

/**
 * Main deployment command router
 * Handles cloud deployment to E2B sandbox and Flow Nexus
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const e2bCommand = require('./e2b');
const flowNexusCommand = require('./flow-nexus');
const listCommand = require('./list');
const statusCommand = require('./status');
const logsCommand = require('./logs');
const scaleCommand = require('./scale');
const stopCommand = require('./stop');
const deleteCommand = require('./delete');

/**
 * Create deployment command
 */
function createDeployCommand() {
  const deploy = new Command('deploy')
    .description('Deploy trading strategies to cloud platforms (E2B, Flow Nexus)')
    .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.cyan('# Deploy to E2B sandbox')}
  $ neural-trader deploy e2b momentum --template neural-trader --env-vars API_KEY=xxx

  ${chalk.cyan('# Deploy to Flow Nexus with swarm')}
  $ neural-trader deploy flow-nexus mean-reversion --swarm 5 --neural true

  ${chalk.cyan('# List all deployments')}
  $ neural-trader deploy list

  ${chalk.cyan('# View deployment status')}
  $ neural-trader deploy status deploy-abc123

  ${chalk.cyan('# Stream deployment logs')}
  $ neural-trader deploy logs deploy-abc123 --follow

  ${chalk.cyan('# Scale deployment')}
  $ neural-trader deploy scale deploy-abc123 10

  ${chalk.cyan('# Stop deployment')}
  $ neural-trader deploy stop deploy-abc123

  ${chalk.cyan('# Delete deployment')}
  $ neural-trader deploy delete deploy-abc123

${chalk.bold('Supported Platforms:')}
  ${chalk.green('E2B:')} Secure sandbox execution with isolated environments
  ${chalk.green('Flow Nexus:')} Distributed swarm deployment with neural network training

${chalk.bold('Features:')}
  • Automatic resource provisioning
  • Real-time log streaming
  • Dynamic scaling
  • Multi-region deployment
  • Environment variable management
  • Template-based configuration
    `);

  // Add subcommands
  deploy.addCommand(e2bCommand.createE2BCommand());
  deploy.addCommand(flowNexusCommand.createFlowNexusCommand());
  deploy.addCommand(listCommand.createListCommand());
  deploy.addCommand(statusCommand.createStatusCommand());
  deploy.addCommand(logsCommand.createLogsCommand());
  deploy.addCommand(scaleCommand.createScaleCommand());
  deploy.addCommand(stopCommand.createStopCommand());
  deploy.addCommand(deleteCommand.createDeleteCommand());

  return deploy;
}

/**
 * Deploy command handler (shows help if no subcommand)
 */
async function handleDeploy(options) {
  console.log(chalk.yellow('Please specify a deployment command. Use --help for more information.'));
  console.log();
  console.log(chalk.bold('Available commands:'));
  console.log(`  ${chalk.cyan('deploy e2b')}         - Deploy to E2B sandbox`);
  console.log(`  ${chalk.cyan('deploy flow-nexus')}  - Deploy to Flow Nexus platform`);
  console.log(`  ${chalk.cyan('deploy list')}        - List all deployments`);
  console.log(`  ${chalk.cyan('deploy status')}      - Get deployment status`);
  console.log(`  ${chalk.cyan('deploy logs')}        - View deployment logs`);
  console.log(`  ${chalk.cyan('deploy scale')}       - Scale deployment`);
  console.log(`  ${chalk.cyan('deploy stop')}        - Stop deployment`);
  console.log(`  ${chalk.cyan('deploy delete')}      - Delete deployment`);
  console.log();
  console.log(`Run ${chalk.cyan('neural-trader deploy --help')} for detailed information.`);
}

module.exports = {
  createDeployCommand,
  handleDeploy
};
