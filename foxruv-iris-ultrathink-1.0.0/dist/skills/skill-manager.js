/**
 * Skill management utilities
 *
 * High-level operations for:
 * - Importing MCPs from Claude settings
 * - Syncing skill index
 * - Initializing skill infrastructure
 */
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { generateSkillFromMcp, sanitizeSkillId } from './skill-generator.js';
import { updateIndexMd, updateClaudeMdMcpSection, discoverSkills } from './skill-index.js';
import { generateTemplateMd, generateMcpManagerMd, generateClaudeMd } from './skill-template.js';
/**
 * Import MCPs from Claude global settings as skills
 *
 * @param options - Import configuration options
 * @returns Array of imported skill IDs
 */
export async function importMcpsFromSettings(options = {}) {
    const { backup = true, disableGlobal = false, dryRun = false, projectRoot = process.cwd() } = options;
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    // 1. Read Claude settings
    let settings;
    try {
        const content = await fs.readFile(settingsPath, 'utf8');
        settings = JSON.parse(content);
        if (!settings.mcpServers || Object.keys(settings.mcpServers).length === 0) {
            throw new Error('No MCPs found in Claude settings');
        }
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error('~/.claude/settings.json not found');
        }
        throw error;
    }
    if (dryRun) {
        // Return what would be imported
        return Object.keys(settings.mcpServers).map(sanitizeSkillId);
    }
    // 2. Backup settings if requested
    if (backup) {
        const backupPath = `${settingsPath}.backup.${Date.now()}`;
        await fs.copyFile(settingsPath, backupPath);
    }
    // 3. Create mcp-skills directory
    const skillsDir = path.join(projectRoot, 'mcp-skills');
    await fs.mkdir(skillsDir, { recursive: true });
    // 4. Import each MCP as a skill
    const importedSkills = [];
    for (const [serverId, config] of Object.entries(settings.mcpServers)) {
        const skillId = sanitizeSkillId(serverId);
        const skillPath = path.join(skillsDir, `${skillId}.md`);
        try {
            const skillContent = generateSkillFromMcp({
                skillId,
                serverId,
                command: config.command,
                args: config.args,
                env: config.env
            });
            await fs.writeFile(skillPath, skillContent, 'utf8');
            importedSkills.push(skillId);
        }
        catch (error) {
            console.error(`Failed to import ${serverId}:`, error);
        }
    }
    // 5. Create template files if they don't exist
    const templatePath = path.join(skillsDir, '_template.md');
    try {
        await fs.access(templatePath);
    }
    catch {
        await fs.writeFile(templatePath, generateTemplateMd(), 'utf8');
    }
    const managerPath = path.join(skillsDir, 'mcp-manager.md');
    try {
        await fs.access(managerPath);
    }
    catch {
        await fs.writeFile(managerPath, generateMcpManagerMd(), 'utf8');
    }
    // 6. Update INDEX.md
    const indexPath = path.join(skillsDir, 'INDEX.md');
    await updateIndexMd(indexPath, importedSkills);
    // 7. Update CLAUDE.md
    const claudePath = path.join(projectRoot, 'CLAUDE.md');
    try {
        await fs.access(claudePath);
        await updateClaudeMdMcpSection(claudePath, importedSkills);
    }
    catch {
        // If CLAUDE.md doesn't exist, create it
        await fs.writeFile(claudePath, generateClaudeMd(), 'utf8');
        await updateClaudeMdMcpSection(claudePath, importedSkills);
    }
    // 8. Disable global MCPs if requested
    if (disableGlobal) {
        delete settings.mcpServers;
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
    return importedSkills;
}
/**
 * Synchronize skill index with current files
 *
 * @param options - Sync configuration options
 */
export async function syncSkillIndex(options = {}) {
    const { projectRoot = process.cwd() } = options;
    const skillsDir = path.join(projectRoot, 'mcp-skills');
    // Check if skills directory exists
    try {
        await fs.access(skillsDir);
    }
    catch {
        throw new Error('mcp-skills/ directory not found. Run initialization first.');
    }
    // Discover all skill files
    const skillIds = await discoverSkills(skillsDir);
    // Update INDEX.md
    const indexPath = path.join(skillsDir, 'INDEX.md');
    await updateIndexMd(indexPath, skillIds);
    // Update CLAUDE.md if it exists
    const claudePath = path.join(projectRoot, 'CLAUDE.md');
    try {
        await fs.access(claudePath);
        await updateClaudeMdMcpSection(claudePath, skillIds);
    }
    catch {
        // CLAUDE.md doesn't exist, skip
    }
}
/**
 * Initialize skill infrastructure in a project
 *
 * @param projectRoot - Root directory of the project
 */
export async function initializeSkillInfrastructure(projectRoot = process.cwd()) {
    const skillsDir = path.join(projectRoot, 'mcp-skills');
    // 1. Create mcp-skills directory
    await fs.mkdir(skillsDir, { recursive: true });
    // 2. Create _template.md
    const templatePath = path.join(skillsDir, '_template.md');
    await fs.writeFile(templatePath, generateTemplateMd(), 'utf8');
    // 3. Create mcp-manager.md
    const managerPath = path.join(skillsDir, 'mcp-manager.md');
    await fs.writeFile(managerPath, generateMcpManagerMd(), 'utf8');
    // 4. Create INDEX.md
    const indexPath = path.join(skillsDir, 'INDEX.md');
    await updateIndexMd(indexPath, []);
    // 5. Create or update CLAUDE.md
    const claudePath = path.join(projectRoot, 'CLAUDE.md');
    try {
        await fs.access(claudePath);
        // Merge with existing CLAUDE.md
        const existing = await fs.readFile(claudePath, 'utf8');
        if (!existing.includes('MCP_SKILLS_SECTION_START')) {
            const updated = existing.trimEnd() + '\n\n' + generateClaudeMd();
            await fs.writeFile(claudePath, updated, 'utf8');
        }
    }
    catch {
        // Create new CLAUDE.md
        await fs.writeFile(claudePath, generateClaudeMd(), 'utf8');
    }
}
/**
 * Get skill metadata from file
 *
 * @param skillPath - Path to skill markdown file
 * @returns Skill metadata or null if invalid
 */
export async function getSkillMetadata(skillPath) {
    try {
        const content = await fs.readFile(skillPath, 'utf8');
        const match = content.match(/^---\n([\s\S]+?)\n---/);
        if (!match)
            return null;
        const metadata = {};
        const lines = match[1].split('\n');
        for (const line of lines) {
            const [key, ...valueParts] = line.split(':');
            if (!key || valueParts.length === 0)
                continue;
            const value = valueParts.join(':').trim();
            metadata[key.trim()] = value;
        }
        return metadata;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=skill-manager.js.map