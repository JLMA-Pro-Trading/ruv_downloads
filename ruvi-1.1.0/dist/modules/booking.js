import chalk from 'chalk';
import { printSection, printDivider } from '../utils/ui.js';
import enquirer from 'enquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
const { prompt } = enquirer;
export async function showBooking() {
    printSection('📅 Book a Coaching Session');
    console.log(chalk.white('Get personalized guidance on AI architecture, agentic systems,'));
    console.log(chalk.white('and enterprise AI strategy from rUv.'));
    console.log();
    printDivider();
    console.log(chalk.cyan('📦 Session Options:'));
    console.log();
    const sessions = [
        {
            name: '15-Minute Quick Guidance',
            duration: '15 min',
            price: '$149',
            description: 'Quick guidance session',
            calendly: 'https://calendly.com/ruvnet/15min',
            popular: false,
        },
        {
            name: '30-Minute Strategic Planning',
            duration: '30 min',
            price: '$299',
            description: 'Strategic planning and consultation',
            calendly: 'https://calendly.com/ruvnet/30min',
            popular: true,
        },
        {
            name: '60-Minute Comprehensive Coaching',
            duration: '60 min',
            price: '$499',
            description: 'Deep-dive session on complex topics',
            calendly: 'https://calendly.com/ruvnet/60min',
            popular: false,
        },
    ];
    sessions.forEach((session, index) => {
        const popular = session.popular ? chalk.yellow(' ⭐ MOST POPULAR') : '';
        console.log(chalk.bold.white(`${index + 1}. ${session.name}`) + popular);
        console.log(chalk.gray(`   Duration: ${session.duration}`));
        console.log(chalk.green(`   Price: ${session.price}`));
        console.log(chalk.white(`   ${session.description}`));
        console.log();
    });
    printDivider();
    console.log(chalk.cyan('🎓 Neural Trader Training:'));
    console.log();
    console.log(chalk.white('Specialized training programs for autonomous trading systems:'));
    console.log();
    console.log(chalk.white('  • Group Training Sessions'));
    console.log(chalk.white('  • Private 1-on-1 Coaching'));
    console.log(chalk.white('  • Enterprise Team Training'));
    console.log();
    try {
        const { action } = await prompt({
            type: 'select',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                { name: '15-min', message: '📅 Book 15-Minute Session ($149)' },
                { name: '30-min', message: '📅 Book 30-Minute Session ($299) ⭐' },
                { name: '60-min', message: '📅 Book 60-Minute Session ($499)' },
                { name: 'back', message: '← Back to main menu' },
            ],
        });
        if (action === 'back') {
            return;
        }
        const selectedSession = sessions.find(s => s.calendly.includes(action.replace('-', '')));
        if (selectedSession) {
            console.log();
            console.log(chalk.green(`Opening Calendly booking for ${selectedSession.name}...`));
            console.log();
            console.log(chalk.blue(`🔗 ${selectedSession.calendly}`));
            console.log();
            // Try to open in browser
            try {
                const platform = process.platform;
                let command = '';
                if (platform === 'darwin') {
                    command = `open "${selectedSession.calendly}"`;
                }
                else if (platform === 'win32') {
                    command = `start "${selectedSession.calendly}"`;
                }
                else {
                    command = `xdg-open "${selectedSession.calendly}"`;
                }
                await execAsync(command);
                console.log(chalk.gray('Browser opened. Please complete your booking in the browser.'));
            }
            catch (error) {
                console.log(chalk.yellow('Please copy and paste the URL above into your browser.'));
            }
        }
    }
    catch (error) {
        // User cancelled
        console.log();
    }
}
//# sourceMappingURL=booking.js.map