/**
 * Evaluation Worker
 *
 * Worker thread script for evaluating parameter configurations in parallel.
 * Receives batches of configurations and evaluates them concurrently.
 *
 * @module optimizers/workers/evaluation-worker
 * @version 1.0.0
 */

import { parentPort, workerData } from 'worker_threads'
import type { ParameterConfiguration, EvaluationScore } from '../base-optimizer.js'

interface WorkerMessage {
    type: 'evaluate' | 'shutdown'
    data?: {
        configurations: ParameterConfiguration[]
        batchIndex: number
    }
}

interface WorkerResult {
    type: 'result' | 'error' | 'progress'
    data?: {
        batchIndex: number
        results: Array<{
            configuration: ParameterConfiguration
            score: EvaluationScore
            error?: string
        }>
        completedCount?: number
    }
    error?: string
}

/**
 * Worker main entry point
 */
if (parentPort) {
    // Get evaluation function from workerData
    // Note: Function serialization requires careful handling
    const { evaluationFnString } = workerData

    // Reconstruct evaluation function
    let evaluationFn: ((config: ParameterConfiguration) => Promise<EvaluationScore>) | null = null

    try {
        // Create function from string (requires careful validation in main thread)
        evaluationFn = new Function('return ' + evaluationFnString)() as any
    } catch (error) {
        parentPort.postMessage({
            type: 'error',
            error: `Failed to reconstruct evaluation function: ${error}`
        } as WorkerResult)
        process.exit(1)
    }

    // Listen for messages from main thread
    parentPort.on('message', async (message: WorkerMessage) => {
        if (message.type === 'shutdown') {
            process.exit(0)
        }

        if (message.type === 'evaluate' && message.data && evaluationFn) {
            const { configurations, batchIndex } = message.data
            const results: Array<{
                configuration: ParameterConfiguration
                score: EvaluationScore
                error?: string
            }> = []

            // Evaluate each configuration in the batch
            for (let i = 0; i < configurations.length; i++) {
                const config = configurations[i]

                try {
                    const score = await evaluationFn(config)
                    results.push({ configuration: config, score })

                    // Send progress update
                    if (parentPort && (i + 1) % 5 === 0) {
                        parentPort.postMessage({
                            type: 'progress',
                            data: {
                                batchIndex,
                                completedCount: i + 1
                            }
                        } as WorkerResult)
                    }
                } catch (error) {
                    results.push({
                        configuration: config,
                        score: { primary: 0 },
                        error: error instanceof Error ? error.message : String(error)
                    })
                }
            }

            // Send results back to main thread
            if (parentPort) {
                parentPort.postMessage({
                    type: 'result',
                    data: {
                        batchIndex,
                        results
                    }
                } as WorkerResult)
            }
        }
    })

    // Signal worker is ready
    parentPort.postMessage({ type: 'ready' })
}
