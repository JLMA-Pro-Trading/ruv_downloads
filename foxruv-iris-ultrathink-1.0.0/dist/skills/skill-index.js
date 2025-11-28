/**
 * INDEX.md generation and synchronization
 *
 * Manages the master index of all skill files with:
 * - Category grouping
 * - Automatic discovery
 * - Frontmatter parsing
 */
import { promises as fs } from 'fs';
import path from 'path';
/**
 * Generate INDEX.md template
 */
export function generateIndexMd() {
    const today = new Date().toISOString().split('T')[0];
    return `# MCP Skill Directory

All MCPs for this project are **on-demand skills**, invoked via \`npx claude-flow mcp ...\`.

## How to Use

1. **Find a skill**: Browse this index or search \`mcp-skills/*.md\`
2. **Read the docs**: Open the skill file to see available tools and examples
3. **Propose command**: Let Claude suggest the exact CLI invocation
4. **Execute**: Run the command and track results in AgentDB

## Skills

<!-- SKILLS_LIST_START -->
*No skills yet. Run \`npm run ultrathink:skills:import\` to populate.*
<!-- SKILLS_LIST_END -->

## Adding New Skills

### From Global MCPs

\`\`\`bash
npm run ultrathink:skills:import
\`\`\`

### Manually

1. Copy \`_template.md\` to \`<skill-id>.md\`
2. Fill in skill details, tools, and examples
3. Run \`npm run ultrathink:skills:sync\` to update this file

## Skill File Format

Each skill includes:

- **Frontmatter**: \`skill_id\`, \`mcp_server\`, \`category\`, \`tags\`, \`agent_db_tracking\`
- **Purpose**: What this skill does
- **Tools**: Available MCP tools with usage examples
- **Examples**: Copy-paste ready command-line examples
- **Integration**: How it connects to AgentDB, Iris, etc.

See \`_template.md\` for a complete template.

## Categories

Skills are organized by category:

- **Development**: GitHub, GitLab, CI/CD
- **Data**: Databases, APIs, data processing
- **Communication**: Slack, email, notifications
- **Infrastructure**: AWS, Docker, Kubernetes
- **Payments**: Stripe, billing, subscriptions
- **Custom**: Project-specific integrations

## References

- [Ultrathink Documentation](../packages/ultrathink/README.md)
- [CLAUDE.md](../CLAUDE.md) - AI operating instructions

---

**Last Updated:** ${today}
`;
}
/**
 * Parse frontmatter from skill markdown file
 *
 * @param content - Markdown file content
 * @returns Parsed frontmatter object
 */
export function parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (!match)
        return {};
    const frontmatter = {};
    const lines = match[1].split('\n');
    for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (!key || valueParts.length === 0)
            continue;
        const value = valueParts.join(':').trim();
        const normalizedKey = key.trim();
        // Parse different value types
        if (value === 'true') {
            frontmatter[normalizedKey] = true;
        }
        else if (value === 'false') {
            frontmatter[normalizedKey] = false;
        }
        else if (value.startsWith('[') && value.endsWith(']')) {
            try {
                frontmatter[normalizedKey] = JSON.parse(value);
            }
            catch {
                frontmatter[normalizedKey] = value;
            }
        }
        else {
            frontmatter[normalizedKey] = value;
        }
    }
    return frontmatter;
}
/**
 * Group skills by category
 *
 * @param skillsDir - Path to mcp-skills directory
 * @param skillIds - List of skill IDs
 * @returns Skills organized by category
 */
export async function groupSkillsByCategory(skillsDir, skillIds) {
    const skillsByCategory = {};
    for (const skillId of skillIds) {
        const skillPath = path.join(skillsDir, `${skillId}.md`);
        try {
            const content = await fs.readFile(skillPath, 'utf8');
            const frontmatter = parseFrontmatter(content);
            const category = frontmatter.category || 'uncategorized';
            if (!skillsByCategory[category]) {
                skillsByCategory[category] = [];
            }
            skillsByCategory[category].push(skillId);
        }
        catch {
            // If we can't read the file, add to uncategorized
            if (!skillsByCategory.uncategorized) {
                skillsByCategory.uncategorized = [];
            }
            skillsByCategory.uncategorized.push(skillId);
        }
    }
    return skillsByCategory;
}
/**
 * Generate skills list markdown from grouped skills
 *
 * @param skillsByCategory - Skills organized by category
 * @returns Formatted markdown list
 */
export function generateSkillsList(skillsByCategory) {
    if (Object.keys(skillsByCategory).length === 0) {
        return '*No skills yet. Run `npm run ultrathink:skills:import` to populate.*';
    }
    let skillsList = '';
    for (const [category, skills] of Object.entries(skillsByCategory).sort()) {
        skillsList += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
        for (const skillId of skills.sort()) {
            skillsList += `- [\`${skillId}\`](./${skillId}.md)\n`;
        }
        skillsList += '\n';
    }
    return skillsList;
}
/**
 * Update INDEX.md with current skill list
 *
 * @param indexPath - Path to INDEX.md
 * @param skillIds - List of skill IDs to include
 */
export async function updateIndexMd(indexPath, skillIds) {
    let content;
    try {
        content = await fs.readFile(indexPath, 'utf8');
    }
    catch {
        // If INDEX.md doesn't exist, create it
        content = generateIndexMd();
    }
    // Group skills by category
    const skillsDir = path.dirname(indexPath);
    const skillsByCategory = await groupSkillsByCategory(skillsDir, skillIds);
    // Generate skills list
    const skillsList = generateSkillsList(skillsByCategory);
    // Replace skills list section
    const updated = content.replace(/<!-- SKILLS_LIST_START -->[\s\S]*?<!-- SKILLS_LIST_END -->/, `<!-- SKILLS_LIST_START -->\n${skillsList}<!-- SKILLS_LIST_END -->`);
    await fs.writeFile(indexPath, updated, 'utf8');
}
/**
 * Discover all skill files in directory
 *
 * @param skillsDir - Path to mcp-skills directory
 * @returns Array of skill IDs
 */
export async function discoverSkills(skillsDir) {
    try {
        const files = await fs.readdir(skillsDir);
        return files
            .filter(f => f.endsWith('.md') &&
            f !== 'INDEX.md' &&
            !f.startsWith('_'))
            .map(f => path.basename(f, '.md'));
    }
    catch {
        return [];
    }
}
/**
 * Update CLAUDE.md MCP skills section
 *
 * @param claudePath - Path to CLAUDE.md
 * @param skillIds - List of skill IDs
 */
export async function updateClaudeMdMcpSection(claudePath, skillIds) {
    const content = await fs.readFile(claudePath, 'utf8');
    const skillsList = skillIds.length > 0
        ? skillIds.map(id => `- [\`${id}\`](mcp-skills/${id}.md)`).join('\n')
        : '*No skills imported yet. Run `npm run ultrathink:skills:import` to populate this section.*';
    const updated = content.replace(/<!-- MCP_SKILLS_SECTION_START -->[\s\S]*?<!-- MCP_SKILLS_SECTION_END -->/, `<!-- MCP_SKILLS_SECTION_START -->\n${skillsList}\n<!-- MCP_SKILLS_SECTION_END -->`);
    await fs.writeFile(claudePath, updated, 'utf8');
}
//# sourceMappingURL=skill-index.js.map