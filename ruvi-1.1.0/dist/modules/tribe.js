import chalk from 'chalk';
import { printSection, printDivider } from '../utils/ui.js';
import { getCurrentUser } from './auth.js';
export async function showTribe() {
    printSection('🌟 Agentic Tribe - Elite AI Community');
    console.log(chalk.white('Join a community of AI practitioners, engineers, and leaders'));
    console.log(chalk.white('building the future of autonomous systems.'));
    console.log();
    printDivider();
    console.log(chalk.cyan('📅 Format:'));
    console.log(chalk.white('  • Bi-weekly 2-hour live sessions'));
    console.log(chalk.white('  • Small cohorts of ~5 people'));
    console.log(chalk.white('  • Hands-on projects and collaboration'));
    console.log(chalk.white('  • Direct access to rUv'));
    console.log();
    console.log(chalk.cyan('💰 Investment:'));
    console.log(chalk.white('  $250/month subscription'));
    console.log();
    console.log(chalk.cyan('✨ Benefits:'));
    printDivider();
    const benefits = [
        'Learn cutting-edge agentic engineering patterns',
        'Build production-ready multi-agent systems',
        'Network with elite AI practitioners',
        'Get personalized feedback on your projects',
        'Access to exclusive resources and tools',
        'Priority support and consultation',
    ];
    benefits.forEach(benefit => {
        console.log(chalk.white(`  • ${benefit}`));
    });
    console.log();
    console.log(chalk.cyan('🎯 Topics Covered:'));
    printDivider();
    const topics = [
        'Multi-agent orchestration patterns',
        'Neural network optimization',
        'Autonomous trading algorithms',
        'Quantum-resistant architectures',
        'Distributed ML frameworks',
        'Enterprise AI deployment strategies',
        'Model Context Protocol (MCP) integration',
        'Agent security and privacy',
    ];
    topics.forEach(topic => {
        console.log(chalk.white(`  • ${topic}`));
    });
    console.log();
    // Check if logged in
    const user = await getCurrentUser();
    if (user) {
        console.log(chalk.green('✓ You are logged in and ready to join!'));
        console.log();
        console.log(chalk.yellow('Next steps:'));
        console.log(chalk.gray(`  Visit the members portal to register for the tribe`));
        console.log(chalk.blue(`  https://ruv.io/members`));
    }
    else {
        console.log(chalk.yellow('⚠ Login required to join the tribe'));
        console.log();
        console.log(chalk.gray(`  Use ${chalk.bold('ruvi login')} to authenticate`));
        console.log(chalk.gray(`  Then visit: ${chalk.blue('https://ruv.io/members')}`));
    }
    console.log();
}
//# sourceMappingURL=tribe.js.map