import { getSupabaseClient, setSupabaseSession } from '../config/supabase.js';
import { saveSession, clearSession, loadSession } from '../utils/session.js';
import { printSuccess, printError, printInfo } from '../utils/ui.js';
import enquirer from 'enquirer';
import ora from 'ora';
const { prompt } = enquirer;
export async function login() {
    console.log();
    printInfo('Login to your rUv account');
    console.log();
    const responses = await prompt([
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => {
                if (!input || !input.includes('@')) {
                    return 'Please enter a valid email address';
                }
                return true;
            },
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password:',
            validate: (input) => {
                if (!input || input.length < 6) {
                    return 'Password must be at least 6 characters';
                }
                return true;
            },
        },
    ]);
    const spinner = ora('Authenticating...').start();
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: responses.email,
            password: responses.password,
        });
        if (error) {
            spinner.fail('Authentication failed');
            printError(error.message);
            return;
        }
        if (!data.session || !data.user) {
            spinner.fail('Authentication failed');
            printError('No session data returned');
            return;
        }
        // Save session to local file
        saveSession({
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            userId: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name,
            expiresAt: Date.now() + (data.session.expires_in || 3600) * 1000,
        });
        // Set session in Supabase client
        setSupabaseSession(data.session.access_token, data.session.refresh_token);
        spinner.succeed('Successfully logged in!');
        printSuccess(`Welcome, ${data.user.email}!`);
        console.log();
    }
    catch (error) {
        spinner.fail('Authentication failed');
        printError(error instanceof Error ? error.message : 'Unknown error');
    }
}
export async function register() {
    console.log();
    printInfo('Create your rUv account');
    console.log();
    const responses = await prompt([
        {
            type: 'input',
            name: 'fullName',
            message: 'Full Name (optional):',
        },
        {
            type: 'input',
            name: 'email',
            message: 'Email:',
            validate: (input) => {
                if (!input || !input.includes('@')) {
                    return 'Please enter a valid email address';
                }
                return true;
            },
        },
        {
            type: 'password',
            name: 'password',
            message: 'Password (min 6 characters):',
            validate: (input) => {
                if (!input || input.length < 6) {
                    return 'Password must be at least 6 characters';
                }
                return true;
            },
        },
    ]);
    const spinner = ora('Creating account...').start();
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.signUp({
            email: responses.email,
            password: responses.password,
            options: {
                data: {
                    full_name: responses.fullName || '',
                },
            },
        });
        if (error) {
            spinner.fail('Registration failed');
            printError(error.message);
            return;
        }
        if (!data.user) {
            spinner.fail('Registration failed');
            printError('No user data returned');
            return;
        }
        // Check if email confirmation is required
        if (data.session) {
            // Auto-login if no email confirmation required
            saveSession({
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
                userId: data.user.id,
                email: data.user.email,
                fullName: responses.fullName,
                expiresAt: Date.now() + (data.session.expires_in || 3600) * 1000,
            });
            setSupabaseSession(data.session.access_token, data.session.refresh_token);
            spinner.succeed('Account created and logged in!');
            printSuccess(`Welcome, ${data.user.email}!`);
        }
        else {
            spinner.succeed('Account created!');
            printSuccess('Please check your email to confirm your account before logging in.');
        }
        console.log();
    }
    catch (error) {
        spinner.fail('Registration failed');
        printError(error instanceof Error ? error.message : 'Unknown error');
    }
}
export async function logout() {
    const session = loadSession();
    if (!session) {
        printInfo('Not currently logged in');
        return;
    }
    const spinner = ora('Logging out...').start();
    try {
        const supabase = getSupabaseClient();
        setSupabaseSession(session.accessToken, session.refreshToken);
        await supabase.auth.signOut();
        clearSession();
        spinner.succeed('Successfully logged out');
    }
    catch (error) {
        spinner.fail('Logout failed');
        clearSession(); // Clear session anyway
        printError(error instanceof Error ? error.message : 'Unknown error');
    }
}
export async function checkAuth() {
    const session = loadSession();
    if (!session) {
        return false;
    }
    try {
        const supabase = getSupabaseClient();
        setSupabaseSession(session.accessToken, session.refreshToken);
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
            clearSession();
            return false;
        }
        return true;
    }
    catch (error) {
        clearSession();
        return false;
    }
}
export async function getCurrentUser() {
    const session = loadSession();
    if (!session) {
        return null;
    }
    try {
        const supabase = getSupabaseClient();
        setSupabaseSession(session.accessToken, session.refreshToken);
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
            return null;
        }
        return {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name || session.fullName,
        };
    }
    catch (error) {
        return null;
    }
}
//# sourceMappingURL=auth.js.map