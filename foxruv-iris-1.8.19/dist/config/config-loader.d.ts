/**
 * Configuration Loader
 *
 * Handles loading and parsing of the Iris configuration file (iris-config.yaml).
 *
 * @module config/config-loader
 */
import type { IrisConfig } from './types.js';
/**
 * Load Iris configuration from file
 *
 * @param configPath - Optional specific path to config file
 * @returns Parsed configuration or default empty config
 */
export declare function loadIrisConfig(configPath?: string): Promise<IrisConfig>;
//# sourceMappingURL=config-loader.d.ts.map