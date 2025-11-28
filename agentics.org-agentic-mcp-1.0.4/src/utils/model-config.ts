/**
 * Utility functions for handling model-specific configurations
 */

/**
 * Creates a model configuration with appropriate parameters based on the model type.
 * Some models like o3-mini and gpt-4o-search-preview don't support temperature,
 * so this function removes that parameter when needed.
 * 
 * @param baseConfig The base configuration object
 * @returns A model-specific configuration with appropriate parameters
 */
export function getModelConfig(baseConfig: {
  model: string;
  messages: any[];
  temperature?: number;
  max_tokens?: number;
  web_search_options?: any;
  [key: string]: any; // Allow for other parameters
}) {
  const config = { ...baseConfig };
  
  // Models that don't support temperature
  const noTempModels = ['o3-mini', 'gpt-4o-search-preview'];
  
  if (noTempModels.includes(config.model)) {
    delete config.temperature;
  }
  
  return config;
}
