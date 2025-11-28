/**
 * Ultrathink Skills - MCP-to-Skill Conversion System
 *
 * A standalone, context-optimized system for converting MCP server
 * configurations into documented, trackable skills.
 *
 * ## Features
 * - Generate markdown skills from MCP configs
 * - Auto-generate tool documentation
 * - Create examples and usage notes
 * - Track imports in INDEX.md
 * - Update CLAUDE.md with MCP references
 * - AgentDB integration markers
 *
 * ## Usage
 *
 * ```typescript
 * import { importMcpsFromSettings, syncSkillIndex } from '@foxruv/iris-ultrathink/skills';
 *
 * // Import MCPs from Claude settings
 * const skills = await importMcpsFromSettings({
 *   projectRoot: '/path/to/project',
 *   backup: true,
 *   disableGlobal: false
 * });
 *
 * // Sync skill index
 * await syncSkillIndex({ projectRoot: '/path/to/project' });
 * ```
 *
 * @module ultrathink/skills
 */
export type { McpServerConfig, ClaudeSettings, SkillGeneratorConfig, SkillFrontmatter, SkillMetadata, McpImportOptions, SkillSyncOptions, SkillGenerationResult, SkillsByCategory } from './types.js';
export { generateSkillFromMcp, generateSkillSafely, sanitizeSkillId } from './skill-generator.js';
export { generateTemplateMd, generateMcpManagerMd, generateClaudeMd } from './skill-template.js';
export { generateIndexMd, parseFrontmatter, groupSkillsByCategory, generateSkillsList, updateIndexMd, discoverSkills, updateClaudeMdMcpSection } from './skill-index.js';
export { importMcpsFromSettings, syncSkillIndex, initializeSkillInfrastructure, getSkillMetadata } from './skill-manager.js';
//# sourceMappingURL=index.d.ts.map