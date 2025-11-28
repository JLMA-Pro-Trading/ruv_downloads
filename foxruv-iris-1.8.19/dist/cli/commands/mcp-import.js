/**
 * foxruv-agent mcp import - Import MCPs from Claude global settings
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { generateSkillFromMcp } from '../templates/skill-generator.js';
import { updateIndexMd } from '../templates/index-md.js';
import { updateClaudeMdMcpSection } from '../templates/claude-md.js';
function inferCategory(name) {
    const categories = {
        database: ['supabase', 'postgres', 'mongodb', 'neo4j', 'redis'],
        development: ['github', 'gitlab', 'filesystem', 'context7', 'vectorcode'],
        payments: ['stripe', 'paypal'],
        communication: ['slack', 'discord', 'telegram'],
        infrastructure: ['aws', 'docker', 'kubernetes']
    };
    for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.some(keyword => name.toLowerCase().includes(keyword))) {
            return category;
        }
    }
    return 'custom';
}
export async function runMcpImport(projectRoot, options = {}) {
    const { backup = true, disableGlobal = false, dryRun = false } = options;
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    // 1. Read Claude settings
    const spinner = ora('Reading Claude settings...').start();
    let settings;
    try {
        const content = await fs.readFile(settingsPath, 'utf8');
        settings = JSON.parse(content);
        if (!settings.mcpServers) {
            spinner.warn('No MCPs found in Claude settings');
            console.log(chalk.yellow('\n⚠️  No mcpServers found in ~/.claude/settings.json\n'));
            return;
        }
        // Handle both array and object formats
        const mcpCount = Array.isArray(settings.mcpServers)
            ? settings.mcpServers.length
            : Object.keys(settings.mcpServers).length;
        if (mcpCount === 0) {
            spinner.warn('No MCPs found in Claude settings');
            console.log(chalk.yellow('\n⚠️  No mcpServers configured\n'));
            return;
        }
        const format = Array.isArray(settings.mcpServers) ? 'array' : 'object';
        spinner.succeed(`Found ${mcpCount} MCP server(s) in Claude settings (${format} format)`);
    }
    catch (error) {
        spinner.fail('Failed to read Claude settings');
        if (error.code === 'ENOENT') {
            console.log(chalk.yellow('\n⚠️  ~/.claude/settings.json not found\n'));
        }
        else {
            throw error;
        }
        return;
    }
    if (dryRun) {
        console.log(chalk.blue('\n🔍 Dry run - showing what would be imported:\n'));
    }
    // 2. Backup settings if requested
    if (backup && !dryRun) {
        const backupSpinner = ora('Backing up Claude settings...').start();
        try {
            const backupPath = `${settingsPath}.backup.${Date.now()}`;
            await fs.copyFile(settingsPath, backupPath);
            backupSpinner.succeed(`Backed up to ${backupPath}`);
        }
        catch (error) {
            backupSpinner.fail('Backup failed');
            throw error;
        }
    }
    // 3. Create mcp-skills directory
    const skillsDir = path.join(projectRoot, 'mcp-skills');
    if (!dryRun) {
        await fs.mkdir(skillsDir, { recursive: true });
    }
    // 4. Import each MCP as a skill
    const importedSkills = [];
    // Convert to array format for uniform processing
    const mcpEntries = Array.isArray(settings.mcpServers)
        ? settings.mcpServers.map(name => ({
            id: name,
            config: {
                command: 'npx',
                args: ['-y', name],
                env: undefined
            }
        }))
        : Object.entries(settings.mcpServers).map(([id, config]) => ({ id, config }));
    for (const { id: serverId, config } of mcpEntries) {
        const skillSpinner = ora(`Importing ${serverId}...`).start();
        try {
            const skillId = serverId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            const skillPath = path.join(skillsDir, `${skillId}.md`);
            const category = inferCategory(serverId);
            if (dryRun) {
                skillSpinner.info(`Would create: mcp-skills/${skillId}.md`);
                console.log(chalk.gray(`  Command: ${config.command} ${config.args.join(' ')}`));
                console.log(chalk.gray(`  Category: ${category}`));
                importedSkills.push(skillId);
                continue;
            }
            // Generate skill file
            const skillContent = await generateSkillFromMcp({
                skillId,
                serverId,
                command: config.command,
                args: config.args,
                env: config.env
            });
            await fs.writeFile(skillPath, skillContent, 'utf8');
            importedSkills.push(skillId);
            skillSpinner.succeed(`Created mcp-skills/${skillId}.md (${category})`);
        }
        catch (error) {
            skillSpinner.fail(`Failed to import ${serverId}`);
            console.error(chalk.red(`  Error: ${error}`));
        }
    }
    if (dryRun) {
        console.log(chalk.blue(`\n✓ Dry run complete - ${importedSkills.length} skill(s) would be created\n`));
        return;
    }
    // 5. Update INDEX.md
    const indexSpinner = ora('Updating skill index...').start();
    try {
        const indexPath = path.join(skillsDir, 'INDEX.md');
        await updateIndexMd(indexPath, importedSkills);
        indexSpinner.succeed('Updated mcp-skills/INDEX.md');
    }
    catch (error) {
        indexSpinner.fail('Failed to update index');
        throw error;
    }
    // 6. Update CLAUDE.md
    const claudeSpinner = ora('Updating CLAUDE.md...').start();
    try {
        const claudePath = path.join(projectRoot, 'CLAUDE.md');
        await updateClaudeMdMcpSection(claudePath, importedSkills);
        claudeSpinner.succeed('Updated CLAUDE.md MCP section');
    }
    catch (error) {
        claudeSpinner.fail('Failed to update CLAUDE.md');
        throw error;
    }
    // 7. Disable global MCPs if requested
    if (disableGlobal) {
        const disableSpinner = ora('Disabling global MCPs...').start();
        try {
            // Keep backup, remove mcpServers block
            delete settings.mcpServers;
            await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
            disableSpinner.succeed('Removed mcpServers from global settings');
            console.log(chalk.yellow('\n⚠️  Global MCPs disabled. Restore from backup if needed.\n'));
        }
        catch (error) {
            disableSpinner.fail('Failed to disable global MCPs');
            throw error;
        }
    }
    // 8. Success summary
    console.log(chalk.green(`\n✅ Successfully imported ${importedSkills.length} MCP skill(s)\n`));
    console.log(chalk.blue('📝 Imported skills:'));
    importedSkills.forEach(skillId => {
        console.log(chalk.gray(`  • ${skillId}`));
    });
    console.log(chalk.blue(`\n📚 Next steps:

1. Review generated skills in mcp-skills/
2. Add examples and documentation to each skill file
3. Test skills with:
   ${chalk.cyan('npx claude-flow mcp <skill-id> --tool <tool-name> --args \'<json>\'')}

4. Track usage with AgentDB and Iris
`));
}
