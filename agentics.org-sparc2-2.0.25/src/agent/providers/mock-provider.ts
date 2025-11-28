/**
 * Mock Provider
 * Implementation of the LLM provider interface for testing
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

/**
 * Mock provider options
 */
export interface MockProviderOptions {
  defaultModel?: string;
  mockResponses?: Record<string, string>;
}

/**
 * Mock provider implementation for testing
 */
export class MockProvider implements LLMProvider {
  private defaultModel: string;
  private mockResponses: Record<string, string>;

  /**
   * Create a new mock provider
   * @param options Provider options
   */
  constructor(options: MockProviderOptions = {}) {
    this.defaultModel = options.defaultModel || "mock-model";
    this.mockResponses = options.mockResponses || {
      "default": "This is a mock response from the mock provider.",
    };
  }

  /**
   * Get the provider name
   */
  getName(): string {
    return "mock";
  }

  /**
   * Get a completion from the LLM
   * @param prompt The prompt to send to the LLM
   * @param options Options for the completion
   */
  async getCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    await logMessage("info", "Mock provider getCompletion called", {
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : ""),
      model: options?.model || this.defaultModel,
    });

    // Check if we have a specific response for this prompt
    for (const [key, value] of Object.entries(this.mockResponses)) {
      if (prompt.includes(key)) {
        return value;
      }
    }

    // Return default response
    return this.mockResponses["default"];
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
    await logMessage("info", "Mock provider getChatCompletion called", {
      messageCount: messages.length,
      model: options?.model || this.defaultModel,
    });

    // Get the last user message
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();

    if (lastUserMessage) {
      // Check if we have a specific response for this message
      for (const [key, value] of Object.entries(this.mockResponses)) {
        if (lastUserMessage.content.includes(key)) {
          return {
            role: "assistant" as const,
            content: value,
          };
        }
      }
    }

    // Return default response
    return {
      role: "assistant" as const,
      content: this.mockResponses["default"],
    };
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
    await logMessage("info", "Mock provider createAssistant called", {
      name: options.name,
      model: options.model || this.defaultModel,
    });

    return {
      id: "mock-assistant-id",
      provider: this.getName(),
      name: options.name,
      model: options.model || this.defaultModel,
    };
  }

  /**
   * Set mock responses
   * @param responses Mock responses
   */
  setMockResponses(responses: Record<string, string>): void {
    this.mockResponses = { ...this.mockResponses, ...responses };
  }
}
