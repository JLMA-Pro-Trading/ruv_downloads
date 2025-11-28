/**
 * OpenRouter Provider
 * Implementation of the LLM provider interface for OpenRouter
 */

import { ChatCompletionOptions, ChatMessage, CompletionOptions, LLMProvider } from "../types.ts";
import { logMessage } from "../../logger.ts";

/**
 * OpenRouter provider options
 */
export interface OpenRouterProviderOptions {
  apiKeyEnv?: string;
  apiKey?: string;
  defaultModel?: string;
}

/**
 * OpenRouter provider implementation
 */
export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private defaultModel: string;
  private baseURL: string = "https://openrouter.ai/api/v1";

  /**
   * Create a new OpenRouter provider
   * @param options Provider options
   */
  constructor(options: OpenRouterProviderOptions) {
    // Get API key from environment variable or options
    const apiKey = Deno.env.get(options.apiKeyEnv || "OPENROUTER_API_KEY") || options.apiKey;

    if (!apiKey) {
      throw new Error(
        `API key not found for OpenRouter provider (${options.apiKeyEnv || "OPENROUTER_API_KEY"})`,
      );
    }

    this.apiKey = apiKey;
    this.defaultModel = options.defaultModel || "openai/o3-mini-high";
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return "openrouter";
  }

  /**
   * Get a completion from the LLM
   * @param prompt The prompt to send to the LLM
   * @param options Options for the completion
   */
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    const model = options?.model || this.defaultModel;
    const maxTokens = options?.maxTokens || 1000;
    const temperature = options?.temperature || 0.7;

    try {
      const response = await fetch(`${this.baseURL}/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://sparc2-agent.example.com",
        },
        body: JSON.stringify({
          model,
          prompt,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      await logMessage("info", "OpenRouter completion received", {
        model,
        promptLength: prompt.length,
      });

      return data.choices[0]?.text || "";
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "OpenRouter completion error", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get a chat completion from the LLM
   * @param messages The messages to send to the LLM
   * @param options Options for the chat completion
   */
  async getChatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatMessage> {
    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature || 0.7;

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://sparc2-agent.example.com",
        },
        body: JSON.stringify({
          model,
          messages: messages.map((msg) => {
            const message: any = {
              role: msg.role,
              content: msg.content,
            };

            if (msg.name) {
              message.name = msg.name;
            }

            return message;
          }),
          temperature,
          tools: options?.tools,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      await logMessage("info", "OpenRouter chat completion received", {
        model,
        messageCount: messages.length,
      });

      return {
        role: "assistant" as const,
        content: data.choices[0]?.message?.content || "",
        tool_calls: data.choices[0]?.message?.tool_calls,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "OpenRouter chat completion error", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if the provider supports assistants
   */
  supportsAssistants(): boolean {
    return false;
  }
}
