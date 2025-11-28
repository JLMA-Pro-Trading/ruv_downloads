/**
 * Python MIPROv2 Optimizer Client
 *
 * TypeScript client for communicating with the Python DSPy optimizer service.
 * Used ONLY during training to optimize expert prompts via MIPROv2.
 *
 * Architecture:
 * - Training: TypeScript → Python MIPROv2 service → Optimized prompts
 * - Production: TypeScript loads optimized prompts from AgentDB (no Python)
 *
 * @module python-optimizer-client
 * @version 1.0.0
 */
// ============================================================================
// Python Optimizer Client
// ============================================================================
export class PythonOptimizerClient {
    baseUrl;
    timeout;
    constructor(config = {}) {
        this.baseUrl = config.baseUrl || process.env.DSPY_OPTIMIZER_URL || 'http://localhost:8000';
        this.timeout = config.timeout || 600000; // 10 minutes default (optimization takes time)
    }
    /**
     * Check if Python optimizer service is available
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout for health check
            });
            return response.ok;
        }
        catch (error) {
            // console.warn('Python optimizer service not available') // too verbose for default
            return false;
        }
    }
    /**
     * Run MIPROv2 optimization via Python service
     */
    async optimize(request) {
        console.log(`🔧 Calling Python MIPROv2 optimizer for ${request.expert_role}...`);
        console.log(`   Training examples: ${request.training_data.length}`);
        console.log(`   Trials: ${request.config?.num_trials || 30}`);
        console.log('');
        try {
            const response = await fetch(`${this.baseUrl}/optimize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request),
                signal: AbortSignal.timeout(this.timeout)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Optimization failed: ${response.status} ${response.statusText}\n${errorText}`);
            }
            const result = await response.json();
            console.log(`✅ MIPROv2 optimization complete!`);
            console.log(`   Quality: ${(result.quality_before * 100).toFixed(1)}% → ${(result.quality_after * 100).toFixed(1)}%`);
            console.log(`   Improvement: ${(result.improvement * 100).toFixed(1)}%`);
            console.log(`   Few-shot demos: ${result.few_shot_examples.length}`);
            console.log(`   Version: ${result.version}`);
            console.log('');
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.name === 'TimeoutError') {
                throw new Error(`Optimization timeout after ${this.timeout}ms. Try reducing num_trials or increasing timeout.`);
            }
            throw error;
        }
    }
    /**
     * Get service information
     */
    async getServiceInfo() {
        const response = await fetch(`${this.baseUrl}/`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) {
            throw new Error(`Failed to get service info: ${response.status}`);
        }
        return response.json();
    }
}
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Create default Python optimizer client
 */
export function createOptimizerClient(baseUrl) {
    return new PythonOptimizerClient({ baseUrl });
}
/**
 * Check if Python optimizer is available
 */
export async function isOptimizerAvailable(baseUrl) {
    const client = createOptimizerClient(baseUrl);
    return await client.healthCheck();
}
