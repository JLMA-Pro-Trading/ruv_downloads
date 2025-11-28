/**
 * Iris Council CLI
 * 
 * Command to run the AI Council analysis.
 * Usage: iris council analyze
 * 
 * @module scripts/iris/iris-council
 */

import chalk from 'chalk';
import { createAICouncil } from '../../council/AICouncil.js';
import { createGlobalMetrics } from '../../telemetry/global-metrics.js';
import { initSupabaseFromEnv, isSupabaseInitialized } from '../../supabase/client.js';
import path from 'path';

export default async function analyze(_options: any) {
    console.log(chalk.blue('\n🧠 Iris AI Council Analysis\n'));

    // Initialize Supabase if possible
    if (!isSupabaseInitialized()) {
        try {
            initSupabaseFromEnv();
        } catch {
            // Ignore, will fallback to local AgentDB
        }
    }

    const dbBasePath = path.join(process.cwd(), 'data', 'iris');
    
    // 1. Gather Telemetry
    console.log('Gathering telemetry from all projects...');
    
    const metricsCollector = createGlobalMetrics({
        dbPath: path.join(dbBasePath, 'global-metrics.db'),
        useSupabase: isSupabaseInitialized(),
        enableAgentDBCache: true
    });

    // Get metrics for all known projects (we might need to discover them first or just use current)
    // For now, let's use the current project from env or default
    const projectId = process.env.PROJECT_ID || 'current-project';
    const projectMetrics = await metricsCollector.getProjectMetrics(projectId);
    
    if (projectMetrics.length === 0) {
        console.log(chalk.yellow('No metrics found. Council analysis requires telemetry data.'));
        console.log('  Run: npx iris discover && npm test (or run your app) to generate data.');
        return;
    }

    // 2. Run Council Meeting
    const council = createAICouncil({
        agentDbPath: path.join(dbBasePath, 'council.db')
    });

    // Transform metrics to Council format
    const experts = projectMetrics.map(m => ({
        expertId: m.expertId,
        expertType: 'analyst', // Fallback, should be in metrics
        version: m.version,
        metrics: {
            accuracy: m.accuracy,
            confidence: m.avgConfidence,
            latency: m.avgDuration,
            totalRuns: m.totalPredictions
        },
        drift: undefined // Would need drift analysis results here
    }));

    const councilInput = {
        timeWindow: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: new Date(),
            duration: '24h'
        },
        projects: [{
            project: projectId,
            eventCount: experts.reduce((sum, e) => sum + e.metrics.totalRuns, 0),
            experts
        }],
        patterns: [], // Would fetch from PatternDiscovery
        alerts: [] // Would fetch from DriftDetector
    };

    try {
        const meetingResult = await council.holdMeeting(councilInput);

        // 3. Execute Decisions (Simulation)
        if (meetingResult.decisions.length > 0) {
            await council.executeDecisions(meetingResult);
        } else {
            console.log(chalk.yellow('\nNo actions recommended by the council at this time.'));
        }

    } catch (error) {
        console.error(chalk.red('\n❌ Council analysis failed:'), error);
    } finally {
        council.close();
        metricsCollector.close();
    }
}
