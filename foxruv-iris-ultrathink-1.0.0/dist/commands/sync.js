import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve, basename } from 'path';
import { existsSync } from 'fs';

// src/cli/commands/sync.ts
var syncCommand = new Command("sync").description("Sync skill index with file changes").option("-d, --directory <path>", "Skills directory", "./skills").option("--validate-only", "Only validate, don't update index").option("--fix", "Attempt to fix invalid YAML frontmatter").option("-v, --verbose", "Show detailed validation results").action(async (options) => {
  const spinner = ora("Syncing skill index...").start();
  try {
    const skillsPath = resolve(options.directory);
    if (!existsSync(skillsPath)) {
      spinner.fail("Skills directory not found");
      console.log(chalk.gray(`Expected: ${skillsPath}`));
      console.log(chalk.yellow("\nRun `ultrathink import` to create it"));
      process.exit(1);
    }
    spinner.text = "Scanning skills directory...";
    const skillFiles = await scanSkillsDirectory(skillsPath);
    spinner.text = "Validating YAML frontmatter...";
    const parsedSkills = [];
    for (const file of skillFiles) {
      const skill = await parseSkillFile(file);
      parsedSkills.push(skill);
    }
    const validSkills = parsedSkills.filter((s) => s.valid);
    const invalidSkills = parsedSkills.filter((s) => !s.valid);
    if (options.verbose || invalidSkills.length > 0) {
      spinner.stop();
      if (invalidSkills.length > 0) {
        console.log(chalk.yellow("\n\u26A0\uFE0F  Invalid skill files:"));
        invalidSkills.forEach((skill) => {
          console.log(chalk.red(`  \u2717 ${skill.name}`));
          skill.errors.forEach((err) => console.log(chalk.gray(`    - ${err}`)));
        });
      }
      if (validSkills.length > 0 && options.verbose) {
        console.log(chalk.green("\n\u2713 Valid skill files:"));
        validSkills.forEach((skill) => {
          console.log(chalk.gray(`  \u2713 ${skill.name} (${skill.metadata.type})`));
        });
      }
      spinner.start();
    }
    if (options.fix && invalidSkills.length > 0) {
      spinner.text = "Fixing invalid YAML frontmatter...";
      for (const skill of invalidSkills) {
        try {
          await fixSkillFile(skill.path);
          console.log(chalk.green(`  Fixed: ${skill.name}`));
        } catch (error) {
          console.log(chalk.red(`  Failed to fix: ${skill.name}`));
        }
      }
    }
    spinner.text = "Checking for orphaned entries...";
    const orphanedEntries = await findOrphanedEntries(skillsPath, validSkills);
    if (!options.validateOnly) {
      spinner.text = "Updating INDEX.md...";
      await updateIndex(skillsPath, validSkills, orphanedEntries);
      spinner.text = "Updating CLAUDE.md...";
      await updateClaudeConfig(skillsPath, validSkills);
    }
    const result = {
      discovered: parsedSkills,
      valid: validSkills.length,
      invalid: invalidSkills.length,
      orphaned: orphanedEntries,
      updated: !options.validateOnly
    };
    spinner.succeed(chalk.green("Sync complete!"));
    console.log(chalk.cyan("\nSummary:"));
    console.log(chalk.gray(`  Total skills: ${parsedSkills.length}`));
    console.log(chalk.gray(`  Valid: ${result.valid}`));
    if (result.invalid > 0) {
      console.log(chalk.yellow(`  Invalid: ${result.invalid}`));
    }
    if (result.orphaned.length > 0) {
      console.log(chalk.yellow(`  Orphaned entries: ${result.orphaned.length}`));
    }
    if (options.validateOnly) {
      console.log(chalk.yellow("\n\u26A0\uFE0F  Validation-only mode: No files were modified"));
    } else {
      console.log(chalk.green("\n\u2713 INDEX.md updated"));
      console.log(chalk.green("\u2713 CLAUDE.md updated"));
    }
    if (result.invalid > 0) {
      console.log(chalk.cyan("\nTo fix invalid files:"));
      console.log(chalk.gray("  ultrathink sync --fix"));
    }
  } catch (error) {
    spinner.fail(chalk.red("Sync failed"));
    console.error(chalk.red("Error:"), error instanceof Error ? error.message : error);
    if (options.parent?.opts().debug) {
      console.error(error);
    }
    process.exit(1);
  }
});
async function scanSkillsDirectory(skillsPath) {
  const entries = await readdir(skillsPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md")).filter((entry) => !["INDEX.md", "CLAUDE.md", "README.md"].includes(entry.name)).map((entry) => resolve(skillsPath, entry.name));
}
async function parseSkillFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  const name = basename(filePath, ".md");
  const errors = [];
  let metadata = {
    name,
    type: "unknown",
    enabled: true
  };
  try {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      errors.push("Missing YAML frontmatter");
      return { path: filePath, name, metadata, valid: false, errors };
    }
    const yamlContent = frontmatterMatch[1];
    const lines = yamlContent.split("\n");
    for (const line of lines) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        metadata[key] = parseYamlValue(value);
      }
    }
    if (!metadata.name) {
      errors.push("Missing required field: name");
    }
    if (!metadata.type) {
      errors.push("Missing required field: type");
    }
    if (metadata.enabled !== true && metadata.enabled !== false) {
      errors.push("Invalid enabled field: must be true or false");
    }
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : error}`);
  }
  return {
    path: filePath,
    name,
    metadata,
    valid: errors.length === 0,
    errors
  };
}
function parseYamlValue(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
async function fixSkillFile(filePath) {
  const content = await readFile(filePath, "utf-8");
  const name = basename(filePath, ".md");
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, "");
  const frontmatter = `---
name: ${name}
type: mcp
enabled: true
fixed_at: ${(/* @__PURE__ */ new Date()).toISOString()}
---

`;
  await writeFile(filePath, frontmatter + withoutFrontmatter, "utf-8");
}
async function findOrphanedEntries(skillsPath, validSkills) {
  const indexPath = resolve(skillsPath, "INDEX.md");
  if (!existsSync(indexPath)) {
    return [];
  }
  const indexContent = await readFile(indexPath, "utf-8");
  const validNames = new Set(validSkills.map((s) => s.name));
  const orphaned = [];
  const entryPattern = /- \*\*([^*]+)\*\*/g;
  let match;
  while ((match = entryPattern.exec(indexContent)) !== null) {
    const entryName = match[1];
    if (!validNames.has(entryName)) {
      orphaned.push(entryName);
    }
  }
  return orphaned;
}
async function updateIndex(skillsPath, skills, orphaned) {
  const indexPath = resolve(skillsPath, "INDEX.md");
  const byType = skills.reduce((acc, skill) => {
    const type = skill.metadata.type || "unknown";
    if (!acc[type]) acc[type] = [];
    acc[type].push(skill);
    return acc;
  }, {});
  let content = `# Skills Index

**Last Updated:** ${(/* @__PURE__ */ new Date()).toISOString()}
**Total Skills:** ${skills.length}

## Skills by Type

`;
  for (const [type, typeSkills] of Object.entries(byType)) {
    content += `
### ${type.toUpperCase()} (${typeSkills.length})

`;
    for (const skill of typeSkills) {
      const status = skill.metadata.enabled ? "\u2713 Enabled" : "\u2717 Disabled";
      const desc = skill.metadata.description ? ` - ${skill.metadata.description}` : "";
      content += `- **${skill.name}** (${status})${desc}
`;
    }
  }
  if (orphaned.length > 0) {
    content += `
## \u26A0\uFE0F Orphaned Entries

`;
    content += `These entries were in the index but no skill file was found:

`;
    orphaned.forEach((name) => {
      content += `- ${name}
`;
    });
  }
  content += `
## Statistics

- **Total Skills:** ${skills.length}
- **Active:** ${skills.filter((s) => s.metadata.enabled).length}
- **Inactive:** ${skills.filter((s) => !s.metadata.enabled).length}
- **Types:** ${Object.keys(byType).length}

## Commands

\`\`\`bash
ultrathink sync              # Sync this index
ultrathink import            # Import new MCPs
ultrathink detect-mcp        # Detect available servers
\`\`\`

---
*Auto-generated by \`ultrathink sync\`*
`;
  await writeFile(indexPath, content, "utf-8");
}
async function updateClaudeConfig(skillsPath, skills) {
  const claudePath = resolve(skillsPath, "CLAUDE.md");
  const enabledSkills = skills.filter((s) => s.metadata.enabled);
  const content = `# Claude Code Skills Configuration

**Skills Directory:** \`${skillsPath}\`
**Active Skills:** ${enabledSkills.length}/${skills.length}

## Enabled Skills

${enabledSkills.map((s) => `- **${s.name}** (${s.metadata.type})`).join("\n")}

## How It Works

Skills in this directory provide Claude Code with:

- **MCP Server Integrations** - Access to external tools and APIs
- **Project-Specific Configuration** - Tailored to your needs
- **Version Control** - Track changes to your tooling
- **Team Collaboration** - Share configurations with your team

## Management

\`\`\`bash
# Sync skills index
ultrathink sync

# Import from global settings
ultrathink import

# Discover AI experts
ultrathink discover --project ./

# Detect available MCPs
ultrathink detect-mcp

# View this file
cat skills/CLAUDE.md
\`\`\`

## Enabling/Disabling Skills

To disable a skill:
1. Edit the skill's \`.md\` file
2. Change \`enabled: true\` to \`enabled: false\`
3. Run \`ultrathink sync\`

To enable a skill:
1. Edit the skill's \`.md\` file
2. Change \`enabled: false\` to \`enabled: true\`
3. Run \`ultrathink sync\`

---
*Last synced: ${(/* @__PURE__ */ new Date()).toISOString()}*
`;
  await writeFile(claudePath, content, "utf-8");
}

export { syncCommand };
//# sourceMappingURL=sync.js.map
//# sourceMappingURL=sync.js.map