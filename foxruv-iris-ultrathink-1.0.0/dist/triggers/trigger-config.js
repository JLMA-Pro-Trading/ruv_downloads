/**
 * Trigger Configuration Management
 *
 * Handles loading, saving, and validating trigger configurations.
 * Supports custom configs per project/context.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONFIGS } from './types.js';
export class TriggerConfigManager {
    configBasePath;
    configCache = new Map();
    constructor(configBasePath) {
        this.configBasePath = configBasePath;
        this.ensureDir(configBasePath);
    }
    /**
     * Get configuration for a context (with caching)
     */
    getConfig(context, preset) {
        // Check cache first
        if (this.configCache.has(context)) {
            return this.configCache.get(context);
        }
        // Try to load from file
        const configPath = this.getConfigPath(context);
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                this.validateConfig(config);
                this.configCache.set(context, config);
                return config;
            }
            catch (error) {
                console.warn(`Failed to load config for ${context}, using preset: ${error}`);
            }
        }
        // Use preset or default - cast to mutable TriggerConfig
        const presetConfig = preset ? DEFAULT_CONFIGS[preset] : DEFAULT_CONFIGS.development;
        const mutableConfig = {
            eventThresholds: { ...presetConfig.eventThresholds },
            timeWindow: presetConfig.timeWindow,
            cooldownPeriod: presetConfig.cooldownPeriod,
            criticalEvents: [...presetConfig.criticalEvents]
        };
        this.configCache.set(context, mutableConfig);
        return mutableConfig;
    }
    /**
     * Save configuration for a context
     */
    saveConfig(context, config) {
        this.validateConfig(config);
        const configPath = this.getConfigPath(context);
        this.ensureDir(path.dirname(configPath));
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        this.configCache.set(context, config);
    }
    /**
     * Update specific thresholds
     */
    updateThresholds(context, thresholds) {
        const config = this.getConfig(context);
        const updated = {
            ...config,
            eventThresholds: {
                ...config.eventThresholds,
                ...thresholds
            }
        };
        this.saveConfig(context, updated);
        return updated;
    }
    /**
     * Update time windows
     */
    updateTimeWindows(context, timeWindow, cooldownPeriod) {
        const config = this.getConfig(context);
        const updated = {
            ...config,
            ...(timeWindow !== undefined && { timeWindow }),
            ...(cooldownPeriod !== undefined && { cooldownPeriod })
        };
        this.saveConfig(context, updated);
        return updated;
    }
    /**
     * Add critical events
     */
    addCriticalEvents(context, events) {
        const config = this.getConfig(context);
        const updated = {
            ...config,
            criticalEvents: Array.from(new Set([...config.criticalEvents, ...events]))
        };
        this.saveConfig(context, updated);
        return updated;
    }
    /**
     * Remove critical events
     */
    removeCriticalEvents(context, events) {
        const config = this.getConfig(context);
        const updated = {
            ...config,
            criticalEvents: config.criticalEvents.filter(e => !events.includes(e))
        };
        this.saveConfig(context, updated);
        return updated;
    }
    /**
     * Reset to preset configuration
     */
    resetToPreset(context, preset) {
        const presetConfig = DEFAULT_CONFIGS[preset];
        const config = {
            eventThresholds: { ...presetConfig.eventThresholds },
            timeWindow: presetConfig.timeWindow,
            cooldownPeriod: presetConfig.cooldownPeriod,
            criticalEvents: [...presetConfig.criticalEvents]
        };
        this.saveConfig(context, config);
        return config;
    }
    /**
     * List all configured contexts
     */
    listContexts() {
        if (!fs.existsSync(this.configBasePath)) {
            return [];
        }
        return fs
            .readdirSync(this.configBasePath)
            .filter(file => file.endsWith('.json'))
            .map(file => path.basename(file, '.json'));
    }
    /**
     * Delete configuration for a context
     */
    deleteConfig(context) {
        const configPath = this.getConfigPath(context);
        if (fs.existsSync(configPath)) {
            fs.unlinkSync(configPath);
        }
        this.configCache.delete(context);
    }
    /**
     * Export configuration to JSON
     */
    exportConfig(context) {
        const config = this.getConfig(context);
        return JSON.stringify(config, null, 2);
    }
    /**
     * Import configuration from JSON
     */
    importConfig(context, json) {
        const config = JSON.parse(json);
        this.validateConfig(config);
        this.saveConfig(context, config);
        return config;
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.configCache.clear();
    }
    /**
     * Get configuration file path
     */
    getConfigPath(context) {
        // Sanitize context name for filesystem
        const sanitized = context.replace(/[^a-zA-Z0-9-_]/g, '_');
        return path.join(this.configBasePath, `${sanitized}.json`);
    }
    /**
     * Validate configuration
     */
    validateConfig(config) {
        if (!config.eventThresholds || typeof config.eventThresholds !== 'object') {
            throw new Error('Config must have eventThresholds object');
        }
        if (typeof config.timeWindow !== 'number' || config.timeWindow <= 0) {
            throw new Error('Config must have positive timeWindow');
        }
        if (typeof config.cooldownPeriod !== 'number' || config.cooldownPeriod < 0) {
            throw new Error('Config must have non-negative cooldownPeriod');
        }
        if (!Array.isArray(config.criticalEvents)) {
            throw new Error('Config must have criticalEvents array');
        }
        // Validate thresholds
        for (const [event, threshold] of Object.entries(config.eventThresholds)) {
            if (typeof threshold !== 'number' || threshold < 0) {
                throw new Error(`Invalid threshold for event ${event}: must be non-negative number`);
            }
        }
        // Validate critical events
        for (const event of config.criticalEvents) {
            if (typeof event !== 'string') {
                throw new Error('All critical events must be strings');
            }
        }
    }
    /**
     * Ensure directory exists
     */
    ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}
/**
 * Helper function to merge configs
 */
export function mergeConfigs(base, override) {
    return {
        eventThresholds: {
            ...base.eventThresholds,
            ...(override.eventThresholds || {})
        },
        timeWindow: override.timeWindow ?? base.timeWindow,
        cooldownPeriod: override.cooldownPeriod ?? base.cooldownPeriod,
        criticalEvents: override.criticalEvents
            ? Array.from(new Set([...base.criticalEvents, ...override.criticalEvents]))
            : base.criticalEvents,
        customThresholdFn: override.customThresholdFn ?? base.customThresholdFn
    };
}
//# sourceMappingURL=trigger-config.js.map