/**
 * Generate skill file from MCP server configuration
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
export declare function generateSkillFromMcp(config: SkillGeneratorConfig): Promise<string>;
//# sourceMappingURL=skill-generator.d.ts.map