/**
 * Qwen3 Provider
 * Fetch-based wrapper for LM Studio OpenAI-compatible API
 *
 * Generic provider for any OpenAI-compatible local model endpoint
 */

// ============================================================================
// Types
// ============================================================================

export interface Signature {
  instructions: string
  input: Record<string, string>
  output: Record<string, string>
}

// ============================================================================
// Qwen3 Provider
// ============================================================================

export class Qwen3Provider {
  private endpoint: string
  private model: string
  private maxConcurrency: number = 5
  private requestQueue: Array<() => Promise<void>> = []
  private activeRequests: number = 0

  constructor(
    endpoint: string = 'http://192.168.254.246:1234', 
    model: string = 'qwen2.5-32b-instruct',
    maxConcurrency: number = 1
  ) {
    this.endpoint = endpoint
    this.model = model
    this.maxConcurrency = maxConcurrency
  }

  /**
   * Format signature into model prompt
   */
  private formatPrompt(
    signature: Signature,
    input: Record<string, any>,
    customInstructions?: string
  ): string {
    const instructions = customInstructions || signature.instructions

    let prompt = `${instructions}\n\n`

    // Add input fields
    prompt += '=== INPUT ===\n'
    for (const [key, description] of Object.entries(signature.input)) {
      const value = input[key] || ''
      prompt += `${key} (${description}): ${value}\n`
    }

    // Add output format
    prompt += '\n=== OUTPUT FORMAT ===\n'
    prompt += 'Provide your response in JSON format with these fields:\n'
    for (const [key, description] of Object.entries(signature.output)) {
      prompt += `- ${key}: ${description}\n`
    }

    prompt += '\nRespond ONLY with valid JSON, no additional text.'

    return prompt
  }

  /**
   * Parse JSON response from model
   */
  private parseResponse(content: string): Record<string, any> {
    try {
      // Extract JSON from code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      const jsonStr = jsonMatch ? jsonMatch[1] : content

      // Clean up common issues
      const cleaned = jsonStr
        .replace(/^[^{]*/, '') // Remove leading non-JSON
        .replace(/[^}]*$/, '') // Remove trailing non-JSON
        .trim()

      return JSON.parse(cleaned)
    } catch (error) {
      console.error('Failed to parse response:', content)
      throw new Error(`Invalid JSON response: ${error}`)
    }
  }

  /**
   * Make prediction using model
   */
  async predict(
    signature: Signature,
    input: Record<string, any>,
    customInstructions?: string,
    temperature: number = 0.3,
    maxTokens: number = 2048,
    schema?: Record<string, any>
  ): Promise<Record<string, any>> {
    const prompt = this.formatPrompt(signature, input, customInstructions)

    const body: any = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful AI assistant that provides accurate responses in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    }

    // Use Structured Outputs (JSON Schema) if provided, otherwise fallback to JSON Mode
    if (schema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: 'structured_response',
          strict: true,
          schema: schema
        }
      }
    } else {
      body.response_format = { type: 'json_object' }
    }

    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as any

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format')
      }

      const content = data.choices[0].message.content as string
      return this.parseResponse(content)
    } catch (error) {
      console.error('Prediction error:', error)
      throw error
    }
  }

  /**
   * Execute queued requests with concurrency control
   */
  private async processQueue(): Promise<void> {
    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrency) {
      const request = this.requestQueue.shift()
      if (request) {
        this.activeRequests++
        request().finally(() => {
          this.activeRequests--
          this.processQueue() // Process next queued request
        })
      }
    }
  }

  /**
   * Queue a prediction request with concurrency control
   */
  private queuedPredict(
    signature: Signature,
    input: Record<string, any>,
    customInstructions?: string,
    temperature: number = 0.3,
    maxTokens: number = 2048
  ): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const request = async () => {
        try {
          const result = await this.predict(
            signature,
            input,
            customInstructions,
            temperature,
            maxTokens
          )
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }

      this.requestQueue.push(request)
      this.processQueue()
    })
  }

  /**
   * Batch predictions with parallel execution (5x throughput)
   * Processes multiple predictions concurrently while respecting rate limits
   */
  async batchPredict(
    signature: Signature,
    inputs: Array<Record<string, any>>,
    customInstructions?: string,
    temperature: number = 0.3,
    maxTokens: number = 2048
  ): Promise<Array<Record<string, any>>> {
    const startTime = Date.now()
    console.log(`🚀 Starting batch inference for ${inputs.length} predictions (concurrency: ${this.maxConcurrency})`)

    // Create all prediction promises at once
    const predictionPromises = inputs.map((input, index) =>
      this.queuedPredict(signature, input, customInstructions, temperature, maxTokens)
        .then(result => {
          console.log(`✓ Completed prediction ${index + 1}/${inputs.length}`)
          return { success: true, result, index }
        })
        .catch(error => {
          console.error(`✗ Failed prediction ${index + 1}/${inputs.length}:`, error.message)
          return { success: false, error, index }
        })
    )

    // Wait for all predictions to complete
    const results = await Promise.all(predictionPromises)

    // Separate successful and failed predictions
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    const duration = (Date.now() - startTime) / 1000
    const throughput = inputs.length / duration

    console.log(`\n📊 Batch Inference Results:`)
    console.log(`   Total predictions: ${inputs.length}`)
    console.log(`   Successful: ${successful.length}`)
    console.log(`   Failed: ${failed.length}`)
    console.log(`   Duration: ${duration.toFixed(2)}s`)
    console.log(`   Throughput: ${throughput.toFixed(2)} predictions/sec`)
    console.log(`   Avg time per prediction: ${(duration / inputs.length).toFixed(2)}s\n`)

    // If any failed, log details
    if (failed.length > 0) {
      console.warn(`⚠️  Failed predictions at indices: ${failed.map(f => f.index).join(', ')}`)
    }

    // Return results in original order, with null for failures
    return results.map(r => r.success ? (r as any).result : null)
  }

  /**
   * Batch predictions with error recovery
   * Retries failed predictions up to maxRetries times
   */
  async batchPredictWithRetry(
    signature: Signature,
    inputs: Array<Record<string, any>>,
    customInstructions?: string,
    temperature: number = 0.3,
    maxTokens: number = 2048,
    maxRetries: number = 2
  ): Promise<Array<Record<string, any>>> {
    console.log(`🔄 Batch inference with retry (max ${maxRetries} retries per prediction)`)

    let results = await this.batchPredict(
      signature,
      inputs,
      customInstructions,
      temperature,
      maxTokens
    )

    // Retry failed predictions
    for (let retry = 1; retry <= maxRetries; retry++) {
      const failedIndices = results
        .map((result, index) => (result === null ? index : -1))
        .filter(index => index !== -1)

      if (failedIndices.length === 0) break

      console.log(`\n🔁 Retry ${retry}/${maxRetries} for ${failedIndices.length} failed predictions`)

      const retryInputs = failedIndices.map(i => inputs[i])
      const retryResults = await this.batchPredict(
        signature,
        retryInputs,
        customInstructions,
        temperature,
        maxTokens
      )

      // Update results with retry successes
      failedIndices.forEach((originalIndex, retryIndex) => {
        if (retryResults[retryIndex] !== null) {
          results[originalIndex] = retryResults[retryIndex]
        }
      })
    }

    const finalSuccessCount = results.filter(r => r !== null).length
    console.log(`\n✅ Final results: ${finalSuccessCount}/${inputs.length} successful\n`)

    return results
  }

  /**
   * Health check for endpoint availability
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/v1/models`, {
        method: 'GET',
      })
      return response.ok
    } catch (error) {
      console.error('Health check failed:', error)
      return false
    }
  }
}
