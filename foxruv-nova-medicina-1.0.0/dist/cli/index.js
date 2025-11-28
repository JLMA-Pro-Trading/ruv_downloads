"use strict";
/**
 * Nova Medicina CLI - Main Entry Point
 *
 * Integration example showing how to use the help system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.helpSystem = void 0;
exports.createCLI = createCLI;
exports.run = run;
const commander_1 = require("commander");
const help_system_1 = __importDefault(require("./help-system"));
exports.helpSystem = help_system_1.default;
/**
 * Main CLI program
 */
function createCLI() {
    const program = new commander_1.Command();
    program
        .name('nova-medicina')
        .description('🚨 Emergency Medical Analysis & Triage Assistant 🚨')
        .version('1.0.0')
        .addHelpText('beforeAll', () => {
        help_system_1.default.showMainHelp();
        return '';
    });
    // Tutorial command
    program
        .command('tutorial')
        .description('Interactive tutorial mode')
        .action(async () => {
        await help_system_1.default.runTutorial();
    });
    // Analyze command
    program
        .command('analyze <symptoms>')
        .description('Analyze symptoms and assess medical urgency')
        .option('--severity <level>', 'Filter by severity level')
        .option('--age <years>', 'Patient age')
        .option('--conditions <list>', 'Pre-existing conditions')
        .option('--medications <list>', 'Current medications')
        .option('--allergies <list>', 'Known allergies')
        .option('--duration <time>', 'Symptom duration')
        .option('--photo <path>', 'Include photo of affected area')
        .option('--voice <path>', 'Include voice recording')
        .option('--emergency', 'Flag as potential emergency')
        .option('--lang <code>', 'Language code', 'en')
        .option('--json', 'Output in JSON format')
        .option('--save <path>', 'Save analysis to file')
        .addHelpText('beforeAll', () => {
        help_system_1.default.showAnalyzeHelp();
        return '';
    })
        .action(async (symptoms, options) => {
        console.log('Analyzing symptoms:', symptoms);
        console.log('Options:', options);
        // Implementation would go here
    });
    // Verify command
    program
        .command('verify <analysis-id>')
        .description('Verify analysis with multiple AI models')
        .option('--models <list>', 'Specific models to use')
        .option('--min-confidence <n>', 'Minimum confidence threshold', '75')
        .option('--consensus', 'Require model consensus')
        .option('--explain', 'Show detailed explanation')
        .option('--json', 'Output in JSON format')
        .addHelpText('beforeAll', () => {
        help_system_1.default.showVerifyHelp();
        return '';
    })
        .action(async (analysisId, options) => {
        console.log('Verifying analysis:', analysisId);
        console.log('Options:', options);
        // Implementation would go here
    });
    // Provider commands
    const providerCmd = program
        .command('provider')
        .description('Manage and notify healthcare providers')
        .addHelpText('beforeAll', () => {
        help_system_1.default.showProviderHelp();
        return '';
    });
    providerCmd
        .command('add')
        .description('Add a healthcare provider')
        .requiredOption('--name <name>', 'Provider name')
        .option('--email <email>', 'Email address')
        .option('--phone <number>', 'Phone number')
        .option('--fax <number>', 'Fax number')
        .option('--specialty <type>', 'Medical specialty')
        .option('--clinic <name>', 'Clinic/hospital name')
        .option('--primary', 'Set as primary care provider')
        .option('--emergency', 'Emergency contact')
        .action(async (options) => {
        console.log('Adding provider:', options);
        // Implementation would go here
    });
    providerCmd
        .command('list')
        .description('List all configured providers')
        .action(async () => {
        // Mock data for demonstration
        const providers = [
            {
                name: 'Dr. Jane Smith',
                email: 'jsmith@clinic.com',
                phone: '555-0100',
                specialty: 'Family Medicine',
                clinic: 'City Medical Center',
                primary: true,
                emergency: false
            }
        ];
        help_system_1.default.showProviderContacts(providers);
    });
    providerCmd
        .command('remove <provider-id>')
        .description('Remove a provider')
        .action(async (providerId) => {
        console.log('Removing provider:', providerId);
        // Implementation would go here
    });
    providerCmd
        .command('notify <analysis-id>')
        .description('Send analysis to provider')
        .option('--provider <id>', 'Specific provider')
        .option('--method <type>', 'Notification method (email, sms, fax, portal)', 'email')
        .option('--urgent', 'Flag as urgent')
        .option('--include-images', 'Include photos')
        .option('--message <text>', 'Personal message')
        .option('--cc <emails>', 'CC additional recipients')
        .option('--request-callback', 'Request callback')
        .action(async (analysisId, options) => {
        console.log('Notifying provider about:', analysisId);
        console.log('Options:', options);
        // Implementation would go here
    });
    providerCmd
        .command('status <notification-id>')
        .description('Check notification status')
        .action(async (notificationId) => {
        console.log('Checking status:', notificationId);
        // Implementation would go here
    });
    // Config command
    program
        .command('config')
        .description('Configure CLI settings and API keys')
        .option('--api-key <key>', 'Set Nova Medicina API key')
        .option('--openai-key <key>', 'Set OpenAI API key')
        .option('--anthropic-key <key>', 'Set Anthropic API key')
        .option('--google-key <key>', 'Set Google AI API key')
        .option('--region <code>', 'Set region (us, eu, asia)')
        .option('--language <code>', 'Default language')
        .option('--output <format>', 'Default output format (text, json)')
        .option('--auto-verify', 'Enable automatic verification')
        .option('--save-history', 'Save analysis history')
        .option('--encrypt-data', 'Enable data encryption')
        .addHelpText('beforeAll', () => {
        help_system_1.default.showConfigHelp();
        return '';
    })
        .action(async (options) => {
        console.log('Configuring:', options);
        // Implementation would go here
    });
    // Config subcommands
    program
        .command('config:set <key> <value>')
        .description('Set a configuration value')
        .action(async (key, value) => {
        console.log(`Setting ${key} = ${value}`);
        // Implementation would go here
    });
    program
        .command('config:get <key>')
        .description('Get a configuration value')
        .action(async (key) => {
        console.log(`Getting ${key}`);
        // Implementation would go here
    });
    program
        .command('config:list')
        .description('List all configuration')
        .action(async () => {
        console.log('Configuration:');
        // Implementation would go here
    });
    // History command
    program
        .command('history')
        .description('View analysis history')
        .option('--limit <n>', 'Number of entries to show', '10')
        .option('--severity <level>', 'Filter by severity')
        .option('--from <date>', 'Start date')
        .option('--to <date>', 'End date')
        .option('--json', 'Output in JSON format')
        .action(async (options) => {
        console.log('Showing history:', options);
        // Implementation would go here
    });
    // Export command
    program
        .command('export <analysis-id>')
        .description('Export analysis data')
        .argument('[format]', 'Output format (pdf, json, txt)', 'pdf')
        .option('--output <path>', 'Output file path')
        .option('--include-images', 'Include photos')
        .option('--include-verification', 'Include verification data')
        .action(async (analysisId, format, options) => {
        console.log(`Exporting ${analysisId} as ${format}:`, options);
        // Implementation would go here
    });
    // Help command (explicit)
    program
        .command('help [command]')
        .description('Display help for a command')
        .action(async (command) => {
        if (command) {
            help_system_1.default.showContextHelp([command]);
        }
        else {
            help_system_1.default.showMainHelp();
        }
    });
    // Handle unknown commands with suggestions
    program.on('command:*', (operands) => {
        const unknownCommand = operands[0];
        const suggestion = help_system_1.default.suggestCommand(unknownCommand);
        console.error(`\n❌ Unknown command: ${unknownCommand}\n`);
        if (suggestion) {
            console.log(`Did you mean: ${suggestion}?\n`);
            console.log(`Try: nova-medicina help ${suggestion}\n`);
        }
        else {
            console.log('Run "nova-medicina --help" to see all available commands.\n');
        }
        process.exit(1);
    });
    return program;
}
/**
 * Run the CLI
 */
async function run(args) {
    const program = createCLI();
    try {
        await program.parseAsync(args || process.argv);
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(`\n❌ Error: ${error.message}\n`);
        }
        process.exit(1);
    }
}
// Run if executed directly
if (require.main === module) {
    run();
}
//# sourceMappingURL=index.js.map