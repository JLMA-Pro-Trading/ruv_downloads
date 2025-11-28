# UltraThink MCP Server

**Standalone Model Context Protocol server with agentic-flow and agentdb integration**

## Overview

UltraThink MCP Server is a production-ready MCP server that provides:

- **Swarm Coordination**: Multi-agent orchestration with flexible topologies
- **Pattern Learning**: Automatic pattern discovery and application using AgentDB
- **Memory Persistence**: Long-term memory with vector search capabilities
- **Tool Tracking**: Comprehensive metrics and invocation tracking
- **Health Monitoring**: Built-in health checks and performance metrics

## Architecture

```
packages/ultrathink/src/server/
├── server.ts      # Main MCP server with lifecycle management
├── types.ts       # TypeScript type definitions
├── tools.ts       # Tool schemas and definitions
└── handlers.ts    # Tool implementation with integrations
```

## Features

### 1. Swarm Management
- Initialize swarms with different topologies (mesh, hierarchical, ring, star)
- QUIC and HTTP/2 transport support
- Dynamic agent spawning and coordination
- Real-time swarm status monitoring

### 2. Agent Coordination
- Spawn specialized agents with custom capabilities
- Agent metrics and performance tracking
- Multi-agent task orchestration
- Adaptive execution strategies

### 3. Task Orchestration
- Parallel, sequential, and adaptive task execution
- Priority-based task scheduling
- Task status tracking and results retrieval
- Pattern learning from task outcomes

### 4. Pattern Learning (AgentDB)
- Automatic pattern discovery from successful executions
- Pattern application to new tasks
- Reflexion-based learning with self-critique
- Confidence-based pattern filtering

### 5. Memory Management
- Vector-based semantic search
- Memory consolidation to reduce redundancy
- Tag-based memory organization
- Embedding generation and storage

### 6. Health & Metrics
- Server health status monitoring
- Performance metrics collection
- Tool invocation statistics
- Resource usage tracking

## Tool Categories

### Swarm Tools (3)
- `ultrathink_swarm_init` - Initialize multi-agent swarm
- `ultrathink_swarm_status` - Get swarm status and metrics
- `ultrathink_swarm_destroy` - Shutdown swarm gracefully

### Agent Tools (3)
- `ultrathink_agent_spawn` - Spawn specialized agent
- `ultrathink_agent_list` - List active agents
- `ultrathink_agent_metrics` - Get agent performance metrics

### Task Tools (3)
- `ultrathink_task_orchestrate` - Orchestrate complex tasks
- `ultrathink_task_status` - Check task execution status
- `ultrathink_task_results` - Get task completion results

### Learning Tools (4)
- `ultrathink_pattern_discover` - Discover learned patterns
- `ultrathink_pattern_apply` - Apply patterns to new tasks
- `ultrathink_reflexion_record` - Record reflexion for learning
- `ultrathink_reflexion_search` - Search similar reflexions

### Memory Tools (3)
- `ultrathink_memory_store` - Store memory with embeddings
- `ultrathink_memory_search` - Vector-based memory search
- `ultrathink_memory_consolidate` - Consolidate related memories

### Health Tools (3)
- `ultrathink_health_check` - Server health status
- `ultrathink_metrics_get` - Performance metrics
- `ultrathink_tool_stats` - Tool invocation statistics

**Total: 19 tools**

## Integration Details

### Agentic-Flow Integration

```typescript
// Initialize swarm with QUIC transport
const swarm = await agenticFlow.initSwarm({
  swarmId: 'my-swarm',
  topology: 'mesh',
  maxAgents: 8,
  transport: 'quic'
});

// Spawn specialized agents
await agenticFlow.spawnAgent('my-swarm', {
  id: 'agent-1',
  type: 'researcher',
  role: 'worker',
  capabilities: ['analyze', 'synthesize']
});

// Orchestrate complex task
await agenticFlow.orchestrateTask('my-swarm', {
  taskId: 'task-1',
  description: 'Analyze codebase and generate report',
  priority: 'high',
  strategy: 'adaptive'
});
```

### AgentDB Integration

```typescript
// Record reflexion for learning
await agentDB.recordReflexion({
  query: 'Implement authentication',
  response: 'Used JWT with bcrypt',
  outcome: 'success',
  reflection: 'Pattern worked well for stateless auth'
});

// Discover patterns
const patterns = await agentDB.discoverPatterns('authentication', 0.7);

// Store and search memories
const memoryId = await agentDB.storeMemory({
  content: 'JWT token validation logic',
  tags: ['auth', 'security']
});

const results = await agentDB.searchMemories('authentication patterns', 10);
```

## Usage

### Starting the Server

```bash
# From package directory
npm start

# Or with custom configuration
ULTRATHINK_DB_PATH=/path/to/db.sqlite npm start
```

### Using with Claude Desktop

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "ultrathink": {
      "command": "node",
      "args": ["/path/to/packages/ultrathink/src/server/server.ts"],
      "env": {
        "ULTRATHINK_DB_PATH": "./data/ultrathink.db"
      }
    }
  }
}
```

### Example Workflows

#### 1. Multi-Agent Research

```javascript
// Initialize research swarm
ultrathink_swarm_init({
  swarmId: "research-swarm",
  topology: "hierarchical",
  maxAgents: 5
})

// Spawn specialized agents
ultrathink_agent_spawn({
  swarmId: "research-swarm",
  agentType: "researcher",
  role: "coordinator",
  capabilities: ["coordinate", "synthesize"]
})

ultrathink_agent_spawn({
  swarmId: "research-swarm",
  agentType: "analyst",
  role: "worker",
  capabilities: ["analyze", "extract"]
})

// Orchestrate research task
ultrathink_task_orchestrate({
  swarmId: "research-swarm",
  taskDescription: "Research AI safety best practices",
  priority: "high",
  strategy: "adaptive"
})
```

#### 2. Pattern Learning from Tasks

```javascript
// Execute task and record outcome
ultrathink_task_orchestrate({
  swarmId: "dev-swarm",
  taskDescription: "Implement rate limiting",
  strategy: "sequential"
})

// Record reflexion
ultrathink_reflexion_record({
  query: "How to implement rate limiting",
  response: "Used Redis with sliding window algorithm",
  outcome: "success",
  reflection: "Sliding window provides better accuracy than fixed window"
})

// Discover patterns for future use
ultrathink_pattern_discover({
  domain: "rate-limiting",
  minConfidence: 0.7
})
```

#### 3. Memory-Augmented Agents

```javascript
// Store technical knowledge
ultrathink_memory_store({
  content: "Use async/await for Node.js async operations",
  tags: ["nodejs", "async", "best-practices"]
})

// Search relevant memories during task
ultrathink_memory_search({
  query: "nodejs async patterns",
  limit: 5,
  tags: ["nodejs", "async"]
})

// Apply learned patterns
ultrathink_pattern_apply({
  patternId: "async-pattern-123",
  taskContext: {
    language: "javascript",
    framework: "nodejs"
  }
})
```

## Design Principles

### 1. Lazy Initialization
Services are initialized on first use to minimize startup time and resource consumption.

### 2. Graceful Degradation
If optional dependencies (agentic-flow, agentdb) fail to load, the server continues with reduced functionality.

### 3. Comprehensive Tracking
Every tool invocation is tracked with:
- Invocation ID and timestamp
- Arguments and results
- Success/failure status
- Execution duration

### 4. Error Handling
- Typed error classes for different error categories
- McpError for MCP protocol errors
- Detailed error messages with context

### 5. Extensibility
- Modular tool system for easy addition of new tools
- Handler pattern for clean separation of concerns
- Type-safe interfaces throughout

## Performance Characteristics

- **Startup Time**: <100ms (lazy initialization)
- **Tool Invocation**: <50ms (excluding handler logic)
- **Memory Footprint**: ~50MB (base) + handler state
- **Concurrent Requests**: Limited by Node.js event loop

## Security Considerations

1. **Input Validation**: All tool arguments are validated
2. **SQL Injection**: AgentDB uses parameterized queries
3. **Resource Limits**: Configurable limits on agents and tasks
4. **Error Masking**: Sensitive details not exposed in errors

## Future Enhancements

- [ ] Distributed swarm coordination across multiple servers
- [ ] Real-time streaming of task progress
- [ ] Advanced pattern transfer learning
- [ ] Multi-tenancy support
- [ ] Persistent swarm state across restarts
- [ ] WebSocket transport for real-time updates
- [ ] GraphQL API for complex queries
- [ ] Advanced analytics and visualization

## Dependencies

**Required:**
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- Node.js >= 18.0.0

**Optional (runtime):**
- `agentic-flow` - For swarm coordination
- `agentdb` - For pattern learning and memory

## Troubleshooting

### Server won't start
- Check Node.js version (>= 18.0.0)
- Verify MCP SDK is installed
- Check ULTRATHINK_DB_PATH permissions

### Tools returning errors
- Check tool invocation tracking: `ultrathink_tool_stats`
- Review server logs for detailed error messages
- Verify required dependencies are installed

### Performance issues
- Monitor metrics: `ultrathink_metrics_get`
- Check active swarms and agents
- Review memory usage and consolidate if needed

### Learning not working
- Verify AgentDB is initialized (check logs)
- Ensure sufficient training data
- Adjust confidence thresholds

## Contributing

When adding new tools:

1. Define schema in `tools.ts`
2. Implement handler in `handlers.ts`
3. Add types to `types.ts` if needed
4. Update this documentation

## License

MIT

## Contact

For issues and questions, please open a GitHub issue in the parent repository.
