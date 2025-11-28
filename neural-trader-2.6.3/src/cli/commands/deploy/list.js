#!/usr/bin/env node

/**
 * List deployments command
 * Show all active and historical deployments
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const Table = require('cli-table3');
const DeploymentTracker = require('../../lib/deployment-tracker');
const E2BManager = require('../../lib/e2b-manager');
const FlowNexusClient = require('../../lib/flow-nexus-client');

/**
 * Create list deployments command
 */
function createListCommand() {
  const list = new Command('list')
    .description('List all deployments')
    .option('-p, --platform <platform>', 'Filter by platform (e2b, flow-nexus)')
    .option('-s, --status <status>', 'Filter by status (running, stopped, failed)')
    .option('-l, --limit <count>', 'Limit number of results', '20')
    .option('--json', 'Output as JSON')
    .option('--all', 'Show all deployments including deleted')
    .action(handleList);

  return list;
}

/**
 * Handle list deployments
 */
async function handleList(options) {
  const spinner = ora('Loading deployments...').start();

  try {
    const tracker = new DeploymentTracker();
    const filters = {
      platform: options.platform,
      status: options.status,
      includeDeleted: options.all || false
    };

    // Get local deployments
    let deployments = await tracker.listDeployments(filters);

    // Sync with remote platforms
    spinner.text = 'Syncing with remote platforms...';

    // Sync with E2B
    if (!options.platform || options.platform === 'e2b') {
      try {
        const e2bManager = new E2BManager();
        await e2bManager.initialize();
        const e2bDeployments = await e2bManager.listDeployments();
        deployments = mergeDeployments(deployments, e2bDeployments);
      } catch (error) {
        // E2B not available, skip
      }
    }

    // Sync with Flow Nexus
    if (!options.platform || options.platform === 'flow-nexus') {
      try {
        const flowNexusClient = new FlowNexusClient();
        await flowNexusClient.initialize();
        const flowNexusDeployments = await flowNexusClient.listDeployments();
        deployments = mergeDeployments(deployments, flowNexusDeployments);
      } catch (error) {
        // Flow Nexus not available, skip
      }
    }

    // Apply limit
    const limit = parseInt(options.limit);
    if (deployments.length > limit) {
      deployments = deployments.slice(0, limit);
    }

    spinner.succeed(`Found ${deployments.length} deployment(s)`);

    if (deployments.length === 0) {
      console.log();
      console.log(chalk.yellow('No deployments found'));
      console.log();
      console.log(chalk.gray('Create your first deployment:'));
      console.log(chalk.cyan('  neural-trader deploy e2b momentum'));
      console.log(chalk.cyan('  neural-trader deploy flow-nexus mean-reversion --swarm 5'));
      return;
    }

    // Output as JSON if requested
    if (options.json) {
      console.log(JSON.stringify(deployments, null, 2));
      return;
    }

    // Display as table
    console.log();
    console.log(chalk.bold('Deployments:'));
    console.log();

    const table = new Table({
      head: [
        chalk.bold('ID'),
        chalk.bold('Strategy'),
        chalk.bold('Platform'),
        chalk.bold('Status'),
        chalk.bold('Instances'),
        chalk.bold('Region'),
        chalk.bold('Created'),
        chalk.bold('Uptime')
      ],
      colWidths: [15, 18, 12, 12, 10, 12, 20, 12]
    });

    deployments.forEach(deployment => {
      const status = formatStatus(deployment.status);
      const instances = deployment.instances || deployment.agents?.length || 1;
      const uptime = calculateUptime(deployment.createdAt);

      table.push([
        chalk.cyan(deployment.id.substring(0, 12)),
        deployment.strategy || deployment.config?.strategy || 'Unknown',
        formatPlatform(deployment.platform),
        status,
        instances.toString(),
        deployment.region || deployment.config?.region || 'N/A',
        formatDate(deployment.createdAt),
        uptime
      ]);
    });

    console.log(table.toString());
    console.log();

    // Show summary statistics
    const summary = calculateSummary(deployments);
    console.log(chalk.bold('Summary:'));
    console.log(chalk.gray(`  Total: ${summary.total}`));
    console.log(chalk.green(`  Running: ${summary.running}`));
    console.log(chalk.yellow(`  Stopped: ${summary.stopped}`));
    console.log(chalk.red(`  Failed: ${summary.failed}`));
    console.log();

    // Show helpful commands
    console.log(chalk.bold('Commands:'));
    console.log(`  ${chalk.cyan('neural-trader deploy status <id>')}  - View deployment details`);
    console.log(`  ${chalk.cyan('neural-trader deploy logs <id>')}    - View deployment logs`);
    console.log(`  ${chalk.cyan('neural-trader deploy scale <id> N')} - Scale deployment`);
    console.log(`  ${chalk.cyan('neural-trader deploy stop <id>')}    - Stop deployment`);

  } catch (error) {
    spinner.fail('Failed to list deployments');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Format deployment status with colors
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
    'e2b': 'E2B',
    'flow-nexus': 'Flow Nexus',
    'flow_nexus': 'Flow Nexus'
  };

  return platformMap[platform?.toLowerCase()] || platform || 'Unknown';
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  } else {
    const minutes = Math.floor(diffMs / (1000 * 60));
    return `${minutes}m`;
  }
}

/**
 * Merge local and remote deployments
 */
function mergeDeployments(local, remote) {
  const merged = [...local];
  const localIds = new Set(local.map(d => d.id));

  remote.forEach(remoteDeployment => {
    if (!localIds.has(remoteDeployment.id)) {
      merged.push(remoteDeployment);
    }
  });

  // Sort by creation date (newest first)
  return merged.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
}

/**
 * Calculate summary statistics
 */
function calculateSummary(deployments) {
  const summary = {
    total: deployments.length,
    running: 0,
    stopped: 0,
    failed: 0
  };

  deployments.forEach(deployment => {
    const status = deployment.status?.toLowerCase();
    if (status === 'running') {
      summary.running++;
    } else if (status === 'stopped') {
      summary.stopped++;
    } else if (status === 'failed') {
      summary.failed++;
    }
  });

  return summary;
}

module.exports = {
  createListCommand,
  handleList
};
