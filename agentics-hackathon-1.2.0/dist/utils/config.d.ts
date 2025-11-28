/**
 * Configuration management utilities
 */
import type { HackathonConfig } from '../types.js';
export declare function getConfigPath(dir?: string): string;
export declare function configExists(dir?: string): boolean;
export declare function loadConfig(dir?: string): HackathonConfig | null;
export declare function saveConfig(config: HackathonConfig, dir?: string): void;
export declare function createDefaultConfig(projectName: string): HackathonConfig;
export declare function updateConfig(updates: Partial<HackathonConfig>, dir?: string): HackathonConfig;
//# sourceMappingURL=config.d.ts.map