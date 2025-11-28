import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import enquirer from 'enquirer';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
const { prompt } = enquirer;
const DEFAULT_CONFIG = {
    enabled: true,
    eventThresholds: {
        file_edit: 10,
        model_train: 1,
        drift_detected: 1,
        test_failure: 3,
        deployment: 1,
        custom: {}
    },
    timeWindow: 60 * 60 * 1000, // 1 hour
    cooldownPeriod: 30 * 60 * 1000, // 30 minutes
    criticalEvents: ['drift_detected', 'deployment', 'critical_failure'],
    projects: {}
};
export const autoInvokeCommand = new Command('auto-invoke')
    .description('Configure auto-invocation settings')
    .option('--config', 'Interactively configure settings')
    .option('--enable', 'Enable auto-invocation')
    .option('--disable', 'Disable auto-invocation')
    .option('--status', 'Show current configuration')
    .option('--set-threshold <event=value>', 'Set event threshold (e.g., file_edit=15)')
    .option('--add-critical <event>', 'Add event to critical list')
    .option('--remove-critical <event>', 'Remove event from critical list')
    .option('--set-cooldown <minutes>', 'Set cooldown period in minutes')
    .option('--set-window <minutes>', 'Set time window in minutes')
    .option('--project <name>', 'Configure specific project')
    .option('--history', 'Show recent event history')
    .option('-o, --output <file>', 'Config file path', './data/iris/auto-invoke.json')
    .action(async (options) => {
    const spinner = ora('Configuring auto-invocation...').start();
    try {
        const configPath = resolve(options.output);
        let config;
        // Load or create config
        if (existsSync(configPath)) {
            spinner.text = 'Loading existing configuration...';
            const content = await readFile(configPath, 'utf-8');
            config = JSON.parse(content);
        }
        else {
            config = { ...DEFAULT_CONFIG };
        }
        spinner.stop();
        // Handle different operations
        if (options.status) {
            await showStatus(config, configPath);
            return;
        }
        if (options.history) {
            await showHistory(configPath);
            return;
        }
        if (options.enable) {
            config.enabled = true;
            console.log(chalk.green('✓ Auto-invocation enabled'));
        }
        if (options.disable) {
            config.enabled = false;
            console.log(chalk.yellow('✓ Auto-invocation disabled'));
        }
        if (options.setThreshold) {
            const [event, value] = options.setThreshold.split('=');
            const threshold = parseInt(value, 10);
            if (isNaN(threshold)) {
                console.error(chalk.red('Error: Invalid threshold value'));
                process.exit(1);
            }
            if (event in config.eventThresholds) {
                config.eventThresholds[event] = threshold;
            }
            else {
                config.eventThresholds.custom[event] = threshold;
            }
            console.log(chalk.green(`✓ Set ${event} threshold to ${threshold}`));
        }
        if (options.addCritical) {
            if (!config.criticalEvents.includes(options.addCritical)) {
                config.criticalEvents.push(options.addCritical);
                console.log(chalk.green(`✓ Added ${options.addCritical} to critical events`));
            }
        }
        if (options.removeCritical) {
            config.criticalEvents = config.criticalEvents.filter(e => e !== options.removeCritical);
            console.log(chalk.green(`✓ Removed ${options.removeCritical} from critical events`));
        }
        if (options.setCooldown) {
            const minutes = parseInt(options.setCooldown, 10);
            if (!isNaN(minutes)) {
                config.cooldownPeriod = minutes * 60 * 1000;
                console.log(chalk.green(`✓ Set cooldown period to ${minutes} minutes`));
            }
        }
        if (options.setWindow) {
            const minutes = parseInt(options.setWindow, 10);
            if (!isNaN(minutes)) {
                config.timeWindow = minutes * 60 * 1000;
                console.log(chalk.green(`✓ Set time window to ${minutes} minutes`));
            }
        }
        if (options.project) {
            config = await configureProject(config, options.project);
        }
        if (options.config) {
            config = await interactiveConfig(config);
        }
        // Save configuration
        spinner.start('Saving configuration...');
        await mkdir(resolve(configPath, '..'), { recursive: true });
        await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        spinner.succeed(chalk.green('Configuration saved!'));
        console.log(chalk.cyan('\n📝 Current Configuration:'));
        await showStatus(config, configPath);
    }
    catch (error) {
        spinner.fail(chalk.red('Configuration failed'));
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        if (options.parent?.opts().debug) {
            console.error(error);
        }
        process.exit(1);
    }
});
async function showStatus(config, configPath) {
    console.log(chalk.cyan('\n📊 Auto-Invocation Status:\n'));
    const statusIcon = config.enabled ? chalk.green('✓ Enabled') : chalk.red('✗ Disabled');
    console.log(`  Status: ${statusIcon}`);
    console.log(chalk.gray(`  Config: ${configPath}`));
    console.log(chalk.cyan('\n⏱️  Timing:'));
    console.log(chalk.gray(`  Time Window: ${config.timeWindow / 60000} minutes`));
    console.log(chalk.gray(`  Cooldown Period: ${config.cooldownPeriod / 60000} minutes`));
    console.log(chalk.cyan('\n📈 Event Thresholds:'));
    for (const [event, threshold] of Object.entries(config.eventThresholds)) {
        if (event !== 'custom') {
            console.log(chalk.gray(`  ${event}: ${threshold}`));
        }
    }
    if (Object.keys(config.eventThresholds.custom).length > 0) {
        console.log(chalk.cyan('\n🔧 Custom Thresholds:'));
        for (const [event, threshold] of Object.entries(config.eventThresholds.custom)) {
            console.log(chalk.gray(`  ${event}: ${threshold}`));
        }
    }
    console.log(chalk.cyan('\n⚡ Critical Events:'));
    config.criticalEvents.forEach(event => {
        console.log(chalk.gray(`  • ${event}`));
    });
    if (Object.keys(config.projects).length > 0) {
        console.log(chalk.cyan('\n📁 Project-Specific Settings:'));
        for (const [project, projectConfig] of Object.entries(config.projects)) {
            const icon = projectConfig.enabled ? '✓' : '✗';
            console.log(chalk.gray(`  ${icon} ${project}`));
        }
    }
    console.log(chalk.cyan('\n💡 Commands:'));
    console.log(chalk.gray('  ultrathink auto-invoke --enable'));
    console.log(chalk.gray('  ultrathink auto-invoke --disable'));
    console.log(chalk.gray('  ultrathink auto-invoke --config'));
    console.log(chalk.gray('  ultrathink auto-invoke --history'));
}
async function showHistory(configPath) {
    const historyPath = resolve(configPath, '../iris-event-history.jsonl');
    if (!existsSync(historyPath)) {
        console.log(chalk.yellow('No event history found'));
        return;
    }
    const content = await readFile(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const events = lines
        .slice(-50) // Last 50 events
        .map(line => {
        try {
            return JSON.parse(line);
        }
        catch {
            return null;
        }
    })
        .filter((e) => e !== null);
    console.log(chalk.cyan(`\n📜 Recent Event History (last ${events.length} events):\n`));
    const byProject = {};
    for (const event of events) {
        if (!byProject[event.project]) {
            byProject[event.project] = [];
        }
        byProject[event.project].push(event);
    }
    for (const [project, projectEvents] of Object.entries(byProject)) {
        console.log(chalk.bold(`${project} (${projectEvents.length} events)`));
        const eventCounts = {};
        for (const event of projectEvents) {
            eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
        }
        for (const [event, count] of Object.entries(eventCounts)) {
            console.log(chalk.gray(`  ${event}: ${count}`));
        }
        console.log('');
    }
}
async function interactiveConfig(config) {
    console.log(chalk.cyan('\n🔧 Interactive Configuration\n'));
    const answers = await prompt([
        {
            type: 'confirm',
            name: 'enabled',
            message: 'Enable auto-invocation?',
            initial: config.enabled
        },
        {
            type: 'numeral',
            name: 'cooldown',
            message: 'Cooldown period (minutes):',
            initial: config.cooldownPeriod / 60000
        },
        {
            type: 'numeral',
            name: 'window',
            message: 'Time window (minutes):',
            initial: config.timeWindow / 60000
        },
        {
            type: 'numeral',
            name: 'fileEditThreshold',
            message: 'File edit threshold:',
            initial: config.eventThresholds.file_edit
        },
        {
            type: 'numeral',
            name: 'testFailureThreshold',
            message: 'Test failure threshold:',
            initial: config.eventThresholds.test_failure
        }
    ]);
    return {
        ...config,
        enabled: answers.enabled,
        cooldownPeriod: answers.cooldown * 60000,
        timeWindow: answers.window * 60000,
        eventThresholds: {
            ...config.eventThresholds,
            file_edit: answers.fileEditThreshold,
            test_failure: answers.testFailureThreshold
        }
    };
}
async function configureProject(config, projectName) {
    console.log(chalk.cyan(`\n📁 Configuring project: ${projectName}\n`));
    const existingProject = config.projects[projectName] || {
        enabled: true,
        customThresholds: {},
        excludeEvents: []
    };
    const answers = await prompt([
        {
            type: 'confirm',
            name: 'enabled',
            message: `Enable auto-invocation for ${projectName}?`,
            initial: existingProject.enabled
        },
        {
            type: 'confirm',
            name: 'customThresholds',
            message: 'Use custom thresholds for this project?',
            initial: !!existingProject.customThresholds
        }
    ]);
    const projectConfig = {
        enabled: answers.enabled,
        customThresholds: existingProject.customThresholds,
        excludeEvents: existingProject.excludeEvents
    };
    if (answers.customThresholds) {
        const thresholdAnswers = await prompt([
            {
                type: 'numeral',
                name: 'fileEdit',
                message: 'File edit threshold:',
                initial: projectConfig.customThresholds?.file_edit || config.eventThresholds.file_edit
            },
            {
                type: 'numeral',
                name: 'testFailure',
                message: 'Test failure threshold:',
                initial: projectConfig.customThresholds?.test_failure || config.eventThresholds.test_failure
            }
        ]);
        projectConfig.customThresholds = {
            file_edit: thresholdAnswers.fileEdit,
            test_failure: thresholdAnswers.testFailure
        };
    }
    return {
        ...config,
        projects: {
            ...config.projects,
            [projectName]: projectConfig
        }
    };
}
//# sourceMappingURL=auto-invoke.js.map