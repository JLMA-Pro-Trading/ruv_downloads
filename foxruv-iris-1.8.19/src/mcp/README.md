# IRIS MCP Server

Model Context Protocol server for IRIS AI Operations Orchestrator.

## Quick Start

```bash
# Health check
npm run mcp:health

# Evaluate a project
npm run mcp:client iris_evaluate_project '{"projectId": "nfl-predictor"}'

# Run demo
tsx examples/mcp-usage-demo.ts health
```

## Key Pattern

This MCP server follows the **FoxRev ReasoningBank pattern**:

```
Code calls MCP → MCP executes → Results formatted for Claude → Claude analyzes text
```

**NOT** direct Claude ↔ MCP connection. This keeps heavy operations out of Claude's context.

## Architecture

```
┌─────────────┐
│   Claude    │     Analyzes formatted text results
│   (Model)   │
└─────────────┘
      ▲
      │ text results
      │
┌─────────────┐
│  Client     │     Calls MCP programmatically
│  Code       │
└─────────────┘
      │
      │ JSON-RPC
      ▼
┌─────────────┐
│  MCP Server │     Executes heavy operations
│  (stdio)    │
└─────────────┘
```

## Files

- **`iris-prime-mcp-server.ts`**: MCP server implementation
- **`../scripts/iris-mcp-client.ts`**: Programmatic client wrapper
- **`../examples/mcp-usage-demo.ts`**: Usage examples
- **`../docs/MCP_SERVER_ARCHITECTURE.md`**: Full documentation
- **`../docs/MCP_QUICK_START.md`**: Quick start guide

## Available Tools

### Evaluation
- `iris_evaluate_project` - Evaluate single project
- `iris_evaluate_all` - Cross-project evaluation

### Drift Detection
- `iris_detect_drift` - Detect performance drift

### Pattern Discovery
- `iris_find_patterns` - Discover learned patterns
- `iris_recommend_transfers` - Recommend pattern transfers

### Expert Statistics
- `iris_get_expert_stats` - Expert performance metrics
- `iris_get_cross_project_metrics` - Global metrics

### Auto-Retraining
- `iris_auto_retrain` - Trigger automatic retraining

### Consensus Lineage
- `iris_consensus_lineage` - Version lineage tracking
- `iris_rotation_recommendations` - Expert rotation recommendations

### Reflexion Search
- `iris_reflexion_search` - Search reflexions
- `iris_compare_reflexions` - Compare reflexions

### Health
- `iris_health_check` - Server health check

## Usage

### Pattern 1: Quick Call

```typescript
import { callIrisMCP, formatForClaude } from '../scripts/iris-mcp-client';

const result = await callIrisMCP('iris_evaluate_project', {
  projectId: 'nfl-predictor'
});

console.log(formatForClaude(result, 'iris_evaluate_project'));
```

### Pattern 2: Managed Client

```typescript
import { IrisPrimeMCPClient } from '../scripts/iris-mcp-client';

const client = new IrisPrimeMCPClient();
await client.start();

try {
  const result = await client.callTool('iris_detect_drift', {
    threshold: 0.3
  });
  console.log(result);
} finally {
  await client.stop();
}
```

### Pattern 3: CLI

```bash
npm run mcp:client iris_health_check
npm run mcp:client iris_evaluate_project '{"projectId": "nfl-predictor"}'
```

## Documentation

- **Quick Start**: [../docs/MCP_QUICK_START.md](../docs/MCP_QUICK_START.md)
- **Full Architecture**: [../docs/MCP_SERVER_ARCHITECTURE.md](../docs/MCP_SERVER_ARCHITECTURE.md)
- **IRIS Integration**: [../docs/IRIS_PRIME_SUPABASE_INTEGRATION.md](../docs/IRIS_PRIME_SUPABASE_INTEGRATION.md)

## Integration with Claude Desktop (Optional)

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "iris-prime": {
      "command": "tsx",
      "args": ["/path/to/src/mcp/iris-prime-mcp-server.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-key"
      }
    }
  }
}
```

## Key Benefits

| Benefit | Description |
|---------|-------------|
| **Context Efficiency** | Heavy operations don't consume Claude's context |
| **Performance** | MCP server can cache and optimize operations |
| **Separation** | AI logic separate from orchestration |
| **Scalability** | Can run remotely, scale independently |
| **Debugging** | Clear request/response logs |
| **Testing** | Test tools independently of Claude |

## Examples

See [../examples/mcp-usage-demo.ts](../examples/mcp-usage-demo.ts) for:

- Quick health checks
- Project evaluation
- Batch operations
- Auto-retrain workflows
- Pattern transfer workflows
- Reflexion analysis
- Consensus lineage tracking
- Complete IRIS evaluation

## License

MIT © FoxRuv
