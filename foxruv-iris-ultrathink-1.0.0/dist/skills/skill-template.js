/**
 * Skill file templates
 *
 * Provides templates for:
 * - New skill creation (_template.md)
 * - MCP manager meta-skill
 * - CLAUDE.md integration
 */
/**
 * Generate _template.md for new skills
 *
 * This template provides a complete structure for documenting
 * MCP skills with all required sections
 */
export function generateTemplateMd() {
    return `---
skill_id: SKILL_ID_HERE
mcp_server: MCP_SERVER_NAME
category: CATEGORY_HERE
tags: [tag1, tag2, tag3]
agent_db_tracking: true
---

# SKILL_NAME MCP Skill

## Purpose

Brief description of what this skill does and when to use it.

## MCP Server Configuration

**Command:** \`npx -y <mcp-server-package>\`

**Required Environment Variables:**
- \`API_KEY\`: Your API key for this service
- \`WORKSPACE_ID\`: Optional workspace/org identifier

## Tools Available

### tool_name_1

Brief description of what this tool does.

**Arguments:**
\`\`\`json
{
  "arg1": "string - description",
  "arg2": "number - description",
  "optional_arg": "string - optional description"
}
\`\`\`

**Usage:**
\`\`\`bash
npx claude-flow mcp SKILL_ID_HERE \\
  --tool tool_name_1 \\
  --args '{"arg1":"value1","arg2":123}'
\`\`\`

**Returns:**
\`\`\`json
{
  "result": "description of result",
  "status": "success | error"
}
\`\`\`

### tool_name_2

Description of second tool.

**Arguments:**
\`\`\`json
{
  "input": "string - what goes here"
}
\`\`\`

**Usage:**
\`\`\`bash
npx claude-flow mcp SKILL_ID_HERE \\
  --tool tool_name_2 \\
  --args '{"input":"example input"}'
\`\`\`

## Complete Examples

### Example 1: Common Use Case

Description of what this example accomplishes.

\`\`\`bash
# Step 1: Do something
npx claude-flow mcp SKILL_ID_HERE \\
  --tool tool_name_1 \\
  --args '{
    "arg1": "example value",
    "arg2": 42
  }'

# Step 2: Use the result
npx claude-flow mcp SKILL_ID_HERE \\
  --tool tool_name_2 \\
  --args '{"input":"result_from_step_1"}'
\`\`\`

### Example 2: Advanced Pattern

\`\`\`bash
npx claude-flow mcp SKILL_ID_HERE \\
  --tool tool_name_1 \\
  --args '{
    "arg1": "complex example",
    "arg2": 100,
    "optional_arg": "additional config"
  }'
\`\`\`

## Common Issues

### Error: "Invalid API key"
**Cause:** Missing or incorrect \`API_KEY\` environment variable
**Fix:** Set \`API_KEY\` in your environment or \`.env\` file

### Error: "Rate limit exceeded"
**Cause:** Too many requests in short time
**Fix:** Add delays between calls or use batch operations

## AgentDB Integration

This skill automatically tracks:

- **Input patterns**: Most common argument combinations
- **Success rate**: Percentage of successful calls
- **Latency**: Average response time per tool
- **Error patterns**: Common failure modes and their frequency
- **Usage trends**: When and how often this skill is used

### Iris Evaluation

Iris can analyze this skill's usage and suggest:

- Better argument validation patterns
- Optimal retry strategies
- When to batch operations
- Alternative tools for specific use cases

Run evaluation with:

\`\`\`bash
npm run iris:evaluate -- --project <project-name> --filter skill:SKILL_ID_HERE
\`\`\`

## References

- [Official API Docs](https://example.com/docs)
- [MCP Server Repository](https://github.com/org/mcp-server)
- [Internal Usage Guide](../docs/guides/SKILL_ID_HERE-guide.md)

## Maintenance

**Last Updated:** YYYY-MM-DD
**Maintainer:** @username
**Version:** 1.0.0

Update this skill when:
- MCP server is updated to new version
- New tools are added
- Common patterns change
- Error handling improves
`;
}
/**
 * Generate mcp-manager.md - Meta skill for managing MCP skills
 */
export function generateMcpManagerMd() {
    return `---
skill_id: mcp-manager
category: meta
tags: [management, automation, maintenance]
agent_db_tracking: false
---

# MCP Manager - Meta Skill

## Purpose

This is a **meta skill** for managing the MCP skill system itself. It doesn't invoke an external MCP server, but provides commands for maintaining skills.

## Commands

### Import Global MCPs

Import MCPs from \`~/.claude/settings.json\` into this project as skills.

\`\`\`bash
npm run ultrathink:skills:import [options]
\`\`\`

**Options:**
- \`--backup\` - Backup Claude settings before modification (default: true)
- \`--disable-global\` - Remove global MCPs after import
- \`--dry-run\` - Show what would be imported without changes

**Example:**
\`\`\`bash
# Import with backup, keep global MCPs enabled
npm run ultrathink:skills:import -- --backup --no-disable-global

# Import and disable global MCPs (project-only)
npm run ultrathink:skills:import -- --disable-global

# See what would be imported
npm run ultrathink:skills:import -- --dry-run
\`\`\`

### Synchronize Index

Scan \`mcp-skills/\` and update \`INDEX.md\` with all skill files.

\`\`\`bash
npm run ultrathink:skills:sync
\`\`\`

Use this after:
- Manually creating new skill files
- Deleting obsolete skills
- Reorganizing skill categories

## Maintenance Workflows

### Adding a New Skill Manually

1. **Copy template:**
   \`\`\`bash
   cp mcp-skills/_template.md mcp-skills/my-new-skill.md
   \`\`\`

2. **Edit skill file:**
   - Update frontmatter (\`skill_id\`, \`category\`, \`tags\`)
   - Fill in tool descriptions
   - Add complete examples
   - Document common issues

3. **Sync index:**
   \`\`\`bash
   npm run ultrathink:skills:sync
   \`\`\`

4. **Test the skill:**
   \`\`\`bash
   npx claude-flow mcp my-new-skill --tool <tool-name> --args '{}'
   \`\`\`

### Updating an Existing Skill

1. **Edit the skill file** in \`mcp-skills/<skill-id>.md\`
2. **Update "Last Updated" date** in frontmatter
3. **Test changes** with example commands
4. **Commit** the updated skill file

No index sync needed unless you changed the \`skill_id\` or \`category\`.

### Removing an Obsolete Skill

1. **Delete the skill file:**
   \`\`\`bash
   rm mcp-skills/obsolete-skill.md
   \`\`\`

2. **Sync index:**
   \`\`\`bash
   npm run ultrathink:skills:sync
   \`\`\`

3. **Check for references:**
   \`\`\`bash
   grep -r "obsolete-skill" .
   \`\`\`

4. **Remove from CLAUDE.md** if manually listed

## Integration with AgentDB

While this meta skill doesn't track its own usage, it manages skills that do.

**Tracked data per skill:**
- Total invocations
- Success/failure rates
- Common argument patterns
- Error frequencies
- Latency distributions

**Access tracking data:**
\`\`\`bash
npm run iris:evaluate -- --project <name> --filter mcp_usage
\`\`\`

## References

- [Ultrathink Documentation](../README.md)
- [CLAUDE.md](../CLAUDE.md)
- [Agent Learning Core](https://github.com/ruvnet/agent-learning-core)

## See Also

- [\`_template.md\`](./_template.md) - Template for new skills
- [\`INDEX.md\`](./INDEX.md) - Complete skill directory
`;
}
/**
 * Generate CLAUDE.md template with MCP skill integration
 */
export function generateClaudeMd() {
    const today = new Date().toISOString().split('T')[0];
    return `# Claude Code Project Guide

This project uses Ultrathink for MCP skill management and AgentDB integration.

---

## 🔁 MCP Skill Migration (First-Time Setup)

> **For Claude / AI assistants in this repo:**
>
> 1. Check if there are global MCPs configured in \`~/.claude/settings.json\`.
> 2. If there are, offer to import them into this project as **local skills**:
>
>    Suggest running:
>
>    \`\`\`bash
>    npm run ultrathink:skills:import
>    \`\`\`
>
> 3. Explain to the user that this will:
>    - Create \`mcp-skills/<skill-id>.md\` skill files
>    - Update \`mcp-skills/INDEX.md\`
>    - Add all skills to the MCP section below
>    - Optionally disable \`mcpServers\` in \`~/.claude/settings.json\` (after backup)
>
> Going forward, use **only project-local MCP skills** via CLI, not global MCPs.

If the user declines migration, you may still use global MCPs for this session, but you should periodically re-offer migration until it's completed.

---

## MCP Skills (On-Demand Only)

All MCP usage in this project must go through CLI calls, not auto-loaded tools.

**Standard pattern:**

\`\`\`bash
npx claude-flow mcp <skill-id> \\
  --tool <tool-name> \\
  --args '<json-args>'
\`\`\`

Skill docs live in: \`mcp-skills/\`
Skill directory: \`mcp-skills/INDEX.md\`

> **For Claude:**
>
> * When a user request requires external systems (Stripe, GitHub, DB, etc):
>
>   1. Look up the skill in \`mcp-skills/INDEX.md\`
>   2. Open \`mcp-skills/<skill-id>.md\`
>   3. Propose a **single** \`npx claude-flow mcp ...\` command
>   4. Summarize results instead of dumping raw JSON

---

## AgentDB Integration

Every MCP call with \`agent_db_tracking: true\` in skill frontmatter is tracked:

**Automatic tracking includes:**
- Input/output examples
- Success/failure outcomes
- Latency and error patterns
- Usage frequency
- Semantic embeddings for pattern discovery

This enables:
- Reflexion-based drift detection
- Cross-project pattern transfer
- Autonomous optimization via Iris
- Consensus-based expert rotation

---

## Context Discipline

* Keep the context focused on:
  * Current code / files
  * The most recent MCP / Iris / flow runs
* Do **not**:
  * Load all MCP schemas into the conversation
  * Paste massive telemetry logs unless asked

AgentDB and Ultrathink exist specifically so you **don't** have to keep everything in the chat window.

---

## Available Skills

<!-- MCP_SKILLS_SECTION_START -->
*No skills imported yet. Run \`npm run ultrathink:skills:import\` to populate this section.*
<!-- MCP_SKILLS_SECTION_END -->

---

**Generated:** ${today}
**Ultrathink Version:** 1.0.0
`;
}
//# sourceMappingURL=skill-template.js.map