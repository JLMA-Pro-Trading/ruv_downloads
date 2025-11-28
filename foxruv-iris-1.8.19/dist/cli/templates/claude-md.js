/**
 * CLAUDE.md template generator and merger
 */
import fs from 'node:fs/promises';
export function generateClaudeMd() {
    return `# Project AI Guide (Claude Code + @foxruv/iris)

This project uses:

- \`claude-flow\` for running flows and tools
- \`@foxruv/iris\` for:
  - AgentDB (learning + telemetry)
  - Supabase-backed intelligence backend
  - MCP → skill conversion
  - Iris evaluation / auto-optimization

---

## 🔁 First-Time Setup (for Claude Code)

> **For Claude / AI assistants inside this repo:**
>
> 1. Check if there are global MCPs configured in \`~/.claude/settings.json\`.
> 2. If there are, offer to import them into this project as **local skills**:
>
>    Suggest running:
>
>    \`\`\`bash
>    npx iris mcp import
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

## Iris / Agent-Learning

This repo may define npm scripts such as:

\`\`\`bash
npm run iris:evaluate -- --project <name>
npm run iris:auto-invoke -- --event file_edit --project <name>
npm run iris:retrain -- --project <name>
\`\`\`

> **For Claude:**
>
> * When you need to evaluate project health or drift, prefer these Iris commands.
> * When an expert's performance degrades, suggest \`iris:evaluate\` / \`iris:retrain\` instead of ad-hoc prompt surgery.

---

## AgentDB Integration

Every MCP call, file edit, and operation should be tracked in AgentDB when \`agent_db_tracking: true\` in skill frontmatter.

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

AgentDB, Supabase, and ReasoningBank exist specifically so you **don't** have to keep everything in the chat window.

---

## Available Skills

<!-- MCP_SKILLS_SECTION_START -->
*No skills imported yet. Run \`npx iris mcp import\` to populate this section.*
<!-- MCP_SKILLS_SECTION_END -->
`;
}
export function mergeClaudeMd(existing) {
    // Check if already has FoxRuv sections
    if (existing.includes('## 🔁 First-Time Setup (for Claude Code)')) {
        return existing;
    }
    // Otherwise, append our sections
    const newSections = generateClaudeMd()
        .split('\n')
        .slice(8) // Skip title and intro
        .join('\n');
    return existing.trimEnd() + '\n\n' + newSections;
}
export async function updateClaudeMdMcpSection(claudePath, skillIds) {
    const content = await fs.readFile(claudePath, 'utf8');
    const skillsList = skillIds.length > 0
        ? skillIds.map(id => `- [\`${id}\`](mcp-skills/${id}.md)`).join('\n')
        : '*No skills imported yet. Run `npx iris mcp import` to populate this section.*';
    const updated = content.replace(/<!-- MCP_SKILLS_SECTION_START -->[\s\S]*?<!-- MCP_SKILLS_SECTION_END -->/, `<!-- MCP_SKILLS_SECTION_START -->\n${skillsList}\n<!-- MCP_SKILLS_SECTION_END -->`);
    await fs.writeFile(claudePath, updated, 'utf8');
}
