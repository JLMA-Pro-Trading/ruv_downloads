/**
 * Configuration Loader
 *
 * Handles loading and parsing of the Iris configuration file (iris-config.yaml).
 *
 * @module config/config-loader
 */
import fs from 'fs/promises';
import yaml from 'js-yaml';
const DEFAULT_CONFIG_PATHS = [
    'iris-config.yaml',
    'iris-config.yml',
    '.iris/config.yaml',
    '.iris/config.yml',
    'config/iris-config.yaml'
];
/**
 * Load Iris configuration from file
 *
 * @param configPath - Optional specific path to config file
 * @returns Parsed configuration or default empty config
 */
export async function loadIrisConfig(configPath) {
    let loadedPath = null;
    if (configPath) {
        if (await fileExists(configPath)) {
            loadedPath = configPath;
        }
        else {
            throw new Error(`Configuration file not found at: ${configPath}`);
        }
    }
    else {
        // Search default paths
        for (const p of DEFAULT_CONFIG_PATHS) {
            if (await fileExists(p)) {
                loadedPath = p;
                break;
            }
        }
    }
    if (!loadedPath) {
        // Return default config if no file found
        return {
            optimization: {
                strategy: ['grid']
            },
            storage: {
                backend: ['agentdb']
            }
        };
    }
    console.log(`📄 Loading config from: ${loadedPath}`);
    try {
        const content = await fs.readFile(loadedPath, 'utf-8');
        const config = yaml.load(content);
        return validateAndNormalize(config);
    }
    catch (error) {
        throw new Error(`Failed to parse configuration file: ${error instanceof Error ? error.message : String(error)}`);
    }
}
async function fileExists(path) {
    try {
        await fs.access(path);
        return true;
    }
    catch {
        return false;
    }
}
function validateAndNormalize(config) {
    // Ensure essential objects exist
    if (!config.optimization)
        config.optimization = {};
    if (!config.storage)
        config.storage = {};
    // Set defaults
    if (!config.optimization.strategy) {
        config.optimization.strategy = ['grid'];
    }
    // Normalize search space if present
    if (config.optimization.searchSpace && !config.optimization.searchSpace.parameters) {
        config.optimization.searchSpace.parameters = [];
    }
    return config;
}
