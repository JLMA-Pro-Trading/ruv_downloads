/**
 * Iris Patterns CLI
 *
 * Command to discover and list cross-project patterns.
 * Usage: iris patterns --source <project> --target <project>
 *
 * @module scripts/iris/iris-patterns
 */
import chalk from 'chalk';
import { createPatternDiscovery } from '../../patterns/pattern-discovery.js';
import { initSupabaseFromEnv, isSupabaseInitialized } from '../../supabase/client.js';
import path from 'path';
export default async function patterns(options) {
    console.log(chalk.blue('\n🔍 Iris Pattern Discovery\n'));
    // Initialize Supabase if possible
    if (!isSupabaseInitialized()) {
        try {
            initSupabaseFromEnv();
        }
        catch {
            // Ignore, will fallback to local AgentDB
        }
    }
    const dbBasePath = path.join(process.cwd(), 'data', 'iris');
    const discovery = createPatternDiscovery({
        dbPath: path.join(dbBasePath, 'pattern-discovery.db'),
        agentDBPath: path.join(dbBasePath, 'pattern-agentdb.db'),
        useSupabase: isSupabaseInitialized()
    });
    try {
        if (options.source && options.target) {
            // Transfer mode
            console.log(`Analzying transfer potential from ${chalk.cyan(options.source)} to ${chalk.cyan(options.target)}...\n`);
            // Since we don't have a "get all patterns from source" readily available as a public method 
            // that returns TransferRecommendation directly without a context, we will list source patterns 
            // and simulate a transfer check if possible, or just list them.
            // Actually, PatternDiscovery has getProjectPatterns.
            const sourcePatterns = await discovery.getProjectPatterns(options.source);
            if (sourcePatterns.length === 0) {
                console.log(chalk.yellow(`No patterns found in source project '${options.source}'.`));
                return;
            }
            console.log(chalk.bold(`Found ${sourcePatterns.length} patterns in ${options.source}:`));
            for (const pattern of sourcePatterns) {
                console.log(`- ${pattern.name} (${(pattern.performanceMetrics.successRate * 100).toFixed(1)}% success)`);
                // We could check transfer potential here if we had a target context
            }
        }
        else {
            // List mode (current project or all)
            const project = options.source || process.env.PROJECT_ID || '.'; // Default to current
            console.log(`Listing patterns for project: ${chalk.cyan(project)}\n`);
            const projectPatterns = await discovery.getProjectPatterns(project);
            if (projectPatterns.length === 0) {
                console.log(chalk.yellow('No patterns found.'));
                console.log('  (Patterns are discovered automatically after sufficient telemetry data is collected)');
            }
            else {
                console.log(chalk.bold('Discovered Patterns:'));
                for (const p of projectPatterns) {
                    console.log(`\n🔹 ${chalk.bold(p.name)}`);
                    console.log(`   Type: ${p.patternType}`);
                    console.log(`   Success Rate: ${chalk.green((p.performanceMetrics.successRate * 100).toFixed(1) + '%')}`);
                    console.log(`   Confidence: ${p.performanceMetrics.avgConfidence.toFixed(2)}`);
                    console.log(`   Usage: ${p.performanceMetrics.usageCount} times`);
                    console.log(`   Description: ${p.description}`);
                }
            }
        }
    }
    catch (error) {
        console.error(chalk.red('\n❌ Pattern discovery failed:'), error);
    }
    finally {
        discovery.close();
    }
}
