/**
 * INDEX.md generation and synchronization
 *
 * Manages the master index of all skill files with:
 * - Category grouping
 * - Automatic discovery
 * - Frontmatter parsing
 */
import type { SkillsByCategory, SkillMetadata } from './types.js';
/**
 * Generate INDEX.md template
 */
export declare function generateIndexMd(): string;
/**
 * Parse frontmatter from skill markdown file
 *
 * @param content - Markdown file content
 * @returns Parsed frontmatter object
 */
export declare function parseFrontmatter(content: string): Partial<SkillMetadata>;
/**
 * Group skills by category
 *
 * @param skillsDir - Path to mcp-skills directory
 * @param skillIds - List of skill IDs
 * @returns Skills organized by category
 */
export declare function groupSkillsByCategory(skillsDir: string, skillIds: string[]): Promise<SkillsByCategory>;
/**
 * Generate skills list markdown from grouped skills
 *
 * @param skillsByCategory - Skills organized by category
 * @returns Formatted markdown list
 */
export declare function generateSkillsList(skillsByCategory: SkillsByCategory): string;
/**
 * Update INDEX.md with current skill list
 *
 * @param indexPath - Path to INDEX.md
 * @param skillIds - List of skill IDs to include
 */
export declare function updateIndexMd(indexPath: string, skillIds: string[]): Promise<void>;
/**
 * Discover all skill files in directory
 *
 * @param skillsDir - Path to mcp-skills directory
 * @returns Array of skill IDs
 */
export declare function discoverSkills(skillsDir: string): Promise<string[]>;
/**
 * Update CLAUDE.md MCP skills section
 *
 * @param claudePath - Path to CLAUDE.md
 * @param skillIds - List of skill IDs
 */
export declare function updateClaudeMdMcpSection(claudePath: string, skillIds: string[]): Promise<void>;
//# sourceMappingURL=skill-index.d.ts.map