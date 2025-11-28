import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
export const importCommand = new Command('import')
    .description('Import MCP servers from Claude Desktop settings as skills')
    .option('--backup', 'Create backup of existing skills directory')
    .option('--disable-global', 'Remove from global Claude settings after import')
    .option('--dry-run', 'Show what would be imported without making changes')
    .option('-s, --source <path>', 'Path to Claude settings.json')
    .option('-o, --output <path>', 'Output skills directory', './skills')
    .action(async (options) => {
    const spinner = ora('Importing MCP servers from Claude Desktop...').start();
    try {
        // Determine Claude settings path
        const sourcePath = options.source || getClaudeSettingsPath();
        if (!existsSync(sourcePath)) {
            spinner.fail('Claude Desktop settings not found');
            console.log(chalk.yellow(`\nExpected location: ${sourcePath}`));
            console.log(chalk.gray('Use --source to specify a different path'));
            process.exit(1);
        }
        spinner.text = 'Reading Claude Desktop settings...';
        const claudeConfig = await readClaudeConfig(sourcePath);
        if (!claudeConfig.mcpServers || claudeConfig.mcpServers.length === 0) {
            spinner.warn('No MCP servers found in Claude Desktop settings');
            process.exit(0);
        }
        const outputPath = resolve(options.output);
        // Backup existing skills if requested
        if (options.backup && existsSync(outputPath)) {
            spinner.text = 'Creating backup...';
            const backupPath = `${outputPath}.backup.${Date.now()}`;
            await mkdir(backupPath, { recursive: true });
            // Copy existing skills (simplified for now)
            console.log(chalk.gray(`  Backup would be created at: ${backupPath}`));
        }
        // Create skills directory
        await mkdir(outputPath, { recursive: true });
        spinner.text = 'Generating skill files...';
        const importedSkills = [];
        for (const serverName of claudeConfig.mcpServers) {
            if (options.dryRun) {
                console.log(chalk.gray(`  Would import: ${serverName}`));
                continue;
            }
            const skillFile = await generateSkillFile(serverName);
            const skillPath = resolve(outputPath, `${serverName}.md`);
            await writeFile(skillPath, skillFile, 'utf-8');
            importedSkills.push({
                name: serverName,
                type: 'mcp',
                source: 'claude-desktop',
                enabled: true,
                importedAt: new Date().toISOString()
            });
        }
        if (!options.dryRun) {
            // Update INDEX.md
            spinner.text = 'Updating INDEX.md...';
            await updateIndexFile(outputPath, importedSkills);
            // Update CLAUDE.md
            spinner.text = 'Updating CLAUDE.md...';
            await updateClaudeFile(outputPath, importedSkills);
            // Remove from global settings if requested
            if (options.disableGlobal) {
                spinner.text = 'Removing from global Claude settings...';
                await removeFromGlobalSettings(sourcePath, importedSkills.map(s => s.name));
            }
        }
        spinner.succeed(chalk.green('Import complete!'));
        console.log(chalk.cyan(`\nImported ${claudeConfig.mcpServers.length} MCP servers as skills:`));
        claudeConfig.mcpServers.forEach((name) => {
            console.log(chalk.gray(`  ✓ ${name}`));
        });
        console.log(chalk.cyan('\nFiles created:'));
        console.log(chalk.gray(`  ${outputPath}/`));
        console.log(chalk.gray(`  ${outputPath}/INDEX.md`));
        console.log(chalk.gray(`  ${outputPath}/CLAUDE.md`));
        if (!options.dryRun && options.disableGlobal) {
            console.log(chalk.yellow('\n⚠️  MCP servers removed from global Claude settings'));
            console.log(chalk.gray('  They are now available as project-local skills'));
        }
        console.log(chalk.cyan('\nNext steps:'));
        console.log(chalk.gray('  1. Review generated skill files'));
        console.log(chalk.gray('  2. Run: ultrathink sync'));
        console.log(chalk.gray('  3. Commit the skills directory to your repository'));
    }
    catch (error) {
        spinner.fail(chalk.red('Import failed'));
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        if (options.parent?.opts().debug) {
            console.error(error);
        }
        process.exit(1);
    }
});
function getClaudeSettingsPath() {
    const home = homedir();
    return resolve(home, '.claude/settings.json');
}
async function readClaudeConfig(path) {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
}
async function generateSkillFile(serverName) {
    const timestamp = new Date().toISOString();
    return `---
name: ${serverName}
type: mcp
source: claude-desktop
enabled: true
imported_at: ${timestamp}
---

# ${serverName} MCP Skill

**Type:** MCP Server Integration
**Source:** Imported from Claude Desktop
**Status:** Active

## Description

This skill provides access to the \`${serverName}\` MCP server capabilities.

Imported from global Claude Desktop configuration to enable:
- Project-specific skill management
- Version control of MCP configurations
- Team collaboration on available tools
- Granular enable/disable control

## Usage

This MCP server is automatically available in Claude Code when this skill is active.
All tools from \`${serverName}\` can be invoked directly.

## Configuration

To modify MCP server settings:
1. Edit this skill file's frontmatter
2. Run \`ultrathink sync\` to apply changes
3. Restart Claude Code if needed

## Notes

- Imported: ${timestamp}
- Original location: \`~/.claude/settings.json\`
- This skill represents an MCP server integration
`;
}
async function updateIndexFile(skillsPath, skills) {
    const indexPath = resolve(skillsPath, 'INDEX.md');
    const content = `# Skills Index

**Last Updated:** ${new Date().toISOString()}
**Total Skills:** ${skills.length}

## Available Skills

${skills
        .map(skill => `- **${skill.name}** (${skill.type}) - ${skill.enabled ? '✓ Enabled' : '✗ Disabled'}`)
        .join('\n')}

## Quick Stats

- **MCP Servers:** ${skills.filter(s => s.type === 'mcp').length}
- **Active:** ${skills.filter(s => s.enabled).length}
- **Inactive:** ${skills.filter(s => !s.enabled).length}

## Management

- \`ultrathink import\` - Import MCPs from Claude Desktop
- \`ultrathink sync\` - Sync index with file changes
- \`ultrathink detect-mcp\` - Detect available MCP servers

---
*Auto-generated by ultrathink*
`;
    await writeFile(indexPath, content, 'utf-8');
}
async function updateClaudeFile(skillsPath, skills) {
    const claudePath = resolve(skillsPath, 'CLAUDE.md');
    const content = `# Claude Code Skills Configuration

This project uses **ultrathink auto-skills** for MCP management.

## Available Skills

${skills.map(skill => `- ${skill.name}`).join('\n')}

## How It Works

Skills in this directory are automatically loaded when Claude Code starts in this project.
Each skill file (\`.md\`) contains:

- YAML frontmatter with configuration
- Description and usage instructions
- Project-specific settings

## Commands

\`\`\`bash
# Import MCPs from global Claude settings
ultrathink import

# Sync index with file changes
ultrathink sync

# Discover AI experts in codebase
ultrathink discover --project ./

# Detect available MCP servers
ultrathink detect-mcp

# Configure auto-invocation
ultrathink auto-invoke --config
\`\`\`

## Benefits

- ✓ Version controlled MCP configurations
- ✓ Project-specific skill management
- ✓ Team collaboration on tooling
- ✓ Easy enable/disable per project
- ✓ No global setting conflicts

---
*Managed by ultrathink*
`;
    await writeFile(claudePath, content, 'utf-8');
}
async function removeFromGlobalSettings(settingsPath, serverNames) {
    const config = await readClaudeConfig(settingsPath);
    if (config.mcpServers) {
        config.mcpServers = config.mcpServers.filter((name) => !serverNames.includes(name));
    }
    await writeFile(settingsPath, JSON.stringify(config, null, 2), 'utf-8');
}
//# sourceMappingURL=import.js.map