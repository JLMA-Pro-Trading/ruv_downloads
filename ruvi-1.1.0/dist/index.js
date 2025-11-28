#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ruvAsciiArt, welcomeMessage } from './utils/ascii-art.js';
import { login, logout, register, checkAuth, getCurrentUser } from './modules/auth.js';
import { startConsole } from './modules/console.js';
import { showResume } from './modules/resume.js';
import { showOverview } from './modules/overview.js';
import { showTribe } from './modules/tribe.js';
import { showBooking } from './modules/booking.js';
import { startMCPServer } from './mcp/server.js';
import { listPackages, searchPackages } from './modules/packages.js';
import enquirer from 'enquirer';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const { prompt } = enquirer;
const program = new Command();
async function showMainMenu() {
    console.clear();
    console.log(ruvAsciiArt);
    const user = await getCurrentUser();
    console.log(welcomeMessage(user?.fullName || user?.email));
    try {
        const { action } = await prompt({
            type: 'select',
            name: 'action',
            message: 'What would you like to do?',
            choices: user ? [
                { name: 'overview', message: '🏠 Overview - About rUv' },
                { name: 'console', message: '💬 Console - Chat with AI' },
                { name: 'packages', message: '📦 Packages - Browse & Install' },
                { name: 'resume', message: '📋 Resume - Projects & Portfolio' },
                { name: 'booking', message: '📅 Booking - Schedule a Session' },
                { name: 'tribe', message: '🌟 Tribe - Join the Community' },
                { name: 'mcp', message: '🔌 MCP Server - Start MCP Server' },
                { name: 'login', message: '🔐 Logout' },
                { name: 'exit', message: '👋 Exit' },
            ] : [
                { name: 'overview', message: '🏠 Overview - About rUv' },
                { name: 'console', message: '💬 Console - Chat with AI' },
                { name: 'packages', message: '📦 Packages - Browse & Install' },
                { name: 'resume', message: '📋 Resume - Projects & Portfolio' },
                { name: 'booking', message: '📅 Booking - Schedule a Session' },
                { name: 'tribe', message: '🌟 Tribe - Join the Community' },
                { name: 'mcp', message: '🔌 MCP Server - Start MCP Server' },
                { name: 'register', message: '✨ Register - Create Account' },
                { name: 'login', message: '🔐 Login' },
                { name: 'exit', message: '👋 Exit' },
            ],
        });
        console.log();
        switch (action) {
            case 'overview':
                await showOverview();
                break;
            case 'console':
                await startConsole();
                break;
            case 'packages':
                await listPackages();
                break;
            case 'resume':
                await showResume();
                break;
            case 'booking':
                await showBooking();
                break;
            case 'tribe':
                await showTribe();
                break;
            case 'mcp':
                console.log(chalk.cyan('\n🔌 Starting MCP Server...\n'));
                console.log(chalk.gray('The MCP server will run in stdio mode.'));
                console.log(chalk.gray('This is typically used by AI assistants like Claude Desktop.\n'));
                console.log(chalk.yellow('⚠️  This will exit the interactive menu and start the server.'));
                console.log(chalk.gray('Press Ctrl+C to stop the server.\n'));
                const { confirmMcp } = await prompt({
                    type: 'confirm',
                    name: 'confirmMcp',
                    message: 'Start MCP server?',
                    initial: true,
                });
                if (confirmMcp) {
                    await startMCPServer();
                    process.exit(0);
                }
                break;
            case 'register':
                await register();
                break;
            case 'login':
                if (user) {
                    await logout();
                }
                else {
                    await login();
                }
                break;
            case 'exit':
                console.log(chalk.cyan('Thanks for using ruvi! 👋'));
                process.exit(0);
        }
        // Return to menu after action
        console.log();
        console.log(chalk.gray('Press Enter to return to main menu...'));
        await prompt({
            type: 'input',
            name: 'continue',
            message: '',
        });
        await showMainMenu();
    }
    catch (error) {
        // User cancelled (Ctrl+C)
        console.log(chalk.cyan('\nThanks for using ruvi! 👋'));
        process.exit(0);
    }
}
program
    .name('ruvi')
    .description('rUv CLI - Agentic Engineering Console with MCP integration')
    .version(packageJson.version);
program
    .command('register')
    .description('Create a new rUv account')
    .action(async () => {
    console.log(ruvAsciiArt);
    await register();
});
program
    .command('login')
    .description('Login to your rUv account')
    .action(async () => {
    console.log(ruvAsciiArt);
    await login();
});
program
    .command('logout')
    .description('Logout from your account')
    .action(async () => {
    await logout();
});
program
    .command('console')
    .description('Start the interactive AI console')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await startConsole();
});
program
    .command('resume')
    .alias('projects')
    .description('View projects and portfolio')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await showResume();
});
program
    .command('overview')
    .alias('about')
    .description('View overview and about rUv')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await showOverview();
});
program
    .command('tribe')
    .description('View Agentic Tribe information')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await showTribe();
});
program
    .command('booking')
    .alias('book')
    .description('Book a coaching session')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await showBooking();
});
program
    .command('mcp')
    .description('Start MCP server with stdio transport')
    .action(async () => {
    await startMCPServer();
});
program
    .command('packages')
    .alias('pkgs')
    .alias('list')
    .description('Browse and install rUv npm packages')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await listPackages();
});
program
    .command('search')
    .alias('find')
    .description('Search rUv npm packages')
    .action(async () => {
    console.clear();
    console.log(ruvAsciiArt);
    await searchPackages();
});
program
    .command('status')
    .description('Check authentication status')
    .action(async () => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        const user = await getCurrentUser();
        console.log(chalk.green('✓ Authenticated'));
        console.log(chalk.gray(`  Email: ${user?.email}`));
        if (user?.fullName) {
            console.log(chalk.gray(`  Name: ${user.fullName}`));
        }
    }
    else {
        console.log(chalk.yellow('⚠ Not authenticated'));
        console.log(chalk.gray(`  Use ${chalk.bold('ruvi login')} to authenticate`));
    }
});
// Default action - show interactive menu
program.action(async () => {
    await showMainMenu();
});
// Handle errors gracefully
process.on('uncaughtException', (error) => {
    if (error.message !== '') {
        console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
});
process.on('unhandledRejection', (error) => {
    if (error?.message && error.message !== '') {
        console.error(chalk.red('Error:'), error.message);
    }
    process.exit(1);
});
program.parse();
//# sourceMappingURL=index.js.map