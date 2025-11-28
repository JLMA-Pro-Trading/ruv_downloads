#!/usr/bin/env node
/**
 * IRIS Evaluate - Single Project Evaluation CLI
 *
 * Evaluates a single project's health using Iris and stores results.
 *
 * Usage:
 *   npm run iris:evaluate -- --project nfl-predictor
 *   npm run iris:evaluate -- --project microbiome-platform --auto-retrain
 *   npm run iris:evaluate -- --help
 *
 * Exit Codes:
 *   0 = Success
 *   1 = Error
 *   2 = Invalid arguments
 *   3 = Project evaluation failed
 */

import { randomUUID } from 'crypto'
import { createIrisPrime, type IrisPrimeConfig } from '../../orchestrators/iris-prime.js'
import { logTelemetry } from '../../supabase/index.js'
import { initSupabaseFromEnv, isSupabaseInitialized } from '../../supabase/client.js'
import * as fs from 'fs'
import * as path from 'path'

interface EvaluateOptions {
  project: string
  autoRetrain?: boolean
  autoPromote?: boolean
  dbBasePath?: string
  logPath?: string
  verbose?: boolean
  outputJson?: string
}

/**
 * Parse command line arguments
 */
function parseArgs(): EvaluateOptions | null {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    return null
  }

  const options: Partial<EvaluateOptions> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--project':
      case '-p':
        options.project = args[++i]
        break
      case '--auto-retrain':
        options.autoRetrain = true
        break
      case '--auto-promote':
        options.autoPromote = true
        break
      case '--db-base-path':
        options.dbBasePath = args[++i]
        break
      case '--log-path':
        options.logPath = args[++i]
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--output-json':
      case '-o':
        options.outputJson = args[++i]
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        printHelp()
        process.exit(2)
    }
  }

  if (!options.project) {
    console.error('Error: --project is required')
    printHelp()
    process.exit(2)
  }

  return options as EvaluateOptions
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
IRIS Evaluate - Single Project Evaluation

Usage:
  npm run iris:evaluate -- --project <project-id> [options]

Required Arguments:
  --project, -p <id>        Project ID to evaluate

Options:
  --auto-retrain            Enable auto-retraining for drifting experts
  --auto-promote            Enable auto-promotion of better prompts
  --db-base-path <path>     Base path for AgentDB databases
  --log-path <path>         Path for log files
  --output-json, -o <file>  Save report as JSON to file
  --verbose, -v             Enable verbose logging
  --help, -h                Show this help message

Examples:
  npm run iris:evaluate -- --project nfl-predictor
  npm run iris:evaluate -- --project microbiome-platform --auto-retrain
  npm run iris:evaluate -- -p beclever-ai --output-json report.json

Exit Codes:
  0 = Success
  1 = Error
  2 = Invalid arguments
  3 = Project evaluation failed
`)
}

/**
 * Ensure log directory exists
 */
function ensureLogDir(logPath: string): void {
  const logDir = path.dirname(logPath)
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true })
  }
}

/**
 * Log to file and console
 */
function log(message: string, logPath?: string, verbose?: boolean) {
  if (verbose) {
    console.log(message)
  }

  if (logPath) {
    ensureLogDir(logPath)
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`)
  }
}

/**
 * Main execution
 */
async function main(options: any = {}) {
  options = options && Object.keys(options).length > 0 ? options : parseArgs()
  if (!options) {
    process.exit(0) // Help was shown
  }

  const startTime = Date.now()
  const logPath = options.logPath || path.join(process.cwd(), 'logs', 'iris-evaluate.log')

  try {
    log(`Starting IRIS evaluation for project: ${options.project}`, logPath, options.verbose)

    // Initialize Supabase if credentials are available
    if (!isSupabaseInitialized()) {
      try {
        initSupabaseFromEnv()
        log('✅ Supabase client initialized', logPath, options.verbose)
      } catch (err) {
        if (process.env.IRIS_VERBOSE) { console.info('ℹ️  Using local-only mode (federation disabled)') }
        console.warn('   Set FOXRUV_SUPABASE_URL, FOXRUV_SUPABASE_SERVICE_ROLE_KEY, and FOXRUV_PROJECT_ID in .env')
      }
    }

    // Create IRIS instance
    const irisConfig: IrisPrimeConfig = {
      dbBasePath: options.dbBasePath || path.join(process.cwd(), 'data', 'iris'),
      defaultAutoRetrain: options.autoRetrain || false,
      defaultAutoPromote: options.autoPromote || false,
      logPath: path.dirname(logPath)
    }

    const iris = createIrisPrime(irisConfig)

    // Configure project
    iris.configureProject({
      projectId: options.project,
      autoRetrain: options.autoRetrain || false,
      autoPromote: options.autoPromote || false,
      retrainingThreshold: 0.1, // 10% drop
      promotionThreshold: 0.1, // 10% improvement
      minEvaluations: 10
    })

    log('IRIS initialized', logPath, options.verbose)

    // Evaluate project
    log(`Evaluating project: ${options.project}...`, logPath, options.verbose)
    const report = await iris.evaluateProject(options.project)

    // Enhanced summary output
    console.log('\n' + '='.repeat(80))
    console.log('\n📊 EVALUATION SUMMARY')
    console.log('-'.repeat(80))
    
    // Health status with color coding
    const health = report.overallHealth as string
    const healthColor = health === 'excellent' || health === 'good' ? '\x1b[32m' : 
                        health === 'fair' ? '\x1b[33m' : '\x1b[31m'
    const resetColor = '\x1b[0m'
    
    console.log(`\n  🏥 Project: ${options.project}`)
    console.log(`  📈 Health Score: ${healthColor}${report.healthScore}/100${resetColor}`)
    console.log(`  📊 Status: ${healthColor}${report.overallHealth.toUpperCase()}${resetColor}`)
    
    console.log('\n  📋 Analysis Results:')
    console.log(`       Drift Alerts: ${report.driftAlerts.length > 0 ? '\x1b[33m' + report.driftAlerts.length + '\x1b[0m ⚠️' : '\x1b[32m0\x1b[0m ✅'}`)
    console.log(`       Prompt Recommendations: ${report.promptRecommendations.length}`)
    console.log(`       Rotation Recommendations: ${report.rotationRecommendations.length}`)
    
    // Display critical actions
    const criticalActions = report.recommendedActions.filter(a => a.priority === 'critical')
    if (criticalActions.length > 0) {
      console.log('\n  ⚠️  Critical Actions Required:')
      criticalActions.forEach((action, i) => {
        console.log(`       ${i + 1}. ${action.action}`)
        console.log(`          ${action.reason}`)
      })
    } else {
      console.log('\n  ✅ No critical actions required')
    }
    
    // Show high priority actions if any
    const highActions = report.recommendedActions.filter(a => a.priority === 'high')
    if (highActions.length > 0) {
      console.log(`\n  📌 High Priority (${highActions.length}):`)
      highActions.slice(0, 3).forEach((action, i) => {
        console.log(`       ${i + 1}. ${action.action}`)
      })
      if (highActions.length > 3) {
        console.log(`       ... and ${highActions.length - 3} more`)
      }
    }
    
    console.log('\n' + '='.repeat(80))

    // Save JSON output if requested
    if (options.outputJson) {
      const outputPath = path.resolve(options.outputJson)
      fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))
      log(`Report saved to: ${outputPath}`, logPath, true)
    }

    // Log to Supabase telemetry
    try {
      await logTelemetry({
        expertId: 'iris-evaluate-cli',
        version: '1.0.0',
        runId: randomUUID(),
        outcome: 'success',
        metadata: {
          eventType: 'IRIS_EVALUATE_CLI',
          projectId: options.project,
          healthScore: report.healthScore,
          overallHealth: report.overallHealth,
          durationMs: Date.now() - startTime,
          driftAlertsCount: report.driftAlerts.length,
          criticalActionsCount: criticalActions.length
        }
      })
    } catch (err) {
      // Don't fail if Supabase logging fails
      if (!(err instanceof Error && err.message.includes('not initialized'))) {
        log(`Warning: Failed to log to Supabase: ${err}`, logPath, options.verbose)
      }
    }

    // Cleanup
    iris.close()

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    log(`Evaluation completed in ${duration}s`, logPath, true)

    process.exit(0)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log(`Error: ${errorMessage}`, logPath, true)

    // Log error to Supabase
    try {
      await logTelemetry({
        expertId: 'iris-evaluate-cli',
        version: '1.0.0',
        runId: randomUUID(),
        outcome: 'failure',
        metadata: {
          eventType: 'IRIS_EVALUATE_CLI_ERROR',
          projectId: options.project,
          error: errorMessage,
          durationMs: Date.now() - startTime
        }
      })
    } catch {
      // Silently ignore Supabase errors
    }

    process.exit(3)
  }
}

// Run if executed directly (ES module pattern)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
if (isMainModule) {
  main()
}

export { main as irisEvaluate }
export default main
