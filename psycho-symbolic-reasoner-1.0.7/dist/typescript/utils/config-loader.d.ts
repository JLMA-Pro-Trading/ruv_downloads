import { AppConfig, CLIArgs } from '../types/config.js';
/**
 * Configuration loader utility
 */
export declare class ConfigLoader {
    private static readonly DEFAULT_CONFIG_FILES;
    /**
     * Load configuration from file and merge with CLI arguments
     */
    static loadConfig(cliArgs: CLIArgs): Promise<AppConfig>;
    /**
     * Find default configuration file in current directory
     */
    private static findDefaultConfigFile;
    /**
     * Load configuration from a specific file
     */
    private static loadConfigFile;
    /**
     * Merge file configuration with CLI arguments
     */
    private static mergeConfigs;
    /**
     * Generate sample configuration file
     */
    static generateSampleConfig(): string;
    /**
     * Validate configuration object
     */
    static validateConfig(config: unknown): AppConfig;
}
//# sourceMappingURL=config-loader.d.ts.map