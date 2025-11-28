#!/usr/bin/env node

/**
 * Deployment status command
 * Get detailed status of a specific deployment
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const Table = require('cli-table3');
const DeploymentTracker = require('../../lib/deployment-tracker');
const E2BManager = require('../../lib/e2b-manager');
const FlowNexusClient = require('../../lib/flow-nexus-client');

/**
 * Create status command
 */
function createStatusCommand() {
  const status = new Command('status')
    .description('Get deployment status and details')
    .argument('<deployment-id>', 'Deployment ID')
    .option('--json', 'Output as JSON')
    .option('--metrics', 'Include performance metrics')
    .option('--watch', 'Watch status updates')
    .option('--refresh <seconds>', 'Refresh interval for watch mode', '5')
    .action(handleStatus);

  return status;
}

/**
 * Handle deployment status
 */
async function handleStatus(deploymentId, options) {
  const spinner = ora('Loading deployment status...').start();

  try {
    // Get deployment from tracker
    const tracker = new DeploymentTracker();
    let deployment = await tracker.getDeployment(deploymentId);

    if (!deployment) {
      spinner.fail('Deployment not found');
      console.log();
      console.log(chalk.red(`Deployment ${deploymentId} not found`));
      console.log();
      console.log(chalk.gray('List all deployments:'));
      console.log(chalk.cyan('  neural-trader deploy list'));
      process.exit(1);
    }

    // Get real-time status from platform
    let platformStatus;
    if (deployment.platform === 'e2b') {
      const e2bManager = new E2BManager();
      await e2bManager.initialize();
      platformStatus = await e2bManager.getDeploymentStatus(deploymentId);
    } else if (deployment.platform === 'flow-nexus' || deployment.platform === 'flow_nexus') {
      const flowNexusClient = new FlowNexusClient();
      await flowNexusClient.initialize();
      platformStatus = await flowNexusClient.getDeploymentStatus(deploymentId);
    }

    // Merge local and platform status
    deployment = { ...deployment, ...platformStatus };

    spinner.succeed('Deployment status loaded');

    // Output as JSON if requested
    if (options.json) {
      console.log(JSON.stringify(deployment, null, 2));
      return;
    }

    // Display deployment details
    displayDeploymentStatus(deployment, options);

    // Watch mode
    if (options.watch) {
      console.log();
      console.log(chalk.bold('Watching deployment status...'));
      console.log(chalk.gray(`Press Ctrl+C to stop (refreshing every ${options.refresh}s)`));
      console.log();

      const refreshInterval = parseInt(options.refresh) * 1000;
      await watchStatus(deploymentId, deployment.platform, refreshInterval);
    }

  } catch (error) {
    spinner.fail('Failed to get deployment status');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Display deployment status
 */
function displayDeploymentStatus(deployment, options) {
  console.log();
  console.log(chalk.bold('Deployment Status:'));
  console.log();

  // Basic information
  const basicTable = new Table({
    colWidths: [25, 70]
  });
  basicTable.push(
    ['Deployment ID', chalk.cyan(deployment.id)],
    ['Strategy', chalk.cyan(deployment.strategy || deployment.config?.strategy)],
    ['Platform', formatPlatform(deployment.platform)],
    ['Status', formatStatus(deployment.status)],
    ['Region', chalk.cyan(deployment.region || deployment.config?.region)],
    ['Created', chalk.cyan(new Date(deployment.createdAt).toLocaleString())],
    ['Uptime', chalk.cyan(calculateUptime(deployment.createdAt))]
  );
  console.log(basicTable.toString());

  // Instance/Agent information
  console.log();
  console.log(chalk.bold('Instances:'));
  console.log();

  const instances = deployment.sandboxes || deployment.agents || [];
  if (instances.length > 0) {
    const instanceTable = new Table({
      head: [
        chalk.bold('ID'),
        chalk.bold('Status'),
        chalk.bold('CPU'),
        chalk.bold('Memory'),
        chalk.bold('Uptime')
      ],
      colWidths: [20, 12, 10, 12, 12]
    });

    instances.forEach(instance => {
      instanceTable.push([
        chalk.cyan(instance.id.substring(0, 16)),
        formatStatus(instance.status),
        instance.cpu ? `${instance.cpu}%` : 'N/A',
        instance.memory ? formatMemory(instance.memory) : 'N/A',
        instance.startedAt ? calculateUptime(instance.startedAt) : 'N/A'
      ]);
    });

    console.log(instanceTable.toString());
  } else {
    console.log(chalk.gray('  No instances found'));
  }

  // Performance metrics
  if (options.metrics && deployment.metrics) {
    console.log();
    console.log(chalk.bold('Performance Metrics:'));
    console.log();

    const metricsTable = new Table({
      colWidths: [30, 40]
    });

    metricsTable.push(
      ['Total Trades', chalk.cyan(deployment.metrics.totalTrades || 0)],
      ['Successful Trades', chalk.green(deployment.metrics.successfulTrades || 0)],
      ['Failed Trades', chalk.red(deployment.metrics.failedTrades || 0)],
      ['Average Latency', chalk.cyan(`${deployment.metrics.avgLatency || 0}ms`)],
      ['Throughput', chalk.cyan(`${deployment.metrics.throughput || 0} trades/sec`)],
      ['Error Rate', deployment.metrics.errorRate > 5 ? chalk.red(`${deployment.metrics.errorRate}%`) : chalk.green(`${deployment.metrics.errorRate || 0}%`)],
      ['CPU Usage (Avg)', chalk.cyan(`${deployment.metrics.avgCpu || 0}%`)],
      ['Memory Usage (Avg)', chalk.cyan(formatMemory(deployment.metrics.avgMemory || 0))]
    );

    console.log(metricsTable.toString());
  }

  // Configuration
  if (deployment.config) {
    console.log();
    console.log(chalk.bold('Configuration:'));
    console.log();

    const configTable = new Table({
      colWidths: [25, 70]
    });

    if (deployment.config.swarm) {
      configTable.push(
        ['Swarm Topology', chalk.cyan(deployment.config.swarm.topology)],
        ['Swarm Agents', chalk.cyan(deployment.config.swarm.count)]
      );
    }

    if (deployment.config.neural) {
      configTable.push(['Neural Network', chalk.green('Enabled')]);
    }

    if (deployment.config.autoScale) {
      configTable.push(
        ['Auto-Scaling', chalk.green('Enabled')],
        ['Scale Range', chalk.cyan(`${deployment.config.swarm.minAgents}-${deployment.config.swarm.maxAgents} agents`)]
      );
    }

    if (deployment.config.resources) {
      configTable.push(
        ['CPU per Instance', chalk.cyan(`${deployment.config.resources.cpu} cores`)],
        ['Memory per Instance', chalk.cyan(`${deployment.config.resources.memory} GB`)]
      );
    }

    console.log(configTable.toString());
  }

  // Show helpful commands
  console.log();
  console.log(chalk.bold('Commands:'));
  console.log(`  ${chalk.cyan(`neural-trader deploy logs ${deployment.id}`)}    - View logs`);
  console.log(`  ${chalk.cyan(`neural-trader deploy scale ${deployment.id} N`)} - Scale deployment`);
  console.log(`  ${chalk.cyan(`neural-trader deploy stop ${deployment.id}`)}    - Stop deployment`);
  console.log(`  ${chalk.cyan(`neural-trader deploy delete ${deployment.id}`)}  - Delete deployment`);
}

/**
 * Watch deployment status
 */
async function watchStatus(deploymentId, platform, refreshInterval) {
  let manager;

  if (platform === 'e2b') {
    manager = new E2BManager();
  } else {
    manager = new FlowNexusClient();
  }

  await manager.initialize();

  const watchInterval = setInterval(async () => {
    try {
      const status = await manager.getDeploymentStatus(deploymentId);

      // Clear console and redisplay
      console.clear();
      console.log(chalk.bold('Watching deployment status...'));
      console.log(chalk.gray(`Last updated: ${new Date().toLocaleTimeString()}`));
      displayDeploymentStatus({ ...status, id: deploymentId, platform }, { metrics: true });

    } catch (error) {
      console.error(chalk.red(`Error updating status: ${error.message}`));
    }
  }, refreshInterval);

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(watchInterval);
    console.log();
    console.log(chalk.yellow('Stopped watching deployment'));
    process.exit(0);
  });
}

/**
 * Format status with colors
 */
function formatStatus(status) {
  const statusMap = {
    running: chalk.green('Running'),
    stopped: chalk.yellow('Stopped'),
    failed: chalk.red('Failed'),
    deploying: chalk.blue('Deploying'),
    stopping: chalk.yellow('Stopping'),
    scaling: chalk.blue('Scaling')
  };

  return statusMap[status?.toLowerCase()] || chalk.gray(status || 'Unknown');
}

/**
 * Format platform name
 */
function formatPlatform(platform) {
  const platformMap = {
    'e2b': chalk.cyan('E2B Sandbox'),
    'flow-nexus': chalk.cyan('Flow Nexus'),
    'flow_nexus': chalk.cyan('Flow Nexus')
  };

  return platformMap[platform?.toLowerCase()] || chalk.cyan(platform || 'Unknown');
}

/**
 * Calculate uptime
 */
function calculateUptime(createdAt) {
  if (!createdAt) return 'N/A';

  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now - created;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format memory usage
 */
function formatMemory(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

module.exports = {
  createStatusCommand,
  handleStatus
};
