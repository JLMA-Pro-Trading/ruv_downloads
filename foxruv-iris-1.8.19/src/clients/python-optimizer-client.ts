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
// Types (matching Python Pydantic models)
// ============================================================================

export interface SignatureField {
  name: string
  type: string
  description?: string
  required?: boolean
}

export interface SignatureDefinition {
  inputs: SignatureField[]
  outputs: SignatureField[]
  description?: string
}

export interface TrainingExample {
  inputs: Record<string, any>
  expected_outputs: Record<string, any>
  quality_score?: number
  sample_id?: string
}

export interface OptimizationConfig {
  num_candidates?: number        // Default: 10
  init_temperature?: number       // Default: 1.0
  num_trials?: number            // Default: 30
  max_bootstrapped_demos?: number // Default: 4
  max_labeled_demos?: number      // Default: 4
  verbose?: boolean              // Default: true
}

export interface LMConfig {
  provider?: 'anthropic' | 'openai'
  model?: string
  api_key?: string
}

export interface OptimizationRequest {
  expert_role: string
  signature: SignatureDefinition
  training_data: TrainingExample[]
  config?: OptimizationConfig
  lm_config?: LMConfig
}

export interface OptimizationResult {
  expert_role: string
  optimized_signature: {
    inputs: SignatureField[]
    outputs: SignatureField[]
    description?: string
  }
  few_shot_examples: Array<{
    inputs: Record<string, any>
    outputs: Record<string, any>
  }>
  performance_metrics: {
    quality_score: number
    baseline_quality: number
    num_examples: number
    num_demos: number
  }
  quality_before: number
  quality_after: number
  improvement: number
  version: string
  timestamp: string
  trials_completed: number
}

// ============================================================================
// Python Optimizer Client
// ============================================================================

export class PythonOptimizerClient {
  private baseUrl: string
  private timeout: number

  constructor(config: {
    baseUrl?: string
    timeout?: number
  } = {}) {
    this.baseUrl = config.baseUrl || process.env.DSPY_OPTIMIZER_URL || 'http://localhost:8000'
    this.timeout = config.timeout || 600000 // 10 minutes default (optimization takes time)
  }

  /**
   * Check if Python optimizer service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout for health check
      })
      return response.ok
    } catch (error) {
      // console.warn('Python optimizer service not available') // too verbose for default
      return false
    }
  }

  /**
   * Run MIPROv2 optimization via Python service
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    console.log(`🔧 Calling Python MIPROv2 optimizer for ${request.expert_role}...`)
    console.log(`   Training examples: ${request.training_data.length}`)
    console.log(`   Trials: ${request.config?.num_trials || 30}`)
    console.log('')

    try {
      const response = await fetch(`${this.baseUrl}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Optimization failed: ${response.status} ${response.statusText}\n${errorText}`)
      }

      const result = await response.json() as OptimizationResult

      console.log(`✅ MIPROv2 optimization complete!`)
      console.log(`   Quality: ${(result.quality_before * 100).toFixed(1)}% → ${(result.quality_after * 100).toFixed(1)}%`)
      console.log(`   Improvement: ${(result.improvement * 100).toFixed(1)}%`)
      console.log(`   Few-shot demos: ${result.few_shot_examples.length}`)
      console.log(`   Version: ${result.version}`)
      console.log('')

      return result
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(`Optimization timeout after ${this.timeout}ms. Try reducing num_trials or increasing timeout.`)
      }
      throw error
    }
  }

  /**
   * Get service information
   */
  async getServiceInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error(`Failed to get service info: ${response.status}`)
    }

    return response.json()
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Create default Python optimizer client
 */
export function createOptimizerClient(baseUrl?: string): PythonOptimizerClient {
  return new PythonOptimizerClient({ baseUrl })
}

/**
 * Check if Python optimizer is available
 */
export async function isOptimizerAvailable(baseUrl?: string): Promise<boolean> {
  const client = createOptimizerClient(baseUrl)
  return await client.healthCheck()
}
