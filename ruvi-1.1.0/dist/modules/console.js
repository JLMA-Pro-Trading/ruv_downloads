import { getSupabaseClient, setSupabaseSession } from '../config/supabase.js';
import { loadSession } from '../utils/session.js';
import { printError, printInfo, printSection } from '../utils/ui.js';
import chalk from 'chalk';
import enquirer from 'enquirer';
import ora from 'ora';
const { prompt } = enquirer;
const conversationHistory = [];
export async function startConsole() {
    printSection('🚀 Agentic Console');
    console.log(chalk.gray('Interactive AI console with RAG knowledge base'));
    console.log(chalk.gray('Commands: /help, /clear, /history, /exit'));
    console.log();
    // Check if logged in
    const session = loadSession();
    if (session) {
        const supabase = getSupabaseClient();
        setSupabaseSession(session.accessToken, session.refreshToken);
    }
    let running = true;
    while (running) {
        try {
            const { query } = await prompt({
                type: 'input',
                name: 'query',
                message: chalk.cyan('ruv>'),
                validate: (input) => input.trim().length > 0 || 'Please enter a query',
            });
            const trimmedQuery = query.trim();
            // Handle commands
            if (trimmedQuery.startsWith('/')) {
                const command = trimmedQuery.slice(1).toLowerCase();
                switch (command) {
                    case 'help':
                        showHelp();
                        break;
                    case 'clear':
                        conversationHistory.length = 0;
                        console.log(chalk.green('✓ Conversation history cleared'));
                        break;
                    case 'history':
                        showHistory();
                        break;
                    case 'exit':
                    case 'quit':
                        running = false;
                        console.log(chalk.yellow('Goodbye!'));
                        break;
                    default:
                        printError(`Unknown command: ${command}`);
                        console.log(chalk.gray('Type /help for available commands'));
                }
                continue;
            }
            // Add user message to history
            conversationHistory.push({
                role: 'user',
                content: trimmedQuery,
            });
            // Call AI chat edge function
            await streamChat();
        }
        catch (error) {
            if (error.message === '') {
                // User cancelled (Ctrl+C)
                running = false;
                console.log(chalk.yellow('\nGoodbye!'));
            }
            else {
                printError(error instanceof Error ? error.message : 'An error occurred');
            }
        }
    }
}
async function streamChat() {
    const spinner = ora('Thinking...').start();
    try {
        const supabase = getSupabaseClient();
        // Get the session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        // Build the edge function URL
        const url = `${supabase.supabaseUrl}/functions/v1/ai-chat`;
        // Use fetch directly to get streaming response
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token || supabase.supabaseKey}`,
            },
            body: JSON.stringify({
                messages: conversationHistory.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                })),
            }),
        });
        spinner.stop();
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Handle streaming response
        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';
            let toolCalls = [];
            console.log();
            process.stdout.write(chalk.green('Assistant: '));
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonData = JSON.parse(line.slice(6));
                            // Handle tool calls
                            if (jsonData.choices?.[0]?.delta?.tool_calls) {
                                const toolCall = jsonData.choices[0].delta.tool_calls[0];
                                if (toolCall) {
                                    toolCalls.push(toolCall);
                                }
                            }
                            // Handle tool status
                            if (jsonData.choices?.[0]?.delta?.tool_status) {
                                const toolStatus = jsonData.choices[0].delta.tool_status;
                                if (toolStatus.status === 'running') {
                                    console.log();
                                    console.log(chalk.blue(`🔍 Searching: ${toolStatus.query}`));
                                }
                            }
                            // Handle content
                            if (jsonData.choices?.[0]?.delta?.content) {
                                const content = jsonData.choices[0].delta.content;
                                process.stdout.write(chalk.white(content));
                                assistantMessage += content;
                            }
                        }
                        catch (e) {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }
            console.log();
            console.log();
            // Add assistant response to history
            if (assistantMessage) {
                conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage,
                });
            }
        }
    }
    catch (error) {
        spinner.stop();
        throw error;
    }
}
function showHelp() {
    console.log();
    console.log(chalk.bold('Available Commands:'));
    console.log();
    console.log(chalk.cyan('  /help     ') + chalk.gray('- Show this help message'));
    console.log(chalk.cyan('  /clear    ') + chalk.gray('- Clear conversation history'));
    console.log(chalk.cyan('  /history  ') + chalk.gray('- Show conversation history'));
    console.log(chalk.cyan('  /exit     ') + chalk.gray('- Exit console'));
    console.log();
    console.log(chalk.bold('Examples:'));
    console.log(chalk.gray('  > Tell me about Neural Trader'));
    console.log(chalk.gray('  > What are strange-loops?'));
    console.log(chalk.gray('  > How do I book a coaching session?'));
    console.log();
}
function showHistory() {
    if (conversationHistory.length === 0) {
        printInfo('No conversation history');
        return;
    }
    console.log();
    console.log(chalk.bold('Conversation History:'));
    console.log();
    conversationHistory.forEach((msg, index) => {
        const prefix = msg.role === 'user'
            ? chalk.cyan('You: ')
            : chalk.green('Assistant: ');
        console.log(`${chalk.gray(`[${index + 1}]`)} ${prefix}`);
        console.log(chalk.white(msg.content));
        console.log();
    });
}
//# sourceMappingURL=console.js.map