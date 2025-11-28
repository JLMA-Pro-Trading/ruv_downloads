/**
 * Agent Configuration Parser
 * Parses TOML configuration files for the agent framework
 */

import { parse } from "https://deno.land/std@0.203.0/toml/mod.ts";
import { logMessage } from "../../logger.ts";
import { AgentConfig, AgentFlow, AgentStep, RawAgentConfig } from "../types.ts";
import { ProviderFactory } from "../providers/provider-factory.ts";

/**
 * Parse a TOML configuration file for agent configuration
 * @param configPath Path to the TOML configuration file
 * @returns Parsed agent configuration
 */
export async function parseAgentConfig(configPath: string): Promise<AgentConfig> {
  try {
    // Read the TOML file
    const tomlContent = await Deno.readTextFile(configPath);

    // Parse the TOML content
    const parsedConfig = parse(tomlContent) as Record<string, unknown>;

    // Validate the parsed config has the required structure
    if (!parsedConfig.agent || typeof parsedConfig.agent !== "object") {
      throw new Error("Missing or invalid 'agent' section in configuration");
    }

    // Convert to RawAgentConfig with proper type checking
    const config: RawAgentConfig = {
      agent: parsedConfig.agent as RawAgentConfig["agent"],
      providers: (parsedConfig.providers as Record<string, any>) || {},
      flows: (parsedConfig.flows as Record<string, any>) || {},
    };

    // Process the configuration (resolve variables, etc.)
    return processAgentConfig(config);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logMessage("error", "Failed to parse agent configuration", { error: errorMessage });
    throw error;
  }
}

/**
 * Process a raw agent configuration
 * @param config Raw agent configuration from TOML
 * @returns Processed agent configuration
 */
function processAgentConfig(config: RawAgentConfig): AgentConfig {
  // Create provider instances
  const providers: Record<string, any> = {};
  const factory = new ProviderFactory();

  for (const [name, providerConfig] of Object.entries(config.providers || {})) {
    switch (providerConfig.type) {
      case "openai":
        providers[name] = ProviderFactory.createOpenAIProvider(name, {
          apiKeyEnv: providerConfig.api_key_env,
          defaultModel: providerConfig.default_model,
        });
        break;

      case "openrouter":
        providers[name] = ProviderFactory.createOpenRouterProvider(name, {
          apiKeyEnv: providerConfig.api_key_env,
          defaultModel: providerConfig.default_model,
        });
        break;

      case "mock":
        providers[name] = ProviderFactory.createMockProvider(name, {
          defaultModel: providerConfig.default_model,
          mockResponses: providerConfig.mock_responses,
        });
        break;

      default:
        throw new Error(`Unknown provider type: ${providerConfig.type}`);
    }
  }

  // Process flows
  const flows: Record<string, AgentFlow> = {};

  for (const [name, flowConfig] of Object.entries(config.flows || {})) {
    if (typeof flowConfig !== "object" || flowConfig === null) {
      throw new Error(`Invalid flow configuration for ${name}`);
    }

    const steps: Record<string, AgentStep> = {};
    const flowSteps = (flowConfig as any).steps || {};

    for (const [stepName, stepConfig] of Object.entries(flowSteps)) {
      if (typeof stepConfig !== "object" || stepConfig === null) {
        throw new Error(`Invalid step configuration for ${stepName}`);
      }

      // Resolve provider reference
      const providerName = (stepConfig as any).provider;
      const provider = providers[providerName];

      if (!provider) {
        throw new Error(`Provider not found: ${providerName}`);
      }

      // Resolve model reference (if it contains a variable)
      let model = (stepConfig as any).model;
      if (model && typeof model === "string" && model.startsWith("${") && model.endsWith("}")) {
        const path = model.slice(2, -1).split(".");
        let value: any = config;

        for (const key of path) {
          value = value[key];
          if (value === undefined) {
            throw new Error(`Variable not found: ${model}`);
          }
        }

        model = value;
      }

      steps[stepName] = {
        name: stepName,
        provider: provider,
        model: model,
        description: (stepConfig as any).description,
        systemPrompt: (stepConfig as any).system_prompt,
        useAssistant: (stepConfig as any).use_assistant || false,
        assistantInstructions: (stepConfig as any).assistant_instructions,
        tools: (stepConfig as any).tools || [],
      };
    }

    flows[name] = {
      name,
      description: (flowConfig as any).description,
      steps,
      transitions: (flowConfig as any).transitions || {},
    };
  }

  return {
    name: config.agent.name,
    description: config.agent.description,
    defaultFlow: config.agent.default_flow,
    providers,
    flows,
  };
}
