import inquirer from 'inquirer';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
export class InteractiveCLI {
    options;
    progressBar = null;
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Present discovered experts with summary statistics
     */
    async presentDiscoveries(discoveries) {
        console.log('\n' + chalk.bold.cyan('🔍 Expert Discovery Summary'));
        console.log(chalk.gray('─'.repeat(60)) + '\n');
        // Calculate statistics
        const totalExperts = discoveries.length;
        const withTelemetry = discoveries.filter(d => d.hasTelemetry).length;
        const withoutTelemetry = totalExperts - withTelemetry;
        const fileCount = new Set(discoveries.map(d => d.filePath)).size;
        // Summary statistics
        console.log(chalk.bold('Statistics:'));
        console.log(`  ${chalk.green('●')} Total Experts Found: ${chalk.bold(totalExperts)}`);
        console.log(`  ${chalk.yellow('●')} Files Scanned: ${chalk.bold(fileCount)}`);
        console.log(`  ${chalk.green('●')} With Telemetry: ${chalk.bold(withTelemetry)}`);
        console.log(`  ${chalk.red('●')} Without Telemetry: ${chalk.bold(withoutTelemetry)}`);
        console.log();
        // Group by file
        const byFile = discoveries.reduce((acc, expert) => {
            if (!acc[expert.filePath]) {
                acc[expert.filePath] = [];
            }
            acc[expert.filePath].push(expert);
            return acc;
        }, {});
        // Display experts grouped by file
        console.log(chalk.bold('Discovered Experts:\n'));
        for (const [filePath, experts] of Object.entries(byFile)) {
            const relativePath = filePath.replace(process.cwd(), '.');
            console.log(chalk.cyan(`  📁 ${relativePath}`));
            for (const expert of experts) {
                const statusIcon = expert.hasTelemetry ? chalk.green('✓') : chalk.red('✗');
                const telemetryStatus = expert.hasTelemetry
                    ? chalk.green('instrumented')
                    : chalk.yellow('needs instrumentation');
                console.log(`    ${statusIcon} ${chalk.bold(expert.className)}`);
                console.log(`       ${chalk.gray('Line:')} ${expert.lineNumber}`);
                console.log(`       ${chalk.gray('Methods:')} ${expert.methods.length}`);
                console.log(`       ${chalk.gray('Status:')} ${telemetryStatus}`);
                if (this.options.verbose && expert.extendsClass) {
                    console.log(`       ${chalk.gray('Extends:')} ${expert.extendsClass}`);
                }
                console.log();
            }
        }
        console.log(chalk.gray('─'.repeat(60)) + '\n');
    }
    /**
     * Ask user for instrumentation approval
     */
    async askInstrumentationApproval(experts) {
        if (this.options.autoApprove) {
            return {
                approved: true,
                selectedExperts: experts.filter(e => !e.hasTelemetry).map(e => e.className),
                showChangesFirst: false
            };
        }
        const expertsNeedingInstrumentation = experts.filter(e => !e.hasTelemetry);
        if (expertsNeedingInstrumentation.length === 0) {
            console.log(chalk.green('✓ All experts are already instrumented!\n'));
            return {
                approved: false,
                selectedExperts: [],
                showChangesFirst: false
            };
        }
        // Main action prompt
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: `Found ${chalk.bold(expertsNeedingInstrumentation.length)} expert(s) without telemetry. What would you like to do?`,
                choices: [
                    {
                        name: `${chalk.green('●')} Instrument all experts`,
                        value: 'all'
                    },
                    {
                        name: `${chalk.yellow('●')} Select specific experts to instrument`,
                        value: 'select'
                    },
                    {
                        name: `${chalk.cyan('●')} Preview code changes first`,
                        value: 'preview'
                    },
                    {
                        name: `${chalk.gray('●')} Skip for now`,
                        value: 'skip'
                    }
                ]
            }
        ]);
        if (action === 'skip') {
            return {
                approved: false,
                selectedExperts: [],
                showChangesFirst: false
            };
        }
        if (action === 'preview') {
            return {
                approved: true,
                selectedExperts: expertsNeedingInstrumentation.map(e => e.className),
                showChangesFirst: true
            };
        }
        if (action === 'all') {
            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Instrument ${chalk.bold(expertsNeedingInstrumentation.length)} expert(s)?`,
                    default: true
                }
            ]);
            return {
                approved: confirm,
                selectedExperts: confirm ? expertsNeedingInstrumentation.map(e => e.className) : [],
                showChangesFirst: false
            };
        }
        // Select specific experts
        const choices = expertsNeedingInstrumentation.map(expert => ({
            name: `${expert.className} (${expert.methods.length} methods) - ${expert.filePath.replace(process.cwd(), '.')}`,
            value: expert.className,
            checked: true
        }));
        const { selectedExperts } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedExperts',
                message: 'Select experts to instrument:',
                choices,
                validate: (answer) => {
                    if (answer.length === 0) {
                        return 'You must select at least one expert.';
                    }
                    return true;
                }
            }
        ]);
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Instrument ${chalk.bold(selectedExperts.length)} selected expert(s)?`,
                default: true
            }
        ]);
        return {
            approved: confirm,
            selectedExperts: confirm ? selectedExperts : [],
            showChangesFirst: false
        };
    }
    /**
     * Show code changes with diff view
     */
    async showCodeChanges(changes) {
        if (this.options.autoApprove) {
            return true;
        }
        console.log('\n' + chalk.bold.cyan('📝 Code Changes Preview'));
        console.log(chalk.gray('─'.repeat(60)) + '\n');
        for (const change of changes) {
            const relativePath = change.filePath.replace(process.cwd(), '.');
            console.log(chalk.bold(`Expert: ${change.expertName} (${change.expertId})`));
            console.log(chalk.gray(`File: ${relativePath}`));
            console.log(chalk.green(`+${change.linesAdded} lines added`) + ', ' +
                chalk.yellow(`~${change.linesModified} lines modified`));
            console.log();
            // Show diff-style changes
            const beforeLines = change.before.split('\n');
            const afterLines = change.after.split('\n');
            console.log(chalk.gray('  Changes:'));
            // Simple diff display (first 20 lines)
            const maxLines = Math.min(20, afterLines.length);
            for (let i = 0; i < maxLines; i++) {
                const beforeLine = beforeLines[i] || '';
                const afterLine = afterLines[i] || '';
                if (beforeLine !== afterLine) {
                    if (beforeLine && !afterLine) {
                        console.log(chalk.red(`  - ${beforeLine}`));
                    }
                    else if (!beforeLine && afterLine) {
                        console.log(chalk.green(`  + ${afterLine}`));
                    }
                    else {
                        console.log(chalk.yellow(`  ~ ${afterLine}`));
                    }
                }
            }
            if (afterLines.length > maxLines) {
                console.log(chalk.gray(`  ... (${afterLines.length - maxLines} more lines)`));
            }
            console.log('\n' + chalk.gray('─'.repeat(60)) + '\n');
        }
        // Summary
        const totalAdded = changes.reduce((sum, c) => sum + c.linesAdded, 0);
        const totalModified = changes.reduce((sum, c) => sum + c.linesModified, 0);
        console.log(chalk.bold('Summary:'));
        console.log(`  ${chalk.green('+')} ${totalAdded} lines added`);
        console.log(`  ${chalk.yellow('~')} ${totalModified} lines modified`);
        console.log(`  ${chalk.cyan('●')} ${changes.length} expert(s) affected`);
        console.log();
        const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: 'Apply these changes?',
                default: true
            }
        ]);
        return proceed;
    }
    /**
     * Confirm instrumentation before applying
     */
    async confirmInstrumentation() {
        if (this.options.autoApprove) {
            return true;
        }
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: this.options.dryRun
                    ? 'Show what would be changed? (dry-run mode)'
                    : 'Apply instrumentation changes?',
                default: true
            }
        ]);
        return confirm;
    }
    /**
     * Show progress indicator
     */
    async showProgress(message, current, total) {
        if (!this.progressBar) {
            this.progressBar = new cliProgress.SingleBar({
                format: `${message} ${chalk.cyan('{bar}')} {percentage}% | {value}/{total} files`,
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true
            });
            this.progressBar.start(total, 0);
        }
        this.progressBar.update(current);
        if (current >= total) {
            this.progressBar.stop();
            this.progressBar = null;
        }
    }
    /**
     * Show a simple spinner for indeterminate progress
     */
    showSpinner(message) {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        const interval = setInterval(() => {
            process.stdout.write(`\r${chalk.cyan(frames[i])} ${message}`);
            i = (i + 1) % frames.length;
        }, 80);
        return () => {
            clearInterval(interval);
            process.stdout.write('\r' + ' '.repeat(message.length + 3) + '\r');
        };
    }
    /**
     * Display success message
     */
    success(message) {
        console.log(chalk.green('✓') + ' ' + message);
    }
    /**
     * Display error message
     */
    error(message, error) {
        console.log(chalk.red('✗') + ' ' + message);
        if (error && this.options.verbose) {
            console.log(chalk.gray(error.stack || error.message));
        }
    }
    /**
     * Display warning message
     */
    warning(message) {
        console.log(chalk.yellow('⚠') + ' ' + message);
    }
    /**
     * Display info message
     */
    info(message) {
        console.log(chalk.cyan('ℹ') + ' ' + message);
    }
    /**
     * Display final summary
     */
    displaySummary(summary) {
        console.log('\n' + chalk.bold.cyan('📊 Instrumentation Summary'));
        console.log(chalk.gray('─'.repeat(60)) + '\n');
        console.log(chalk.bold('Results:'));
        console.log(`  ${chalk.cyan('●')} Experts Scanned: ${chalk.bold(summary.totalScanned)}`);
        console.log(`  ${chalk.green('●')} Successfully Instrumented: ${chalk.bold(summary.totalInstrumented)}`);
        console.log(`  ${chalk.blue('●')} Files Modified: ${chalk.bold(summary.filesModified)}`);
        if (summary.skipped > 0) {
            console.log(`  ${chalk.yellow('●')} Skipped: ${chalk.bold(summary.skipped)}`);
        }
        if (summary.errors > 0) {
            console.log(`  ${chalk.red('●')} Errors: ${chalk.bold(summary.errors)}`);
        }
        console.log('\n' + chalk.gray('─'.repeat(60)) + '\n');
        if (summary.totalInstrumented > 0) {
            this.success('Instrumentation complete!');
        }
        else if (summary.errors > 0) {
            this.error('Instrumentation completed with errors.');
        }
        else {
            this.info('No changes were made.');
        }
    }
}
/**
 * Helper function to create a simple progress indicator
 */
export function createProgressIndicator(total, message = 'Processing') {
    const bar = new cliProgress.SingleBar({
        format: `${message} ${chalk.cyan('{bar}')} {percentage}% | {value}/{total}`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });
    bar.start(total, 0);
    return {
        update: (current) => bar.update(current),
        stop: () => bar.stop()
    };
}
