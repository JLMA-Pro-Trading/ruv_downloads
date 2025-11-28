import chalk from 'chalk';
import { printSection, printDivider } from '../utils/ui.js';
export async function showResume() {
    printSection('📋 Projects & Portfolio');
    console.log(chalk.bold.white('rUv (Reuven Cohen)'));
    console.log(chalk.gray('Independent AI Consultant & Enterprise AI Architecture Expert'));
    console.log();
    console.log(chalk.cyan('🏢 Featured Work:'));
    printDivider();
    console.log(chalk.bold('EY.ai - Enterprise AI Stack'));
    console.log(chalk.gray('  • Scale: 400,000+ employees, 1.5 million end users'));
    console.log(chalk.gray('  • Budget: $1.4 billion'));
    console.log(chalk.gray('  • Role: Lead architect for 2023 deployment'));
    console.log();
    console.log(chalk.cyan('🚀 Featured Projects:'));
    printDivider();
    const projects = [
        {
            name: 'AgentDB',
            description: 'Vector database optimized for AI agent workflows',
            link: 'https://github.com/ruvnet/agentdb',
        },
        {
            name: 'Claude-Flow v2',
            description: 'Enterprise AI orchestration with swarm intelligence',
            tech: 'Multi-agent coordination, distributed processing',
        },
        {
            name: 'Neural Trader',
            description: 'Autonomous trading system with neural networks',
            tech: 'Deep learning, real-time market analysis',
        },
        {
            name: 'FACT',
            description: 'Revolutionary LLM data retrieval (sub-100ms, 60-90% cost reduction)',
            tech: 'Optimized retrieval, cost-efficient architecture',
        },
        {
            name: 'QuDAG',
            description: 'Quantum-resistant platform for autonomous AI agents',
            tech: 'Post-quantum cryptography, agent security',
        },
        {
            name: 'Goalie',
            description: 'Goal-oriented AI research with anti-hallucination features',
            tech: 'A* pathfinding, validation layer',
        },
        {
            name: 'strange-loops',
            description: 'Real-time distributed systems (500K+ ticks/second)',
            tech: 'High-performance computing, distributed architecture',
        },
        {
            name: 'agentic-payments',
            description: 'AI agent payment infrastructure for autonomous transactions',
            tech: 'Blockchain integration, autonomous commerce',
        },
    ];
    projects.forEach((project, index) => {
        console.log(chalk.yellow(`${index + 1}. ${project.name}`));
        console.log(chalk.white(`   ${project.description}`));
        if (project.tech) {
            console.log(chalk.gray(`   Tech: ${project.tech}`));
        }
        if (project.link) {
            console.log(chalk.blue(`   Link: ${project.link}`));
        }
        console.log();
    });
    console.log(chalk.cyan('🔗 GitHub Profile:'));
    console.log(chalk.blue('   https://github.com/ruvnet'));
    console.log();
    console.log(chalk.cyan('🌐 Organizations:'));
    console.log(chalk.white('   • Agentics Foundation: ') + chalk.blue('https://agentics.org'));
    console.log();
}
//# sourceMappingURL=resume.js.map