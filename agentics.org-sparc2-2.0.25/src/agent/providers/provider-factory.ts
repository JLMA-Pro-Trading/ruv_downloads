/**
 * Provider Factory
 * Creates LLM providers based on configuration
 */

import { LLMProvider } from "../types.ts";
import { MockProvider, MockProviderOptions } from "./mock-provider.ts";
import { OpenAIProvider, OpenAIProviderOptions } from "./openai-provider.ts";
import { OpenRouterProvider, OpenRouterProviderOptions } from "./openrouter-provider.ts";

/**
 * Provider factory
 * Creates LLM providers based on configuration
 */
export class ProviderFactory {
  /**
   * Create a provider based on configuration
   * @param type Provider type
   * @param options Provider options
   * @returns LLM provider
   */
  static createProvider(type: string, options: any): LLMProvider {
    switch (type) {
      case "openai":
        return new OpenAIProvider(options as OpenAIProviderOptions);

      case "openrouter":
        return new OpenRouterProvider(options as OpenRouterProviderOptions);

      case "mock":
        return new MockProvider(options as MockProviderOptions);

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  /**
   * Create an OpenAI provider
   * @param name Provider name
   * @param options Provider options
   * @returns OpenAI provider
   */
  static createOpenAIProvider(name: string, options: OpenAIProviderOptions): OpenAIProvider {
    return new OpenAIProvider(options);
  }

  /**
   * Create an OpenRouter provider
   * @param name Provider name
   * @param options Provider options
   * @returns OpenRouter provider
   */
  static createOpenRouterProvider(
    name: string,
    options: OpenRouterProviderOptions,
  ): OpenRouterProvider {
    return new OpenRouterProvider(options);
  }

  /**
   * Create a mock provider
   * @param name Provider name
   * @param options Provider options
   * @returns Mock provider
   */
  static createMockProvider(name: string, options: MockProviderOptions): MockProvider {
    return new MockProvider(options);
  }
}
