/**
 * Execution configuration commands
 *
 * Manage smart defaults for agentic-flow + AgentDB
 */
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getExecutionEngine } from '../execution-engine.js';
/**
 * Show current execution configuration
 */
export async function runConfigShow() {
    const engine = getExecutionEngine();
    await engine.showConfig();
}
/**
 * Interactive configuration wizard
 */
export async function runConfigWizard() {
    console.log(chalk.blue('\n🔧 Execution Configuration Wizard\n'));
    const engine = getExecutionEngine();
    const currentConfig = await engine.loadConfig();
    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'use_agentic_flow',
            message: 'Use agentic-flow for all operations?',
            default: currentConfig.use_agentic_flow
        },
        {
            type: 'list',
            name: 'swarm_topology',
            message: 'Swarm topology:',
            choices: ['mesh', 'hierarchical', 'ring', 'star'],
            default: currentConfig.swarm_topology,
            when: (answers) => answers.use_agentic_flow
        },
        {
            type: 'number',
            name: 'max_agents',
            message: 'Maximum agents:',
            default: currentConfig.max_agents,
            when: (answers) => answers.use_agentic_flow
        },
        {
            type: 'confirm',
            name: 'use_agentdb',
            message: 'Track all operations in AgentDB?',
            default: currentConfig.use_agentdb
        },
        {
            type: 'confirm',
            name: 'enable_learning',
            message: 'Enable continuous learning?',
            default: currentConfig.enable_learning
        },
        {
            type: 'confirm',
            name: 'enable_caching',
            message: 'Enable result caching?',
            default: currentConfig.enable_caching
        }
    ]);
    // Update configuration
    await engine.updateConfig(answers);
    console.log(chalk.green('\n✅ Configuration saved!\n'));
    // Show updated config
    await engine.showConfig();
}
/**
 * Quick toggle commands
 */
export async function runConfigToggle(setting, enable) {
    const engine = getExecutionEngine();
    const currentConfig = await engine.loadConfig();
    // If enable not specified, toggle current value
    if (enable === undefined) {
        switch (setting) {
            case 'agentic-flow':
                enable = !currentConfig.use_agentic_flow;
                break;
            case 'agentdb':
                enable = !currentConfig.use_agentdb;
                break;
            case 'learning':
                enable = !currentConfig.enable_learning;
                break;
            case 'caching':
                enable = !currentConfig.enable_caching;
                break;
        }
    }
    // Update specific setting
    switch (setting) {
        case 'agentic-flow':
            await engine.toggleAgenticFlow(enable);
            break;
        case 'agentdb':
            await engine.toggleAgentDB(enable);
            break;
        case 'learning':
            await engine.updateConfig({ enable_learning: enable });
            console.log(chalk.blue(`Learning ${enable ? chalk.green('enabled') : chalk.red('disabled')}`));
            break;
        case 'caching':
            await engine.updateConfig({ enable_caching: enable });
            console.log(chalk.blue(`Caching ${enable ? chalk.green('enabled') : chalk.red('disabled')}`));
            break;
    }
}
/**
 * Reset to defaults
 */
export async function runConfigReset() {
    const { confirm } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Reset all execution settings to defaults?',
            default: false
        }
    ]);
    if (!confirm) {
        console.log(chalk.yellow('\n⚠️  Reset cancelled\n'));
        return;
    }
    const engine = getExecutionEngine();
    await engine.updateConfig({
        use_agentic_flow: true,
        use_agentdb: true,
        swarm_topology: 'mesh',
        max_agents: 5,
        enable_learning: true,
        enable_caching: true,
        track_all_operations: true
    });
    console.log(chalk.green('\n✅ Configuration reset to defaults\n'));
    await engine.showConfig();
}
/**
 * Set swarm topology
 */
export async function runConfigTopology(topology) {
    const engine = getExecutionEngine();
    await engine.updateConfig({ swarm_topology: topology });
    console.log(chalk.green(`✓ Swarm topology set to: ${topology}`));
}
