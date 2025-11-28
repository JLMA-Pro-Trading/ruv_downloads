# UltraThink MCP Server

**Standalone Model Context Protocol server with agentic-flow and agentdb integration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Overview

UltraThink is a production-ready MCP server that provides advanced multi-agent coordination, pattern learning, and memory management capabilities. It integrates seamlessly with agentic-flow for swarm coordination and agentdb for persistent learning.

## Features

- 🤖 **Swarm Management**: Initialize and coordinate multi-agent swarms with flexible topologies
- 🧠 **Pattern Learning**: Automatic discovery and application of successful patterns
- 💾 **Memory Persistence**: Vector-based semantic search with long-term memory
- 📊 **Metrics & Monitoring**: Comprehensive health checks and performance tracking
- 🔧 **Modular Design**: Extensible tool system for custom functionality
- ⚡ **High Performance**: QUIC transport with lazy initialization
- 🔍 **Zero-Config Context Detection**: Auto-detect project, user, git, and environment info

## Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ultrathink": {
      "command": "node",
      "args": ["/path/to/packages/ultrathink/dist/server/server.js"],
      "env": {
        "ULTRATHINK_DB_PATH": "./data/ultrathink.db"
      }
    }
  }
}
```

### Basic Example

#### MCP Server Usage

```javascript
// Initialize a mesh swarm
await mcp.callTool('ultrathink_swarm_init', {
  swarmId: 'my-swarm',
  topology: 'mesh',
  maxAgents: 8
});

// Spawn a researcher agent
await mcp.callTool('ultrathink_agent_spawn', {
  swarmId: 'my-swarm',
  agentType: 'researcher',
  role: 'coordinator',
  capabilities: ['search', 'analyze', 'synthesize']
});

// Orchestrate a task
const result = await mcp.callTool('ultrathink_task_orchestrate', {
  swarmId: 'my-swarm',
  taskDescription: 'Research best practices for microservices',
  priority: 'high',
  strategy: 'adaptive'
});
```

#### Context Detection Usage

```typescript
import { getOrDetectContext } from '@foxruv/iris-ultrathink';

// Auto-detect all context (zero-config!)
const context = await getOrDetectContext();

console.log(context);
// {
//   projectId: 'my-app',
//   projectName: '@company/my-app',
//   userId: 'user@example.com',
//   userName: 'John Doe',
//   gitBranch: 'main',
//   gitCommit: 'abc1234',
//   hostname: 'dev-machine',
//   platform: 'linux-x64',
//   nodeVersion: 'v20.0.0'
// }
```

See [Context Detection Documentation](./docs/CONTEXT_DETECTION.md) for more details.

## Available Tools (19 Total)

### Swarm Management (3)
- `ultrathink_swarm_init` - Initialize multi-agent swarm
- `ultrathink_swarm_status` - Get swarm status and metrics
- `ultrathink_swarm_destroy` - Shutdown swarm gracefully

### Agent Management (3)
- `ultrathink_agent_spawn` - Spawn specialized agent
- `ultrathink_agent_list` - List active agents
- `ultrathink_agent_metrics` - Get agent performance metrics

### Task Orchestration (3)
- `ultrathink_task_orchestrate` - Orchestrate complex tasks
- `ultrathink_task_status` - Check task execution status
- `ultrathink_task_results` - Get task completion results

### Pattern Learning (4)
- `ultrathink_pattern_discover` - Discover learned patterns
- `ultrathink_pattern_apply` - Apply patterns to new tasks
- `ultrathink_reflexion_record` - Record reflexion for learning
- `ultrathink_reflexion_search` - Search similar reflexions

### Memory Management (3)
- `ultrathink_memory_store` - Store memory with embeddings
- `ultrathink_memory_search` - Vector-based memory search
- `ultrathink_memory_consolidate` - Consolidate related memories

### Health & Monitoring (3)
- `ultrathink_health_check` - Server health status
- `ultrathink_metrics_get` - Performance metrics
- `ultrathink_tool_stats` - Tool invocation statistics

## Documentation

- [Complete Documentation](./docs/MCP_SERVER.md)
- [Usage Examples](./docs/EXAMPLES.md)
- [Context Detection](./docs/CONTEXT_DETECTION.md)
- [Architecture Overview](./docs/MCP_SERVER.md#architecture)

## Architecture

```
packages/ultrathink/
├── src/
│   ├── server/
│   │   ├── server.ts      # Main MCP server
│   │   ├── types.ts       # Type definitions
│   │   ├── tools.ts       # Tool schemas
│   │   ├── handlers.ts    # Tool implementations
│   │   └── index.ts       # Module exports
│   ├── utils/
│   │   ├── types.ts           # Context type definitions
│   │   ├── project-detector.ts # Package.json detection
│   │   ├── user-detector.ts    # User info detection
│   │   ├── git-detector.ts     # Git repo detection
│   │   ├── context-detector.ts # Main orchestrator
│   │   └── index.ts            # Utility exports
│   └── cli/               # CLI utilities
├── docs/
│   ├── MCP_SERVER.md          # Full documentation
│   ├── EXAMPLES.md            # Usage examples
│   └── CONTEXT_DETECTION.md   # Context detection guide
├── examples/
│   ├── simple-usage.ts             # Quick start example
│   └── context-detection-demo.ts   # Comprehensive demo
└── tests/                 # Test suite
```

## Key Integrations

### Agentic-Flow
Provides swarm coordination with:
- Multiple topology support (mesh, hierarchical, ring, star)
- QUIC and HTTP/2 transport protocols
- Dynamic agent spawning
- Task orchestration

### AgentDB
Enables pattern learning through:
- Reflexion memory with self-critique
- Vector-based semantic search
- Pattern discovery and application
- Memory consolidation

## Development

```bash
# Development mode with auto-reload
npm run start:dev

# Type checking
npm run typecheck

# Run tests
npm test

# Lint code
npm run lint
```

## Configuration

Environment variables:

- `ULTRATHINK_DB_PATH` - Database path (default: `./data/ultrathink.db`)
- `NODE_ENV` - Environment mode (`development` or `production`)

## Performance

- **Startup Time**: <100ms (lazy initialization)
- **Tool Invocation**: <50ms (excluding handler logic)
- **Memory Footprint**: ~50MB (base) + handler state
- **Concurrent Requests**: Node.js event loop limited

## Troubleshooting

### Server won't start
- Verify Node.js >= 18.0.0: `node --version`
- Check MCP SDK installation: `npm list @modelcontextprotocol/sdk`
- Review startup logs for errors

### Tools returning errors
- Check tool stats: `ultrathink_tool_stats`
- Review detailed health: `ultrathink_health_check { detailed: true }`
- Verify dependencies are installed

### Performance issues
- Monitor metrics: `ultrathink_metrics_get`
- Check active resources
- Consolidate memories if high usage

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License - see [LICENSE](../../LICENSE) file for details

## Support

- Issues: [GitHub Issues](https://github.com/your-org/agent-learning-core/issues)
- Documentation: [docs/](./docs/)
- Examples: [docs/EXAMPLES.md](./docs/EXAMPLES.md)

## Credits

Built on top of:
- [agentic-flow](https://github.com/ruvnet/agentic-flow) - Multi-agent coordination
- [agentdb](https://github.com/ruvnet/agentdb) - Pattern learning and memory
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP protocol

---

**UltraThink** - Empowering AI agents with swarm intelligence and persistent learning.
