/**
 * Type definitions for MCP-to-skill conversion system
 */
/**
 * MCP server configuration from Claude settings
 */
export interface McpServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
}
/**
 * Claude settings structure
 */
export interface ClaudeSettings {
    mcpServers?: Record<string, McpServerConfig>;
    [key: string]: unknown;
}
/**
 * Configuration for generating a skill from MCP
 */
export interface SkillGeneratorConfig {
    skillId: string;
    serverId: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
    category?: string;
    tags?: string[];
}
/**
 * Skill frontmatter parsed from markdown
 */
export interface SkillFrontmatter {
    skill_id: string;
    mcp_server?: string;
    category?: string;
    tags?: string[];
    agent_db_tracking?: boolean;
    imported_from_global?: boolean;
    import_date?: string;
}
/**
 * Skill metadata extracted from file
 */
export interface SkillMetadata extends SkillFrontmatter {
    filePath: string;
    fileName: string;
}
/**
 * Options for MCP import command
 */
export interface McpImportOptions {
    backup?: boolean;
    disableGlobal?: boolean;
    dryRun?: boolean;
    projectRoot?: string;
}
/**
 * Options for skill sync command
 */
export interface SkillSyncOptions {
    projectRoot?: string;
    verbose?: boolean;
}
/**
 * Result of skill generation
 */
export interface SkillGenerationResult {
    skillId: string;
    filePath: string;
    content: string;
    success: boolean;
    error?: string;
}
/**
 * Skills grouped by category
 */
export interface SkillsByCategory {
    [category: string]: string[];
}
//# sourceMappingURL=types.d.ts.map