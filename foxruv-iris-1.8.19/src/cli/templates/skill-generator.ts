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

export async function generateSkillFromMcp(config: SkillGeneratorConfig): Promise<string> {
  const {
    skillId,
    serverId,
    command,
    args,
    env = {},
    category = 'uncategorized',
    tags = []
  } = config;

  const packageName = args.find(arg => arg.startsWith('@') || !arg.startsWith('-')) || serverId;
  const envVars = Object.keys(env);
  const hasEnv = envVars.length > 0;

  return `---
skill_id: ${skillId}
mcp_server: ${serverId}
category: ${category}
tags: ${JSON.stringify(tags.length > 0 ? tags : ['imported', serverId])}
agent_db_tracking: true
imported_from_global: true
import_date: ${new Date().toISOString().split('T')[0]}
---

# ${serverId.charAt(0).toUpperCase() + serverId.slice(1)} MCP Skill

## Purpose

This skill provides access to the **${serverId}** MCP server.

${hasEnv ? '> **Note:** This skill requires environment variables to be configured.' : ''}

## MCP Server Configuration

**Command:** \`${command} ${args.join(' ')}\`

${hasEnv ? `
**Required Environment Variables:**
${envVars.map(key => `- \`${key}\`: ${env[key] || 'Required for authentication/configuration'}`).join('\n')}

**Setup:**
\`\`\`bash
# Add to .env file
${envVars.map(key => `${key}=your_${key.toLowerCase()}_here`).join('\n')}
\`\`\`
` : ''}

## Tools Available

> **TODO:** Document available tools for this MCP server.
>
> To discover tools, run:
> \`\`\`bash
> npx claude-flow mcp ${skillId} --list-tools
> \`\`\`

### Example Tool Structure

\`\`\`bash
npx claude-flow mcp ${skillId} \\
  --tool <tool-name> \\
  --args '{"arg1":"value1","arg2":"value2"}'
\`\`\`

## Complete Examples

> **TODO:** Add real-world usage examples.

### Example 1: Basic Usage

\`\`\`bash
# Replace with actual tool and args
npx claude-flow mcp ${skillId} \\
  --tool example_tool \\
  --args '{
    "input": "example input"
  }'
\`\`\`

## Common Issues

### Error: "MCP server not found"
**Cause:** Package \`${packageName}\` not installed
**Fix:**
\`\`\`bash
npm install -g ${packageName}
\`\`\`

${hasEnv ? `
### Error: "Authentication failed"
**Cause:** Missing or invalid environment variables
**Fix:** Verify all required env vars are set in \`.env\` file
` : ''}

### Error: "Tool not found"
**Cause:** Invalid tool name
**Fix:** Run \`npx claude-flow mcp ${skillId} --list-tools\` to see available tools

## AgentDB Integration

This skill automatically tracks:

- **Input patterns**: Common argument combinations
- **Success rate**: Percentage of successful calls
- **Latency**: Response time distribution
- **Error patterns**: Failure modes and frequencies
- **Usage trends**: When and how often used

### Iris Evaluation

Evaluate this skill's performance:

\`\`\`bash
npm run iris:evaluate -- --project <project-name> --filter skill:${skillId}
\`\`\`

Iris can detect:
- Frequent failures indicating misconfiguration
- Unused tools that could be documented better
- Optimal argument patterns based on success rates
- Drift in usage patterns over time

## Next Steps

1. **Document tools**: List all available tools with descriptions
2. **Add examples**: Provide copy-paste ready examples for common use cases
3. **Test thoroughly**: Verify all tools work with example arguments
4. **Update category**: Change \`category\` in frontmatter to appropriate value
5. **Add tags**: Update \`tags\` with relevant keywords

## References

- **Package:** [\`${packageName}\`](https://npmjs.com/package/${packageName})
${hasEnv ? envVars.map(key => `- **${key}:** Configure in project \`.env\` file`).join('\n') : ''}
- **Generated:** ${new Date().toISOString().split('T')[0]}

---

**Maintenance:**
- Last Updated: ${new Date().toISOString().split('T')[0]}
- Status: ⚠️  Needs documentation (imported from global settings)
- Maintainer: TBD
`;
}
