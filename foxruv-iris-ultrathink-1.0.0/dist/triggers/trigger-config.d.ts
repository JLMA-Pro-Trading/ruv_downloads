/**
 * Trigger Configuration Management
 *
 * Handles loading, saving, and validating trigger configurations.
 * Supports custom configs per project/context.
 */
import type { TriggerConfig } from './types.js';
import { DEFAULT_CONFIGS } from './types.js';
export declare class TriggerConfigManager {
    private readonly configBasePath;
    private configCache;
    constructor(configBasePath: string);
    /**
     * Get configuration for a context (with caching)
     */
    getConfig(context: string, preset?: keyof typeof DEFAULT_CONFIGS): TriggerConfig;
    /**
     * Save configuration for a context
     */
    saveConfig(context: string, config: TriggerConfig): void;
    /**
     * Update specific thresholds
     */
    updateThresholds(context: string, thresholds: Partial<Record<string, number>>): TriggerConfig;
    /**
     * Update time windows
     */
    updateTimeWindows(context: string, timeWindow?: number, cooldownPeriod?: number): TriggerConfig;
    /**
     * Add critical events
     */
    addCriticalEvents(context: string, events: string[]): TriggerConfig;
    /**
     * Remove critical events
     */
    removeCriticalEvents(context: string, events: string[]): TriggerConfig;
    /**
     * Reset to preset configuration
     */
    resetToPreset(context: string, preset: keyof typeof DEFAULT_CONFIGS): TriggerConfig;
    /**
     * List all configured contexts
     */
    listContexts(): string[];
    /**
     * Delete configuration for a context
     */
    deleteConfig(context: string): void;
    /**
     * Export configuration to JSON
     */
    exportConfig(context: string): string;
    /**
     * Import configuration from JSON
     */
    importConfig(context: string, json: string): TriggerConfig;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get configuration file path
     */
    private getConfigPath;
    /**
     * Validate configuration
     */
    private validateConfig;
    /**
     * Ensure directory exists
     */
    private ensureDir;
}
/**
 * Helper function to merge configs
 */
export declare function mergeConfigs(base: TriggerConfig, override: Partial<TriggerConfig>): TriggerConfig;
//# sourceMappingURL=trigger-config.d.ts.map