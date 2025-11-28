/**
 * iris login command
 * Authenticate with IRIS managed service
 */
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { CredentialManager } from '../../auth/credential-manager.js';
import { IrisAuthClient } from '../../auth/iris-auth-client.js';
export async function loginCommand(options) {
    const credManager = new CredentialManager();
    const authClient = new IrisAuthClient();
    console.log(chalk.cyan.bold('\n🔐 IRIS Authentication\n'));
    // Option 1: Direct API key
    if (options.key) {
        const spinner = ora('Validating API key...').start();
        if (!CredentialManager.validateApiKey(options.key)) {
            spinner.fail('Invalid API key format');
            console.log(chalk.yellow('\nAPI keys should be in format: iris_[32 characters]'));
            return;
        }
        const result = await authClient.validateApiKey(options.key);
        if (result.success) {
            await credManager.storeManagedCredentials(options.key, result.userId, result.email);
            spinner.succeed('Credentials stored successfully!');
            console.log(chalk.green(`\n✓ Logged in as: ${result.email || 'user'}`));
            console.log(chalk.gray(`  Tier: ${result.tier || 'free'}`));
            console.log(chalk.gray(`  Storage: ${credManager.getStorePath()}\n`));
        }
        else {
            spinner.fail('API key validation failed');
            console.log(chalk.red(`\n✗ ${result.error}\n`));
        }
        return;
    }
    // Option 2: Email/Password Login
    if (options.register) {
        await registerFlow(credManager, authClient);
    }
    else {
        await loginFlow(credManager, authClient, options.email);
    }
}
async function loginFlow(credManager, authClient, emailOption) {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            default: emailOption,
            validate: (input) => {
                if (!input.includes('@')) {
                    return 'Please enter a valid email';
                }
                return true;
            },
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
        },
    ]);
    const spinner = ora('Logging in...').start();
    const result = await authClient.login(answers.email, answers.password);
    if (result.success && result.apiKey) {
        await credManager.storeManagedCredentials(result.apiKey, result.userId, result.email);
        spinner.succeed('Login successful!');
        console.log(chalk.green(`\n✓ Logged in as: ${result.email}`));
        console.log(chalk.gray(`  Tier: ${result.tier || 'free'}`));
        console.log(chalk.gray(`  Credentials stored in: ${credManager.getStorePath()}\n`));
    }
    else {
        spinner.fail('Login failed');
        console.log(chalk.red(`\n✗ ${result.error}\n`));
        console.log(chalk.yellow('Hint: Use --register to create a new account\n'));
    }
}
async function registerFlow(credManager, authClient) {
    console.log(chalk.cyan('Creating new IRIS account...\n'));
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Name (optional):',
        },
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => {
                if (!input.includes('@')) {
                    return 'Please enter a valid email';
                }
                return true;
            },
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: (input) => {
                if (input.length < 8) {
                    return 'Password must be at least 8 characters';
                }
                return true;
            },
        },
        {
            type: 'password',
            name: 'confirmPassword',
            message: 'Confirm password:',
            mask: '*',
            validate: (input, answers) => {
                if (input !== answers.password) {
                    return 'Passwords do not match';
                }
                return true;
            },
        },
    ]);
    const spinner = ora('Creating account...').start();
    const result = await authClient.register(answers.email, answers.password, answers.name);
    if (result.success && result.apiKey) {
        await credManager.storeManagedCredentials(result.apiKey, result.userId, result.email);
        spinner.succeed('Account created successfully!');
        console.log(chalk.green(`\n✓ Registered as: ${result.email}`));
        console.log(chalk.gray(`  Tier: ${result.tier || 'free'}`));
        console.log(chalk.gray(`  Credentials stored in: ${credManager.getStorePath()}`));
        console.log(chalk.cyan('\n💡 Next steps:'));
        console.log(chalk.gray('   1. Run: iris status'));
        console.log(chalk.gray('   2. Start using IRIS in your projects\n'));
    }
    else {
        spinner.fail('Registration failed');
        console.log(chalk.red(`\n✗ ${result.error}\n`));
    }
}
export async function logoutCommand() {
    const credManager = new CredentialManager();
    if (!credManager.hasStoredCredentials()) {
        console.log(chalk.yellow('\n⚠️  No credentials found. Already logged out.\n'));
        return;
    }
    const spinner = ora('Clearing credentials...').start();
    await credManager.clearCredentials();
    spinner.succeed('Logged out successfully!');
    console.log(chalk.green('\n✓ Credentials cleared\n'));
}
export async function statusCommand() {
    const credManager = new CredentialManager();
    console.log(chalk.cyan.bold('\n🔐 IRIS Authentication Status\n'));
    const resolved = await credManager.resolve();
    if (!resolved) {
        console.log(chalk.yellow('Status: ') + chalk.red('Not authenticated'));
        console.log(chalk.gray('\nNo credentials found. Run one of:'));
        console.log(chalk.cyan('  iris login              ') + chalk.gray('# Login with email/password'));
        console.log(chalk.cyan('  iris login --key <key>  ') + chalk.gray('# Login with API key'));
        console.log(chalk.cyan('  iris login --register   ') + chalk.gray('# Create new account\n'));
        return;
    }
    console.log(chalk.yellow('Status: ') + chalk.green('✓ Authenticated'));
    console.log(chalk.yellow('Mode: ') + chalk.cyan(resolved.mode));
    console.log(chalk.yellow('Source: ') + chalk.gray(resolved.source));
    if (resolved.mode === 'managed' && resolved.managed) {
        console.log(chalk.yellow('\nManaged Mode:'));
        console.log(chalk.gray(`  API Key: ${resolved.managed.apiKey.substring(0, 15)}...`));
        if (resolved.managed.email) {
            console.log(chalk.gray(`  Email: ${resolved.managed.email}`));
        }
        if (resolved.source === 'stored') {
            console.log(chalk.gray(`  Storage: ${credManager.getStorePath()}`));
        }
    }
    else if (resolved.mode === 'self-hosted' && resolved.selfHosted) {
        console.log(chalk.yellow('\nSelf-Hosted Mode:'));
        console.log(chalk.gray(`  Supabase URL: ${resolved.selfHosted.supabase.url}`));
        console.log(chalk.gray(`  Supabase Key: ${resolved.selfHosted.supabase.anonKey.substring(0, 20)}...`));
        if (resolved.selfHosted.llm?.anthropic) {
            console.log(chalk.gray(`  Anthropic: ${resolved.selfHosted.llm.anthropic.substring(0, 15)}...`));
        }
        if (resolved.selfHosted.llm?.openai) {
            console.log(chalk.gray(`  OpenAI: ${resolved.selfHosted.llm.openai.substring(0, 15)}...`));
        }
    }
    console.log();
}
