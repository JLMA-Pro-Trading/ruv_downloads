/**
 * Skill management utilities
 *
 * High-level operations for:
 * - Importing MCPs from Claude settings
 * - Syncing skill index
 * - Initializing skill infrastructure
 */
import type { McpImportOptions, SkillSyncOptions } from './types.js';
/**
 * Import MCPs from Claude global settings as skills
 *
 * @param options - Import configuration options
 * @returns Array of imported skill IDs
 */
export declare function importMcpsFromSettings(options?: McpImportOptions): Promise<string[]>;
/**
 * Synchronize skill index with current files
 *
 * @param options - Sync configuration options
 */
export declare function syncSkillIndex(options?: SkillSyncOptions): Promise<void>;
/**
 * Initialize skill infrastructure in a project
 *
 * @param projectRoot - Root directory of the project
 */
export declare function initializeSkillInfrastructure(projectRoot?: string): Promise<void>;
/**
 * Get skill metadata from file
 *
 * @param skillPath - Path to skill markdown file
 * @returns Skill metadata or null if invalid
 */
export declare function getSkillMetadata(skillPath: string): Promise<any | null>;
//# sourceMappingURL=skill-manager.d.ts.map