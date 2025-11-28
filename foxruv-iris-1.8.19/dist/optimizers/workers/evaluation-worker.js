/**
 * Evaluation Worker
 *
 * Worker thread script for evaluating parameter configurations in parallel.
 * Receives batches of configurations and evaluates them concurrently.
 *
 * @module optimizers/workers/evaluation-worker
 * @version 1.0.0
 */
import { parentPort, workerData } from 'worker_threads';
/**
 * Worker main entry point
 */
if (parentPort) {
    // Get evaluation function from workerData
    // Note: Function serialization requires careful handling
    const { evaluationFnString } = workerData;
    // Reconstruct evaluation function
    let evaluationFn = null;
    try {
        // Create function from string (requires careful validation in main thread)
        evaluationFn = new Function('return ' + evaluationFnString)();
    }
    catch (error) {
        parentPort.postMessage({
            type: 'error',
            error: `Failed to reconstruct evaluation function: ${error}`
        });
        process.exit(1);
    }
    // Listen for messages from main thread
    parentPort.on('message', async (message) => {
        if (message.type === 'shutdown') {
            process.exit(0);
        }
        if (message.type === 'evaluate' && message.data && evaluationFn) {
            const { configurations, batchIndex } = message.data;
            const results = [];
            // Evaluate each configuration in the batch
            for (let i = 0; i < configurations.length; i++) {
                const config = configurations[i];
                try {
                    const score = await evaluationFn(config);
                    results.push({ configuration: config, score });
                    // Send progress update
                    if (parentPort && (i + 1) % 5 === 0) {
                        parentPort.postMessage({
                            type: 'progress',
                            data: {
                                batchIndex,
                                completedCount: i + 1
                            }
                        });
                    }
                }
                catch (error) {
                    results.push({
                        configuration: config,
                        score: { primary: 0 },
                        error: error instanceof Error ? error.message : String(error)
                    });
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
                });
            }
        }
    });
    // Signal worker is ready
    parentPort.postMessage({ type: 'ready' });
}
