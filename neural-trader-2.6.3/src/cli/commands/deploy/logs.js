#!/usr/bin/env node

/**
 * Deployment logs command
 * View and stream logs from deployments
 */

const { Command } = require('commander');
const chalk = require('../../lib/chalk-compat');
const ora = require('ora');
const DeploymentTracker = require('../../lib/deployment-tracker');
const LogStreamer = require('../../lib/log-streamer');

/**
 * Create logs command
 */
function createLogsCommand() {
  const logs = new Command('logs')
    .description('View deployment logs')
    .argument('<deployment-id>', 'Deployment ID')
    .option('-f, --follow', 'Follow log output (stream)')
    .option('-n, --lines <count>', 'Number of lines to show', '100')
    .option('--since <time>', 'Show logs since timestamp (e.g., 2023-01-01T00:00:00Z)')
    .option('--until <time>', 'Show logs until timestamp')
    .option('--filter <pattern>', 'Filter logs by pattern (regex)')
    .option('--level <level>', 'Filter by log level (error, warn, info, debug)')
    .option('--instance <id>', 'Show logs from specific instance')
    .option('--json', 'Output as JSON')
    .option('--no-color', 'Disable colored output')
    .action(handleLogs);

  return logs;
}

/**
 * Handle logs command
 */
async function handleLogs(deploymentId, options) {
  const spinner = ora('Loading logs...').start();

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

    // Initialize log streamer
    const logStreamer = new LogStreamer(deployment.platform);
    await logStreamer.initialize();

    // Build log options
    const logOptions = {
      lines: parseInt(options.lines),
      since: options.since ? new Date(options.since) : null,
      until: options.until ? new Date(options.until) : null,
      filter: options.filter,
      level: options.level,
      instance: options.instance,
      follow: options.follow || false,
      json: options.json || false,
      color: options.color !== false
    };

    spinner.succeed('Connected to log stream');
    console.log();

    // Show log header
    if (!options.json) {
      console.log(chalk.bold('Deployment Logs:'));
      console.log(chalk.gray(`Deployment: ${deploymentId}`));
      console.log(chalk.gray(`Platform: ${formatPlatform(deployment.platform)}`));
      if (options.instance) {
        console.log(chalk.gray(`Instance: ${options.instance}`));
      }
      if (options.follow) {
        console.log(chalk.gray('Following log output... (Press Ctrl+C to stop)'));
      }
      console.log();
    }

    // Stream logs
    if (options.follow) {
      await streamLogs(logStreamer, deploymentId, logOptions);
    } else {
      await fetchLogs(logStreamer, deploymentId, logOptions);
    }

  } catch (error) {
    spinner.fail('Failed to fetch logs');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Fetch and display logs
 */
async function fetchLogs(logStreamer, deploymentId, options) {
  const logs = await logStreamer.fetchLogs(deploymentId, options);

  if (logs.length === 0) {
    console.log(chalk.yellow('No logs found'));
    return;
  }

  // Display logs
  logs.forEach(log => {
    displayLog(log, options);
  });

  // Show summary
  if (!options.json) {
    console.log();
    console.log(chalk.gray(`Showing ${logs.length} log entries`));
  }
}

/**
 * Stream logs in real-time
 */
async function streamLogs(logStreamer, deploymentId, options) {
  let logCount = 0;

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log();
    console.log(chalk.gray(`Stopped streaming (${logCount} logs received)`));
    process.exit(0);
  });

  // Start streaming
  await logStreamer.streamLogs(deploymentId, options, (log) => {
    displayLog(log, options);
    logCount++;
  });
}

/**
 * Display a single log entry
 */
function displayLog(log, options) {
  if (options.json) {
    console.log(JSON.stringify(log));
    return;
  }

  const timestamp = formatTimestamp(log.timestamp);
  const level = formatLevel(log.level, options.color);
  const instance = log.instance ? chalk.gray(`[${log.instance.substring(0, 8)}]`) : '';
  const message = options.color ? formatMessage(log.message, log.level) : log.message;

  console.log(`${timestamp} ${level} ${instance} ${message}`);

  // Show stack trace for errors
  if (log.level === 'error' && log.stack && !options.json) {
    const stackLines = log.stack.split('\n').slice(1, 4); // Show first 3 lines
    stackLines.forEach(line => {
      console.log(chalk.gray(`  ${line.trim()}`));
    });
  }
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return chalk.gray(date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }));
}

/**
 * Format log level with colors
 */
function formatLevel(level, useColor) {
  if (!useColor) {
    return `[${level.toUpperCase()}]`;
  }

  const levelMap = {
    error: chalk.red.bold('[ERROR]'),
    warn: chalk.yellow.bold('[WARN ]'),
    info: chalk.blue.bold('[INFO ]'),
    debug: chalk.gray.bold('[DEBUG]'),
    trace: chalk.gray('[TRACE]')
  };

  return levelMap[level?.toLowerCase()] || chalk.white(`[${level?.toUpperCase() || 'LOG'}]`);
}

/**
 * Format message with colors based on level
 */
function formatMessage(message, level) {
  switch (level?.toLowerCase()) {
    case 'error':
      return chalk.red(message);
    case 'warn':
      return chalk.yellow(message);
    case 'debug':
    case 'trace':
      return chalk.gray(message);
    default:
      return message;
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
  createLogsCommand,
  handleLogs
};
