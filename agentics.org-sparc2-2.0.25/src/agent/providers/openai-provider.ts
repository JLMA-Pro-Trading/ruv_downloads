/**
 * OpenAI Provider
 * Implementation of the LLM provider interface for OpenAI
 */

import {
  Assistant,
  AssistantOptions,
  ChatCompletionOptions,
  ChatMessage,
  CompletionOptions,
  LLMProvider,
} from "../types.ts";
import { logMessage } from "../../logger.ts";

// Import OpenAI client
import OpenAI from "npm:openai";

/**
 * OpenAI provider options
 */
export interface OpenAIProviderOptions {
  apiKeyEnv?: string;
  apiKey?: string;
  defaultModel?: string;
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private defaultModel: string;

  /**
   * Create a new OpenAI provider
   * @param options Provider options
   */
  constructor(options: OpenAIProviderOptions) {
    // Get API key from environment variable or options
    const apiKey = Deno.env.get(options.apiKeyEnv || "OPENAI_API_KEY") || options.apiKey;

    if (!apiKey) {
      throw new Error(
        `API key not found for OpenAI provider (${options.apiKeyEnv || "OPENAI_API_KEY"})`,
      );
    }

    this.client = new OpenAI({ apiKey });
    this.defaultModel = options.defaultModel || "gpt-4o";
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return "openai";
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
      const response = await this.client.completions.create({
        model,
        prompt,
        max_tokens: maxTokens,
        temperature,
      });

      await logMessage("info", "OpenAI completion received", {
        model,
        promptLength: prompt.length,
        responseTokens: response.usage?.completion_tokens || 0,
      });

      return response.choices[0]?.text || "";
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "OpenAI completion error", { error: errorMessage });
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
      const response = await this.client.chat.completions.create({
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
      });

      await logMessage("info", "OpenAI chat completion received", {
        model,
        messageCount: messages.length,
        responseTokens: response.usage?.completion_tokens || 0,
      });

      return {
        role: "assistant" as const,
        content: response.choices[0]?.message?.content || "",
        tool_calls: response.choices[0]?.message?.tool_calls,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "OpenAI chat completion error", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Check if the provider supports assistants
   */
  supportsAssistants(): boolean {
    return true;
  }

  /**
   * Create an assistant
   * @param options Options for the assistant
   */
  async createAssistant(options: AssistantOptions): Promise<Assistant> {
    try {
      const assistant = await this.client.beta.assistants.create({
        name: options.name,
        description: options.description,
        model: options.model || this.defaultModel,
        instructions: options.instructions,
        tools: options.tools?.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        })),
      });

      await logMessage("info", "OpenAI assistant created", {
        name: options.name,
        model: options.model || this.defaultModel,
        assistantId: assistant.id,
      });

      return {
        id: assistant.id,
        provider: this.getName(),
        name: assistant.name || options.name,
        model: assistant.model,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logMessage("error", "OpenAI create assistant error", { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get the OpenAI client
   * Used for direct access to the client for assistant operations
   */
  getClient(): OpenAI {
    return this.client;
  }
}
