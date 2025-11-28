/**
 * Iris Optimization CLI
 * 
 * Entry point for running optimizations via CLI.
 * Usage: iris optimize --config <path> --target <script.ts>
 * 
 * @module scripts/iris/iris-optimize
 */

import chalk from 'chalk'
import path from 'path'
import { loadIrisConfig } from '../../config/config-loader.js'
import { OptimizerRegistry } from '../../optimizers/optimizer-registry.js'
import type { EvaluationFunction, OptimizationOptions } from '../../optimizers/base-optimizer.js'

// Helper to dynamically import user script
async function importUserScript(scriptPath: string) {
    const absolutePath = path.resolve(process.cwd(), scriptPath)
    return await import(absolutePath)
}

export default async function optimize(cmdOptions: any) {
    console.log(chalk.blue('\n🚀 Iris Optimization Engine\n'))

    try {
        // 1. Load Configuration
        const config = await loadIrisConfig(cmdOptions.config)
        
        if (cmdOptions.config) {
            console.log(chalk.dim(`Loaded config from ${cmdOptions.config}`))
        }

        // 2. Load Optimizer Plugins
        console.log(chalk.dim('Loading optimizer plugins...'))
        await OptimizerRegistry.loadPlugins()
        
        const available = await OptimizerRegistry.listAvailable()
        console.log(chalk.dim(`Available optimizers: ${available.join(', ')}`))

        // 3. Select Optimizer
        const preferences = config.optimization?.strategy || ['grid']
        console.log(chalk.dim(`Preference strategy: ${preferences.join(' -> ')}`))
        
        // Map config types
        const optimizerConfig = {
            ...config.optimization?.options,
            // pass specific configs if needed, though currently BaseOptimizer only uses basic props
            baseUrl: config.optimization?.ax?.baseUrl || config.optimization?.dspy?.baseUrl
        }

        const optimizer = await OptimizerRegistry.getBestAvailable(preferences, optimizerConfig as any)
        console.log(chalk.green(`\n✅ Selected Optimizer: ${optimizer.getMetadata().name}`))

        // 4. Check Target Script
        if (!cmdOptions.target) {
            console.log(chalk.yellow('\n⚠️  No target script specified.'))
            console.log('To run an optimization, provide a script that exports an \'evaluate\' function:')
            console.log(chalk.cyan('  npx iris optimize --target ./experiments/my-experiment.ts'))
            
            // Show search space from config if available
            if (config.optimization?.searchSpace?.parameters?.length) {
                console.log('\nConfigured Search Space:')
                console.log(JSON.stringify(config.optimization.searchSpace, null, 2))
            }
            return
        }

        // 5. Load User Script
        console.log(`\nImporting target script: ${cmdOptions.target}...`)
        const userModule = await importUserScript(cmdOptions.target)

        if (!userModule.evaluate) {
            throw new Error(`Target script ${cmdOptions.target} must export an 'evaluate' function`)
        }

        // Wrap user's evaluate function to handle plain number returns
        const rawEvaluate = userModule.evaluate
        const evaluationFn: EvaluationFunction = async (config) => {
            const result = await rawEvaluate(config)
            // Wrap plain numbers into EvaluationScore format
            if (typeof result === 'number') {
                return { primary: result }
            }
            // Already in correct format
            return result
        }
        
        // 6. Determine Search Space (Script > Config)
        const searchSpace = userModule.searchSpace || config.optimization?.searchSpace
        
        if (!searchSpace || !searchSpace.parameters || searchSpace.parameters.length === 0) {
            throw new Error('No search space defined! Export \'searchSpace\' in your script or define it in iris-config.yaml')
        }

        // 7. Run Optimization
        console.log(chalk.blue('\n🏁 Starting optimization run...'))
        
        const options: OptimizationOptions = {
            maxTrials: cmdOptions.trials || config.optimization?.options?.maxTrials || 20,
            ...config.optimization?.options
        }

        const result = await optimizer.optimize(searchSpace, evaluationFn, options)

        // 8. Report Results
        console.log('\n' + '='.repeat(80))
        console.log(chalk.green.bold('\n📊 OPTIMIZATION SUMMARY'))
        console.log('-'.repeat(80))
        
        const primaryScore = typeof result.bestScore.primary === 'number' ? result.bestScore.primary : 0
        console.log(chalk.bold('\n  🎯 Best Score:'), chalk.green.bold(primaryScore.toFixed(4)))
        
        if (result.bestScore.secondary !== undefined) {
            const secondaryScore = typeof result.bestScore.secondary === 'number' ? result.bestScore.secondary : 0
            console.log(chalk.bold('     Secondary:'), chalk.cyan(secondaryScore.toFixed(4)))
        }
        
        console.log(chalk.bold('\n  ⚙️  Best Configuration:'))
        for (const [key, value] of Object.entries(result.bestConfiguration)) {
            console.log(`       ${chalk.cyan(key)}: ${chalk.white(JSON.stringify(value))}`)
        }
        
        console.log(chalk.bold('\n  📈 Run Statistics:'))
        console.log(`       Total Trials: ${chalk.yellow(String(result.totalTrials))}`)
        console.log(`       Duration: ${chalk.yellow((result.elapsedTime / 1000).toFixed(2) + 's')}`)
        console.log(`       Optimizer: ${chalk.blue(optimizer.getMetadata().name)}`)
        
        // Show improvement if we have history (cast to any for optional property)
        const resultAny = result as any
        if (resultAny.history && resultAny.history.length > 1) {
            const firstScore = resultAny.history[0]?.score?.primary ?? 0
            const improvement = ((primaryScore - firstScore) / Math.abs(firstScore) * 100).toFixed(1)
            console.log(`       Improvement: ${chalk.green(improvement + '%')} from baseline`)
        }
        
        console.log('\n' + '='.repeat(80))
        console.log(chalk.green('\n✅ Optimization complete! Apply these settings to your configuration.\n'))

    } catch (error) {
        console.error(chalk.red('\n❌ Optimization failed:'), error)
        process.exit(1)
    }
}
