#!/usr/bin/env tsx
/**
 * Example: Run AI Council Meeting
 *
 * Demonstrates how to use the AI Council for cross-project decision-making
 *
 * Usage:
 *   npx tsx src/council/examples/run-council-meeting.ts
 */

import { createAICouncil } from '../AICouncil.js'
import { GlobalMetricsCollector } from '../../telemetry/global-metrics.js'
import { aggregateTelemetryForCouncil } from '../utils/telemetry-aggregator.js'

async function main() {
  console.log('🏛️  FoxRuv Prime AI Council - Example Meeting\n')

  // Initialize council
  const council = createAICouncil({
    agentDbPath: './data/council/council.db',
    consensusThreshold: 0.80,
    defaultRolloutPercentage: 0.10,
    defaultMonitoringDuration: '24h'
  })

  // Initialize metrics collector
  const metricsCollector = new GlobalMetricsCollector({
    dbPath: './data/global-metrics.db',
    useSupabase: true,
    enableAgentDBCache: true
  })

  try {
    // Define projects to analyze
    const projects = ['nfl-predictor', 'microbiome', 'beclever']

    // Define time window (last 24 hours)
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    console.log('📊 Aggregating telemetry...')
    console.log(`   Projects: ${projects.join(', ')}`)
    console.log(`   Time window: ${dayAgo.toISOString()} to ${now.toISOString()}\n`)

    // Aggregate telemetry
    const telemetry = await aggregateTelemetryForCouncil(
      projects,
      { start: dayAgo, end: now },
      metricsCollector
    )

    console.log('📈 Telemetry Summary:')
    console.log(`   Projects analyzed: ${telemetry.projects.length}`)
    console.log(`   Total experts: ${telemetry.projects.reduce((sum, p) => sum + p.experts.length, 0)}`)
    console.log(`   Patterns found: ${telemetry.patterns.length}`)
    console.log(`   Alerts: ${telemetry.alerts.length}\n`)

    // Hold council meeting
    const result = await council.holdMeeting(telemetry)

    // Display results
    console.log('\n📋 Council Decision Summary:')
    console.log('─'.repeat(60))

    for (const decision of result.decisions) {
      console.log(`\n${getDecisionIcon(decision.type)} ${decision.type.toUpperCase()}`)

      switch (decision.type) {
        case 'pattern_transfer':
          console.log(`   Pattern: ${decision.pattern.name}`)
          console.log(`   Source: ${decision.pattern.sourceProject}`)
          console.log(`   Targets: ${decision.targetProjects.join(', ')}`)
          console.log(`   Success Rate: ${(decision.pattern.successRate * 100).toFixed(1)}%`)
          console.log(`   Rollout: ${decision.rollout.strategy} (${decision.rollout.percentage * 100}%)`)
          break

        case 'prompt_upgrade':
          console.log(`   Expert Type: ${decision.prompt.expertType}`)
          console.log(`   Version: ${decision.prompt.previousVersion} → ${decision.prompt.version}`)
          console.log(`   Improvement: ${(decision.prompt.avgImprovement * 100).toFixed(1)}%`)
          console.log(`   Targets: ${decision.targetExperts.length} expert(s)`)
          console.log(`   Rollout: ${decision.rollout.strategy} (${decision.rollout.percentage * 100}%)`)
          break

        case 'expert_rotation':
          console.log(`   Action: ${decision.action}`)
          console.log(`   Expert: ${decision.sourceExpert.expertId}`)
          console.log(`   Project: ${decision.sourceExpert.project}`)
          console.log(`   Accuracy: ${(decision.sourceExpert.accuracy * 100).toFixed(1)}%`)
          console.log(`   Strategy: ${decision.strategy.type}`)
          break
      }

      console.log(`   Confidence: ${(decision.consensus.confidence * 100).toFixed(1)}%`)
    }

    console.log('\n─'.repeat(60))

    // Display execution plan
    if (result.executionPlan.length > 0) {
      console.log('\n🚀 Execution Plan:')
      console.log('─'.repeat(60))

      for (const plan of result.executionPlan) {
        console.log(`\n${getDecisionIcon(plan.decision.type)} ${plan.decision.type}:`)
        plan.steps.forEach((step, i) => {
          console.log(`   ${i + 1}. ${step}`)
        })
        console.log(`   ⏱️  Duration: ${plan.estimatedDuration}`)
      }

      console.log('\n─'.repeat(60))
    }

    // Optionally execute decisions
    console.log('\n💡 To execute decisions, call: await council.executeDecisions(result)')

  } catch (error) {
    console.error('❌ Error during council meeting:', error)
    process.exit(1)
  } finally {
    council.close()
    metricsCollector.close()
  }

  console.log('\n✅ Council meeting complete!')
}

function getDecisionIcon(type: string): string {
  switch (type) {
    case 'pattern_transfer':
      return '🔄'
    case 'prompt_upgrade':
      return '⬆️'
    case 'expert_rotation':
      return '🔃'
    default:
      return '📌'
  }
}

// Run if called directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMainModule) {
  main().catch(console.error)
}

export { main as runCouncilMeeting }
