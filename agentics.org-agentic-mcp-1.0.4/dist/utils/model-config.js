"use strict";
/**
 * Utility functions for handling model-specific configurations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModelConfig = getModelConfig;
/**
 * Creates a model configuration with appropriate parameters based on the model type.
 * Some models like o3-mini and gpt-4o-search-preview don't support temperature,
 * so this function removes that parameter when needed.
 *
 * @param baseConfig The base configuration object
 * @returns A model-specific configuration with appropriate parameters
 */
function getModelConfig(baseConfig) {
    const config = { ...baseConfig };
    // Models that don't support temperature
    const noTempModels = ['o3-mini', 'gpt-4o-search-preview'];
    if (noTempModels.includes(config.model)) {
        delete config.temperature;
    }
    return config;
}
//# sourceMappingURL=model-config.js.map