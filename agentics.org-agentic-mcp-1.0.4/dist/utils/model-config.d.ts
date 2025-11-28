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
export declare function getModelConfig(baseConfig: {
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    web_search_options?: any;
    [key: string]: any;
}): {
    [key: string]: any;
    model: string;
    messages: any[];
    temperature?: number;
    max_tokens?: number;
    web_search_options?: any;
};
