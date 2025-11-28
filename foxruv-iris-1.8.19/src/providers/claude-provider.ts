/**
 * Claude Provider
 * Fetch-based wrapper for Anthropic API (Claude Opus 4)
 */

export interface Signature {
  instructions: string
  input: Record<string, string>
  output: Record<string, string>
}

export class ClaudeProvider {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'claude-opus-4-20250514') { 
    this.apiKey = apiKey
    this.model = model
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

    return prompt
  }

  /**
   * Make prediction using model
   */
  async predict(
    signature: Signature,
    input: Record<string, any>,
    customInstructions?: string,
    temperature: number = 0.0, // Low temp for evaluation consistency
    maxTokens: number = 1024
  ): Promise<Record<string, any>> {
    const prompt = this.formatPrompt(signature, input, customInstructions)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as any
      const content = data.content[0].text

      // Extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
         throw new Error('No JSON found in response')
      }
      
      return JSON.parse(jsonMatch[0])

    } catch (error) {
      console.error('Claude Prediction error:', error)
      throw error
    }
  }
}
