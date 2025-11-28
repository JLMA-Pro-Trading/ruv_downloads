/**
 * Generate skill file from MCP server configuration
 *
 * This module converts MCP server configs from Claude settings
 * into standalone markdown skill files with:
 * - YAML frontmatter
 * - Tool documentation templates
 * - Usage examples
 * - AgentDB integration markers
 */
import type { SkillGeneratorConfig, SkillGenerationResult } from './types.js';
/**
 * Generate markdown skill content from MCP configuration
 *
 * @param config - MCP server configuration to convert
 * @returns Formatted markdown skill content
 */
export declare function generateSkillFromMcp(config: SkillGeneratorConfig): string;
/**
 * Generate a skill with error handling
 *
 * @param config - Skill generation configuration
 * @returns Result with success/error status
 */
export declare function generateSkillSafely(config: SkillGeneratorConfig): SkillGenerationResult;
/**
 * Sanitize server ID to valid skill ID format
 *
 * @param serverId - Original server ID
 * @returns Sanitized skill ID (lowercase, alphanumeric + hyphens only)
 */
export declare function sanitizeSkillId(serverId: string): string;
//# sourceMappingURL=skill-generator.d.ts.map