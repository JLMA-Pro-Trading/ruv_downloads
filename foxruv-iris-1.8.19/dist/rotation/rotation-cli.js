/**
 * CLI for Expert League and Rotation Management
 *
 * Commands:
 * - leagues: Show all league tables
 * - drift: Identify drifting experts
 * - recommend: Generate rotation recommendations
 * - execute: Execute approved rotation
 * - monitor: Check rotation monitoring status
 * - history: View ranking history
 */
import { ExpertLeagueManager } from './expert-leagues.js';
import { GlobalMetricsCollector } from '../telemetry/global-metrics.js';
import { AgentDBManager } from '../storage/agentdb-integration.js';
export class RotationCLI {
    leagueManager;
    constructor(agentDB, metricsCollector) {
        this.leagueManager = new ExpertLeagueManager(agentDB, metricsCollector);
    }
    /**
     * Display all league tables
     */
    async showLeagues(expertType) {
        console.log('\n🏆 Calculating league tables...\n');
        const report = await this.leagueManager.generateLeagueReport(expertType);
        console.log(report);
    }
    /**
     * Identify and display drifting experts
     */
    async showDriftingExperts() {
        console.log('\n🚨 Identifying drifting experts...\n');
        const drifting = await this.leagueManager.identifyDriftingExperts();
        if (drifting.length === 0) {
            console.log('✅ No drifting experts detected!\n');
            return;
        }
        console.log('='.repeat(80));
        console.log(`Found ${drifting.length} drifting expert(s)`);
        console.log('='.repeat(80));
        console.log('');
        for (const { expert, leagueEntry, driftMagnitude } of drifting) {
            console.log(`🚨 ${expert.expertId}@${expert.projectId}`);
            console.log(`   Rank: #${leagueEntry.rank} (${leagueEntry.status})`);
            console.log(`   Accuracy: ${(expert.accuracy * 100).toFixed(1)}% → ${(expert.recentAccuracy * 100).toFixed(1)}%`);
            console.log(`   Drift: ${(driftMagnitude * 100).toFixed(1)}%`);
            console.log(`   Trend: ${expert.trend}`);
            console.log('');
        }
    }
    /**
     * Generate and display rotation recommendations
     */
    async showRecommendations() {
        console.log('\n🔄 Generating rotation recommendations...\n');
        const recommendations = await this.leagueManager.generateRotationRecommendations();
        if (recommendations.length === 0) {
            console.log('✅ No rotations needed at this time!\n');
            return;
        }
        console.log('='.repeat(80));
        console.log(`Generated ${recommendations.length} rotation recommendation(s)`);
        console.log('='.repeat(80));
        console.log('');
        for (const rec of recommendations) {
            const priorityEmoji = {
                'critical': '🚨',
                'high': '⚠️',
                'medium': '📋',
                'low': 'ℹ️',
            }[rec.priority];
            console.log(`${priorityEmoji} ${rec.priority.toUpperCase()} - ${rec.id}`);
            console.log(`   Target: ${rec.targetExpertId}@${rec.targetProjectId}`);
            console.log(`   Mentor: ${rec.mentorExpertId}@${rec.mentorProjectId}`);
            console.log(`   Strategy: ${rec.strategy.type}`);
            console.log(`   Expected Impact: +${(rec.estimatedImpact * 100).toFixed(1)}%`);
            console.log(`   Reason: ${rec.reason}`);
            console.log(`   Status: ${rec.status}`);
            console.log('');
        }
    }
    /**
     * Execute rotation
     */
    async executeRotation(rotationId) {
        console.log(`\n🔄 Executing rotation: ${rotationId}...\n`);
        try {
            const result = await this.leagueManager.executeRotation(rotationId);
            console.log('✅ Rotation executed successfully!');
            console.log('');
            console.log('Applied Changes:');
            result.appliedChanges.forEach(change => {
                console.log(`   ✓ ${change}`);
            });
            console.log('');
            console.log(`Monitoring Period: ${result.rotation.monitoringPeriod} hours`);
            console.log(`Monitoring Metrics: ${result.rotation.strategy.monitoringMetrics.join(', ')}`);
            console.log('');
        }
        catch (error) {
            console.error('❌ Rotation execution failed:', error);
            throw error;
        }
    }
    /**
     * Check rotation monitoring status
     */
    async showMonitoringStatus(rotationId) {
        console.log(`\n📊 Checking rotation monitoring: ${rotationId}...\n`);
        try {
            const results = await this.leagueManager.getRotationMonitoringResults(rotationId);
            console.log('='.repeat(80));
            console.log('ROTATION MONITORING RESULTS');
            console.log('='.repeat(80));
            console.log('');
            console.log(`Target: ${results.rotation.targetExpertId}@${results.rotation.targetProjectId}`);
            console.log(`Mentor: ${results.rotation.mentorExpertId}@${results.rotation.mentorProjectId}`);
            console.log('');
            console.log('Performance:');
            console.log(`   Baseline:  ${(results.monitoring.baselineAccuracy * 100).toFixed(1)}%`);
            console.log(`   Current:   ${(results.monitoring.currentAccuracy * 100).toFixed(1)}%`);
            console.log(`   Change:    ${results.monitoring.improvement >= 0 ? '+' : ''}${(results.monitoring.improvement * 100).toFixed(1)}%`);
            console.log(`   Expected:  +${(results.monitoring.expectedImprovement * 100).toFixed(1)}%`);
            console.log('');
            console.log(`Status: ${results.monitoring.success ? '✅ SUCCESS' : '⚠️ UNDERPERFORMING'}`);
            console.log('');
            console.log('Metrics:');
            Object.entries(results.monitoring.metrics).forEach(([metric, value]) => {
                console.log(`   ${metric}: ${value}`);
            });
            console.log('');
        }
        catch (error) {
            console.error('❌ Failed to get monitoring results:', error);
            throw error;
        }
    }
    /**
     * Show ranking history
     */
    async showRankingHistory(expertId, projectId) {
        console.log(`\n📜 Ranking history for ${expertId}@${projectId}...\n`);
        const history = await this.leagueManager.getRankingHistory(expertId, projectId);
        if (history.length === 0) {
            console.log('No ranking history found.\n');
            return;
        }
        console.log('='.repeat(80));
        console.log(`${history.length} ranking change(s)`);
        console.log('='.repeat(80));
        console.log('');
        for (const entry of history) {
            const direction = entry.newRank < entry.previousRank ? '📈' : '📉';
            console.log(`${direction} ${entry.timestamp.toISOString()}`);
            console.log(`   Rank: #${entry.previousRank} → #${entry.newRank}`);
            console.log(`   Status: ${entry.previousStatus} → ${entry.newStatus}`);
            console.log(`   Trigger: ${entry.trigger}`);
            if (entry.notes) {
                console.log(`   Notes: ${entry.notes}`);
            }
            console.log('');
        }
    }
}
/**
 * CLI entry point
 */
export async function runRotationCLI(args) {
    const command = args[0];
    // Initialize dependencies (would come from app context in real usage)
    const agentDB = new AgentDBManager({ dbPath: './data/agentdb-rotation.db' });
    const metricsCollector = new GlobalMetricsCollector();
    const cli = new RotationCLI(agentDB, metricsCollector);
    switch (command) {
        case 'leagues':
            await cli.showLeagues(args[1]);
            break;
        case 'drift':
            await cli.showDriftingExperts();
            break;
        case 'recommend':
            await cli.showRecommendations();
            break;
        case 'execute':
            if (!args[1]) {
                console.error('Error: rotation ID required');
                process.exit(1);
            }
            await cli.executeRotation(args[1]);
            break;
        case 'monitor':
            if (!args[1]) {
                console.error('Error: rotation ID required');
                process.exit(1);
            }
            await cli.showMonitoringStatus(args[1]);
            break;
        case 'history':
            if (!args[1] || !args[2]) {
                console.error('Error: expertId and projectId required');
                process.exit(1);
            }
            await cli.showRankingHistory(args[1], args[2]);
            break;
        default:
            console.log(`
Expert League & Rotation Management CLI

Commands:
  leagues [type]              Show league tables (optional: filter by type)
  drift                       Identify drifting experts
  recommend                   Generate rotation recommendations
  execute <rotation-id>       Execute approved rotation
  monitor <rotation-id>       Check rotation monitoring status
  history <expert-id> <proj>  View ranking history

Examples:
  npm run rotation leagues analyst
  npm run rotation drift
  npm run rotation recommend
  npm run rotation execute rotation-1234567890-MarketAnalyst
  npm run rotation monitor rotation-1234567890-MarketAnalyst
  npm run rotation history MarketAnalyst nfl
      `);
            break;
    }
}
// Run CLI if executed directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
    runRotationCLI(process.argv.slice(2)).catch(console.error);
}
