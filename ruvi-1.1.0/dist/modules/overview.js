import chalk from 'chalk';
import { printSection, printDivider } from '../utils/ui.js';
import { getCurrentUser } from './auth.js';
export async function showOverview() {
    printSection('🏠 Overview');
    // Check if user is logged in
    const user = await getCurrentUser();
    if (user) {
        console.log(chalk.green(`✓ Logged in as: ${chalk.bold(user.email)}`));
        if (user.fullName) {
            console.log(chalk.gray(`  Name: ${user.fullName}`));
        }
        console.log();
    }
    else {
        console.log(chalk.yellow('⚠ Not logged in'));
        console.log(chalk.gray(`  Use ${chalk.bold('ruvi login')} to authenticate`));
        console.log();
    }
    printDivider();
    console.log(chalk.bold.white('About rUv'));
    console.log();
    console.log(chalk.gray('Pioneering AI Innovation for Three Decades'));
    console.log();
    console.log(chalk.white('rUv is an independent AI consultant working with some of the largest'));
    console.log(chalk.white('companies in the world on their enterprise AI architecture and'));
    console.log(chalk.white('management strategies.'));
    console.log();
    console.log(chalk.cyan('🎯 Expertise:'));
    printDivider();
    const expertise = [
        'Enterprise AI Architecture & Strategy',
        'Autonomous AI Agent Development',
        'Multi-Agent System Orchestration',
        'Cloud Computing & Infrastructure as a Service',
        'Quantum-Resistant AI Architectures',
        'Neural Network Trading Systems',
        'Distributed ML Frameworks',
        'Large-Scale Enterprise System Design',
    ];
    expertise.forEach(item => {
        console.log(chalk.white(`  • ${item}`));
    });
    console.log();
    console.log(chalk.cyan('🏆 Career Highlights:'));
    printDivider();
    const highlights = [
        'Over 30 years of technology expertise',
        'Pivotal role in EY.ai deployment ($1.4B budget, 400k+ users)',
        'Founded Enomaly Inc., pioneering cloud computing company',
        'Coined "Infrastructure as a Service" (IaaS) in 2005',
        'Inaugural member of Amazon Web Services advisory board',
        'Alpha/beta tester for OpenAI, Napster, AOL, Sierra Online',
        'Co-authored first US Cloud Definition with NIST (2009)',
        'Co-founded CloudCamp - introduced 100,000+ to cloud computing',
    ];
    highlights.forEach(item => {
        console.log(chalk.white(`  • ${item}`));
    });
    console.log();
    console.log(chalk.cyan('💡 Philosophy:'));
    printDivider();
    console.log(chalk.white('Building the future through intelligent automation and human-AI'));
    console.log(chalk.white('collaboration. Pushing boundaries while remaining approachable and'));
    console.log(chalk.white('relatable, sharing wisdom to benefit industry giants, governments,'));
    console.log(chalk.white('and aspiring entrepreneurs alike.'));
    console.log();
    console.log(chalk.gray('━'.repeat(50)));
    console.log();
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.gray(`  • ${chalk.white('ruvi console')}   - Chat with AI assistant`));
    console.log(chalk.gray(`  • ${chalk.white('ruvi resume')}    - View projects and portfolio`));
    console.log(chalk.gray(`  • ${chalk.white('ruvi booking')}   - Book a coaching session`));
    console.log(chalk.gray(`  • ${chalk.white('ruvi tribe')}     - Join the Agentic Tribe`));
    console.log();
}
//# sourceMappingURL=overview.js.map