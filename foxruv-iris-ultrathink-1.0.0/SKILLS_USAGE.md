# Ultrathink Skills System - Usage Guide

Complete guide for using the MCP-to-skill conversion system in your projects.

## Quick Start

### 1. Install Ultrathink

```bash
npm install @foxruv/iris-ultrathink
# or
pnpm add @foxruv/iris-ultrathink
```

### 2. Import Global MCPs

Convert your global MCP configurations to project-local skills:

```bash
# Using npm scripts (recommended)
npm run skills:import

# With options
npm run skills:import -- --backup --disable-global

# Dry run to see what would be imported
npm run skills:import -- --dry-run
```

### 3. Verify Skills

Check the generated files:

```bash
ls mcp-skills/
# Expected output:
# - INDEX.md           # Master index of all skills
# - _template.md       # Template for new skills
# - mcp-manager.md     # Meta-skill for management
# - <skill-id>.md      # Your imported skills
```

### 4. Use Skills with Claude Code

Reference skills in your conversations:

```markdown
Check mcp-skills/INDEX.md for available skills.

To use the stripe skill:
1. Read mcp-skills/stripe.md
2. Run: npx claude-flow mcp stripe --tool create_payment --args '{"amount":1000}'
```

## Programmatic Usage

### Import from Library

```typescript
import {
  importMcpsFromSettings,
  syncSkillIndex,
  initializeSkillInfrastructure
} from '@foxruv/iris-ultrathink';

// Initialize skill infrastructure
await initializeSkillInfrastructure(process.cwd());

// Import MCPs from Claude settings
const skills = await importMcpsFromSettings({
  projectRoot: process.cwd(),
  backup: true,
  disableGlobal: false,
  dryRun: false
});

console.log(`✅ Imported ${skills.length} skills:`, skills);

// Sync index after manual changes
await syncSkillIndex({ projectRoot: process.cwd() });
```

### Generate Custom Skills

```typescript
import { generateSkillFromMcp } from '@foxruv/iris-ultrathink';

const skillMarkdown = generateSkillFromMcp({
  skillId: 'custom-api',
  serverId: 'custom-api-server',
  command: 'node',
  args: ['./my-api-server.js'],
  env: {
    API_KEY: 'Required for API access',
    BASE_URL: 'https://api.example.com'
  },
  category: 'custom',
  tags: ['api', 'internal', 'custom']
});

// Write to file
import { writeFile } from 'fs/promises';
await writeFile('mcp-skills/custom-api.md', skillMarkdown);

// Update index
import { syncSkillIndex } from '@foxruv/iris-ultrathink';
await syncSkillIndex({ projectRoot: process.cwd() });
```

### Parse Skill Metadata

```typescript
import { parseFrontmatter, getSkillMetadata } from '@foxruv/iris-ultrathink';
import { readFile } from 'fs/promises';

// Parse frontmatter from content
const content = await readFile('mcp-skills/my-skill.md', 'utf8');
const metadata = parseFrontmatter(content);

console.log('Skill ID:', metadata.skill_id);
console.log('Category:', metadata.category);
console.log('Tracking enabled:', metadata.agent_db_tracking);

// Or get metadata from file path
const meta = await getSkillMetadata('mcp-skills/my-skill.md');
```

### Manage Skill Index

```typescript
import {
  discoverSkills,
  groupSkillsByCategory,
  updateIndexMd,
  updateClaudeMdMcpSection
} from '@foxruv/iris-ultrathink';

// Discover all skills
const skillsDir = 'mcp-skills';
const skills = await discoverSkills(skillsDir);

// Group by category
const grouped = await groupSkillsByCategory(skillsDir, skills);
console.log('Skills by category:', grouped);

// Update INDEX.md
await updateIndexMd('mcp-skills/INDEX.md', skills);

// Update CLAUDE.md
await updateClaudeMdMcpSection('CLAUDE.md', skills);
```

## Command-Line Interface

### Import Command

```bash
# Basic import
npm run skills:import

# Options
npm run skills:import -- \
  --backup             # Backup Claude settings (default: true)
  --disable-global     # Remove MCPs from global settings
  --dry-run            # Show what would be imported
  --project-root ./    # Custom project root
```

**What it does:**
1. Reads `~/.claude/settings.json`
2. Backs up settings (if `--backup`)
3. Creates `mcp-skills/` directory
4. Generates skill files for each MCP
5. Creates `_template.md` and `mcp-manager.md`
6. Updates `INDEX.md`
7. Updates `CLAUDE.md`
8. Optionally removes global MCPs (if `--disable-global`)

### Sync Command

```bash
# Sync index with current skills
npm run skills:sync

# With options
npm run skills:sync -- --project-root ./ --verbose
```

**What it does:**
1. Scans `mcp-skills/` directory
2. Discovers all `.md` files (except `INDEX.md` and `_template.md`)
3. Parses frontmatter from each skill
4. Groups skills by category
5. Updates `INDEX.md` with organized list
6. Updates `CLAUDE.md` MCP section

### Init Command

```bash
# Initialize skill infrastructure
npm run skills:init

# With custom project root
npm run skills:init -- --project-root ./
```

**What it does:**
1. Creates `mcp-skills/` directory
2. Creates `_template.md`
3. Creates `mcp-manager.md`
4. Creates empty `INDEX.md`
5. Creates or updates `CLAUDE.md`

## Skill File Format

Each skill file follows this structure:

```markdown
---
skill_id: my-skill
mcp_server: my-mcp-server
category: development
tags: [mcp, tools, development]
agent_db_tracking: true
imported_from_global: true
import_date: 2025-11-20
---

# My Skill MCP Skill

## Purpose
Brief description of what this skill does.

## MCP Server Configuration
Command and environment variable setup.

## Tools Available
List of tools with arguments and examples.

## Complete Examples
Copy-paste ready command examples.

## Common Issues
Troubleshooting guide.

## AgentDB Integration
How usage is tracked and analyzed.

## Next Steps
Documentation improvements needed.

## References
Links to relevant documentation.
```

### Frontmatter Fields

- **skill_id** (required): Unique identifier, lowercase with hyphens
- **mcp_server** (optional): Original MCP server name
- **category** (optional): For grouping (development, data, communication, etc.)
- **tags** (optional): Array of keywords for search
- **agent_db_tracking** (optional): Enable AgentDB tracking (default: true)
- **imported_from_global** (optional): Imported from Claude settings
- **import_date** (optional): Date of import

## Directory Structure

After importing, your project will have:

```
your-project/
├── mcp-skills/
│   ├── INDEX.md              # Master index
│   ├── _template.md          # Template for new skills
│   ├── mcp-manager.md        # Management meta-skill
│   ├── stripe.md             # Imported skill example
│   ├── github.md             # Another imported skill
│   └── ...                   # More skills
├── CLAUDE.md                 # Updated with skill references
└── package.json              # Your project config
```

## Integration with Claude Code

### Pattern 1: Skill Discovery

Claude Code should:
1. Check `mcp-skills/INDEX.md` for available skills
2. Open specific skill file when needed
3. Propose exact command to run
4. Summarize results concisely

Example conversation:

```
User: "I need to create a Stripe payment"

Claude:
1. *Checks mcp-skills/INDEX.md*
2. *Reads mcp-skills/stripe.md*
3. Based on the stripe skill, here's the command:

```bash
npx claude-flow mcp stripe \
  --tool create_payment_intent \
  --args '{
    "amount": 1000,
    "currency": "usd",
    "customer": "cus_..."
  }'
```

Would you like me to run this?
```

### Pattern 2: Skill Creation

When creating new skills manually:

```bash
# 1. Copy template
cp mcp-skills/_template.md mcp-skills/my-new-skill.md

# 2. Edit the file with your skill details

# 3. Sync index
npm run skills:sync

# 4. Commit
git add mcp-skills/
git commit -m "Add my-new-skill"
```

### Pattern 3: Maintenance

Regular maintenance tasks:

```bash
# After updating skill files
npm run skills:sync

# After git pull with new skills
npm run skills:sync

# Verify all skills are tracked
cat mcp-skills/INDEX.md
```

## AgentDB Integration

Skills with `agent_db_tracking: true` automatically log:

### What's Tracked

- **Tool invocations**: Which tools are called
- **Arguments**: Common patterns
- **Success/failure**: Outcome of each call
- **Latency**: Response times
- **Error patterns**: Common failures
- **Usage frequency**: How often used

### Querying Tracked Data

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

// Get skill usage stats
const { data: events } = await supabase
  .from('agentdb_events')
  .select('*')
  .eq('event_type', 'mcp_skill_invocation')
  .eq('metadata->>skill_id', 'stripe')
  .order('created_at', { ascending: false })
  .limit(100);

console.log('Recent stripe skill usage:', events);
```

### Iris Evaluation

Analyze skill performance with Iris:

```bash
# Evaluate all skills
npm run iris:evaluate -- --project my-project --filter mcp_skills

# Evaluate specific skill
npm run iris:evaluate -- --project my-project --filter skill:stripe

# Get recommendations
npm run iris:evaluate -- --project my-project --suggest-improvements
```

## Advanced Patterns

### Custom Skill Generator

Create a custom generator for your team:

```typescript
import { generateSkillFromMcp } from '@foxruv/iris-ultrathink';

function generateTeamSkill(config: {
  name: string;
  service: string;
  apiKey: string;
}) {
  return generateSkillFromMcp({
    skillId: config.name,
    serverId: config.service,
    command: 'npx',
    args: ['-y', `@company/${config.service}`],
    env: {
      [`${config.service.toUpperCase()}_API_KEY`]: config.apiKey
    },
    category: 'company',
    tags: ['company', config.service, 'internal']
  });
}

// Use it
const skill = generateTeamSkill({
  name: 'company-api',
  service: 'internal-api',
  apiKey: 'Required for internal API access'
});
```

### Batch Import

Import multiple custom MCPs at once:

```typescript
import { generateSkillFromMcp, syncSkillIndex } from '@foxruv/iris-ultrathink';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const mcpConfigs = [
  { id: 'api-1', command: 'node', args: ['./api1.js'] },
  { id: 'api-2', command: 'node', args: ['./api2.js'] },
  { id: 'api-3', command: 'node', args: ['./api3.js'] }
];

// Create skills directory
await mkdir('mcp-skills', { recursive: true });

// Generate all skills
for (const config of mcpConfigs) {
  const skill = generateSkillFromMcp({
    skillId: config.id,
    serverId: config.id,
    command: config.command,
    args: config.args,
    category: 'custom',
    tags: ['batch-imported', 'api']
  });

  await writeFile(
    path.join('mcp-skills', `${config.id}.md`),
    skill
  );
}

// Sync index
await syncSkillIndex({ projectRoot: '.' });
```

### Migration Script

Migrate from one MCP format to another:

```typescript
import {
  discoverSkills,
  getSkillMetadata,
  generateSkillFromMcp,
  syncSkillIndex
} from '@foxruv/iris-ultrathink';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

async function migrateSkills(oldDir: string, newDir: string) {
  const skills = await discoverSkills(oldDir);

  for (const skillId of skills) {
    const oldPath = path.join(oldDir, `${skillId}.md`);
    const metadata = await getSkillMetadata(oldPath);

    // Regenerate with new format
    const newContent = generateSkillFromMcp({
      skillId: metadata.skill_id,
      serverId: metadata.mcp_server || metadata.skill_id,
      command: 'npx',
      args: ['-y', metadata.skill_id],
      category: metadata.category,
      tags: metadata.tags
    });

    await writeFile(
      path.join(newDir, `${skillId}.md`),
      newContent
    );
  }

  await syncSkillIndex({ projectRoot: newDir });
}
```

## Troubleshooting

### "No MCPs found in Claude settings"

**Cause**: Your `~/.claude/settings.json` doesn't have `mcpServers` defined

**Fix**: Add MCPs to Claude settings first or create skills manually

### "mcp-skills/ directory not found"

**Cause**: Skills infrastructure not initialized

**Fix**: Run `npm run skills:init`

### "INDEX.md out of sync"

**Cause**: Skills added/removed without syncing

**Fix**: Run `npm run skills:sync`

### Skills not appearing in Claude Code

**Cause**: Skills not referenced in context

**Fix**: Claude Code should check `mcp-skills/INDEX.md` at the start of conversations

## Best Practices

1. **Always sync after changes**: Run `npm run skills:sync` after adding/removing skills
2. **Use categories**: Organize skills into logical categories
3. **Document thoroughly**: Add examples and troubleshooting to each skill
4. **Track usage**: Enable `agent_db_tracking` for insights
5. **Keep updated**: Update skills when MCP servers change
6. **Version control**: Commit skill files to git
7. **Review regularly**: Check Iris evaluations for optimization opportunities

## Resources

- [Ultrathink README](./README.md)
- [Skills System README](./src/skills/README.md)
- [Agent Learning Core](https://github.com/ruvnet/agent-learning-core)
- [Claude Code](https://claude.ai/code)

## License

MIT - Part of the Agent Learning Core project
