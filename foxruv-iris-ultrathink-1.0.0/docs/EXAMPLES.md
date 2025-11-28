# UltraThink MCP Server - Examples

Comprehensive examples for using the UltraThink MCP Server.

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Swarm Management](#swarm-management)
3. [Agent Coordination](#agent-coordination)
4. [Task Orchestration](#task-orchestration)
5. [Pattern Learning](#pattern-learning)
6. [Memory Management](#memory-management)
7. [Advanced Patterns](#advanced-patterns)

## Basic Usage

### Starting the Server

```bash
# Standard startup
npm start

# Development mode with auto-reload
npm run start:dev

# With custom database path
ULTRATHINK_DB_PATH=/path/to/db npm start
```

### Health Check

```javascript
// Check server health
const health = await mcp.callTool('ultrathink_health_check', {
  detailed: true
});

console.log(health);
// {
//   status: "healthy",
//   timestamp: "2025-11-20T15:30:00.000Z",
//   services: {
//     mcp: true,
//     agenticFlow: true,
//     agentdb: true
//   },
//   metrics: {
//     uptime: 3600000,
//     totalRequests: 42,
//     activeSwarms: 2,
//     activeAgents: 8
//   }
// }
```

## Swarm Management

### Initialize Different Topologies

#### Mesh Topology (Peer-to-Peer)
```javascript
// Best for distributed coordination
await mcp.callTool('ultrathink_swarm_init', {
  swarmId: 'mesh-swarm',
  topology: 'mesh',
  maxAgents: 10,
  transport: 'quic'
});
```

#### Hierarchical Topology (Tree Structure)
```javascript
// Best for task decomposition
await mcp.callTool('ultrathink_swarm_init', {
  swarmId: 'hierarchy-swarm',
  topology: 'hierarchical',
  maxAgents: 8,
  transport: 'auto'
});
```

#### Ring Topology (Circular)
```javascript
// Best for sequential processing
await mcp.callTool('ultrathink_swarm_init', {
  swarmId: 'ring-swarm',
  topology: 'ring',
  maxAgents: 6
});
```

#### Star Topology (Centralized)
```javascript
// Best for centralized control
await mcp.callTool('ultrathink_swarm_init', {
  swarmId: 'star-swarm',
  topology: 'star',
  maxAgents: 5
});
```

### Monitor Swarm Status

```javascript
const status = await mcp.callTool('ultrathink_swarm_status', {
  swarmId: 'mesh-swarm'
});

console.log(status);
// {
//   swarmId: "mesh-swarm",
//   topology: "mesh",
//   agentCount: 5,
//   agents: [...],
//   status: "active"
// }
```

### Destroy Swarm

```javascript
await mcp.callTool('ultrathink_swarm_destroy', {
  swarmId: 'mesh-swarm'
});
```

## Agent Coordination

### Spawn Specialized Agents

#### Research Agent
```javascript
await mcp.callTool('ultrathink_agent_spawn', {
  swarmId: 'research-swarm',
  agentType: 'researcher',
  role: 'coordinator',
  capabilities: ['search', 'analyze', 'synthesize'],
  metadata: {
    expertise: 'machine-learning',
    priority: 'high'
  }
});
```

#### Coding Agent
```javascript
await mcp.callTool('ultrathink_agent_spawn', {
  swarmId: 'dev-swarm',
  agentType: 'coder',
  role: 'worker',
  capabilities: ['code', 'test', 'refactor'],
  metadata: {
    languages: ['typescript', 'python'],
    frameworks: ['node', 'django']
  }
});
```

#### Analyst Agent
```javascript
await mcp.callTool('ultrathink_agent_spawn', {
  swarmId: 'data-swarm',
  agentType: 'analyst',
  role: 'worker',
  capabilities: ['analyze', 'visualize', 'report'],
  metadata: {
    specialization: 'data-science'
  }
});
```

### List Active Agents

```javascript
// List all agents in swarm
const agents = await mcp.callTool('ultrathink_agent_list', {
  swarmId: 'research-swarm'
});

// Filter by type
const coders = await mcp.callTool('ultrathink_agent_list', {
  swarmId: 'dev-swarm',
  filterType: 'coder'
});
```

### Get Agent Metrics

```javascript
// All agents in swarm
const swarmMetrics = await mcp.callTool('ultrathink_agent_metrics', {
  swarmId: 'research-swarm'
});

// Specific agent
const agentMetrics = await mcp.callTool('ultrathink_agent_metrics', {
  swarmId: 'research-swarm',
  agentId: 'agent-123'
});
```

## Task Orchestration

### Simple Task

```javascript
const result = await mcp.callTool('ultrathink_task_orchestrate', {
  swarmId: 'dev-swarm',
  taskDescription: 'Analyze codebase for security vulnerabilities',
  priority: 'high',
  strategy: 'parallel'
});

console.log(result.task.taskId); // "task-1234567890"
```

### Complex Multi-Step Task

```javascript
// 1. Initialize specialized swarm
await mcp.callTool('ultrathink_swarm_init', {
  swarmId: 'full-stack-swarm',
  topology: 'hierarchical',
  maxAgents: 8
});

// 2. Spawn specialized agents
await Promise.all([
  mcp.callTool('ultrathink_agent_spawn', {
    swarmId: 'full-stack-swarm',
    agentType: 'backend-developer',
    role: 'worker',
    capabilities: ['nodejs', 'database', 'api']
  }),
  mcp.callTool('ultrathink_agent_spawn', {
    swarmId: 'full-stack-swarm',
    agentType: 'frontend-developer',
    role: 'worker',
    capabilities: ['react', 'ui', 'ux']
  }),
  mcp.callTool('ultrathink_agent_spawn', {
    swarmId: 'full-stack-swarm',
    agentType: 'tester',
    role: 'worker',
    capabilities: ['unit-test', 'integration-test']
  })
]);

// 3. Orchestrate complex task
const task = await mcp.callTool('ultrathink_task_orchestrate', {
  swarmId: 'full-stack-swarm',
  taskDescription: `
    Build a REST API with authentication:
    - Backend: Node.js with Express
    - Database: PostgreSQL with Prisma
    - Frontend: React with TypeScript
    - Testing: Jest and Playwright
    - Security: JWT authentication
  `,
  priority: 'critical',
  strategy: 'adaptive',
  maxAgents: 5
});

// 4. Monitor task progress
const status = await mcp.callTool('ultrathink_task_status', {
  taskId: task.task.taskId
});

// 5. Get results when complete
const results = await mcp.callTool('ultrathink_task_results', {
  taskId: task.task.taskId
});
```

### Execution Strategies

#### Parallel Execution
```javascript
// Best for independent subtasks
await mcp.callTool('ultrathink_task_orchestrate', {
  swarmId: 'analysis-swarm',
  taskDescription: 'Analyze multiple microservices concurrently',
  strategy: 'parallel',
  maxAgents: 6
});
```

#### Sequential Execution
```javascript
// Best for dependent subtasks
await mcp.callTool('ultrathink_task_orchestrate', {
  swarmId: 'deploy-swarm',
  taskDescription: 'Deploy application with database migrations',
  strategy: 'sequential'
});
```

#### Adaptive Execution
```javascript
// Best for dynamic optimization
await mcp.callTool('ultrathink_task_orchestrate', {
  swarmId: 'optimize-swarm',
  taskDescription: 'Optimize application performance',
  strategy: 'adaptive'
});
```

## Pattern Learning

### Record Successful Pattern

```javascript
await mcp.callTool('ultrathink_reflexion_record', {
  query: 'How to implement rate limiting in Express?',
  response: `
    Used express-rate-limit middleware with Redis store:
    - Sliding window algorithm for accuracy
    - Per-route customization
    - Graceful degradation without Redis
  `,
  outcome: 'success',
  reflection: `
    Sliding window is more accurate than fixed window.
    Redis provides distributed rate limiting.
    Important to handle Redis failures gracefully.
  `
});
```

### Record Failure Pattern

```javascript
await mcp.callTool('ultrathink_reflexion_record', {
  query: 'How to handle file uploads?',
  response: `
    Tried to store files directly in database as BLOB
  `,
  outcome: 'failure',
  reflection: `
    Storing files in database caused performance issues.
    Better approach: Store files in S3/object storage,
    save only metadata in database.
  `
});
```

### Discover Patterns

```javascript
// Find authentication patterns
const authPatterns = await mcp.callTool('ultrathink_pattern_discover', {
  domain: 'authentication',
  minConfidence: 0.7,
  limit: 5
});

// Find error handling patterns
const errorPatterns = await mcp.callTool('ultrathink_pattern_discover', {
  domain: 'error-handling',
  minConfidence: 0.8,
  limit: 10
});
```

### Apply Learned Pattern

```javascript
const result = await mcp.callTool('ultrathink_pattern_apply', {
  patternId: 'auth-jwt-pattern-123',
  taskContext: {
    framework: 'express',
    database: 'postgresql',
    requirements: ['stateless', 'scalable']
  }
});
```

### Search Similar Reflexions

```javascript
const similar = await mcp.callTool('ultrathink_reflexion_search', {
  query: 'database connection pooling strategies',
  limit: 5
});

similar.results.forEach(ref => {
  console.log(`${ref.query} -> ${ref.outcome}`);
  console.log(`Reflection: ${ref.reflection}`);
});
```

## Memory Management

### Store Technical Knowledge

```javascript
// Store code snippet
await mcp.callTool('ultrathink_memory_store', {
  content: `
    async function retryWithBackoff(fn, maxRetries = 3) {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === maxRetries - 1) throw error;
          await sleep(Math.pow(2, i) * 1000);
        }
      }
    }
  `,
  tags: ['nodejs', 'retry-logic', 'error-handling'],
  metadata: {
    language: 'javascript',
    category: 'utility-function'
  }
});

// Store architecture decision
await mcp.callTool('ultrathink_memory_store', {
  content: `
    Chose microservices architecture for scalability:
    - Each service owns its database (no shared DB)
    - Event-driven communication via message queue
    - API gateway for routing and authentication
  `,
  tags: ['architecture', 'microservices', 'scalability']
});

// Store debugging insight
await mcp.callTool('ultrathink_memory_store', {
  content: `
    Memory leak caused by event listener not being removed.
    Always call removeEventListener in cleanup/unmount.
  `,
  tags: ['debugging', 'memory-leak', 'javascript']
});
```

### Search Memories

```javascript
// Find relevant patterns
const memories = await mcp.callTool('ultrathink_memory_search', {
  query: 'error handling best practices',
  limit: 10,
  tags: ['error-handling']
});

// Find by specific technology
const nodeMemories = await mcp.callTool('ultrathink_memory_search', {
  query: 'async patterns',
  limit: 5,
  tags: ['nodejs', 'async']
});
```

### Consolidate Memories

```javascript
// Reduce redundancy in authentication domain
await mcp.callTool('ultrathink_memory_consolidate', {
  domain: 'authentication',
  threshold: 0.85
});

// Consolidate database-related memories
await mcp.callTool('ultrathink_memory_consolidate', {
  domain: 'database',
  threshold: 0.9
});
```

## Advanced Patterns

### Multi-Swarm Coordination

```javascript
// Initialize multiple specialized swarms
const swarms = await Promise.all([
  mcp.callTool('ultrathink_swarm_init', {
    swarmId: 'research-swarm',
    topology: 'mesh',
    maxAgents: 5
  }),
  mcp.callTool('ultrathink_swarm_init', {
    swarmId: 'dev-swarm',
    topology: 'hierarchical',
    maxAgents: 8
  }),
  mcp.callTool('ultrathink_swarm_init', {
    swarmId: 'qa-swarm',
    topology: 'star',
    maxAgents: 4
  })
]);

// Coordinate tasks across swarms
const results = await Promise.all([
  mcp.callTool('ultrathink_task_orchestrate', {
    swarmId: 'research-swarm',
    taskDescription: 'Research best practices',
    priority: 'high'
  }),
  mcp.callTool('ultrathink_task_orchestrate', {
    swarmId: 'dev-swarm',
    taskDescription: 'Implement features based on research',
    priority: 'high'
  }),
  mcp.callTool('ultrathink_task_orchestrate', {
    swarmId: 'qa-swarm',
    taskDescription: 'Test implemented features',
    priority: 'critical'
  })
]);
```

### Iterative Learning Loop

```javascript
async function learningLoop(task, maxIterations = 3) {
  let iteration = 0;
  let success = false;

  while (!success && iteration < maxIterations) {
    // Execute task
    const result = await mcp.callTool('ultrathink_task_orchestrate', {
      swarmId: 'learning-swarm',
      taskDescription: task,
      strategy: 'adaptive'
    });

    // Check if task completed successfully
    const status = await mcp.callTool('ultrathink_task_status', {
      taskId: result.task.taskId
    });

    success = status.status === 'completed';

    // Record reflexion
    await mcp.callTool('ultrathink_reflexion_record', {
      query: task,
      response: JSON.stringify(status.result),
      outcome: success ? 'success' : 'failure',
      reflection: success
        ? 'Task completed successfully'
        : `Iteration ${iteration + 1} failed, adjusting approach`
    });

    // Search for similar patterns to improve
    if (!success) {
      const patterns = await mcp.callTool('ultrathink_reflexion_search', {
        query: task,
        limit: 3
      });

      console.log('Learning from similar patterns:', patterns);
    }

    iteration++;
  }

  return success;
}

// Use the learning loop
await learningLoop('Optimize database queries for performance');
```

### Memory-Augmented Development

```javascript
async function developWithMemory(feature) {
  // 1. Search for relevant patterns
  const patterns = await mcp.callTool('ultrathink_memory_search', {
    query: feature,
    limit: 5
  });

  console.log('Found relevant patterns:', patterns);

  // 2. Search for successful implementations
  const reflexions = await mcp.callTool('ultrathink_reflexion_search', {
    query: feature,
    limit: 5
  });

  console.log('Found similar implementations:', reflexions);

  // 3. Implement with learned knowledge
  const result = await mcp.callTool('ultrathink_task_orchestrate', {
    swarmId: 'dev-swarm',
    taskDescription: `
      Implement: ${feature}

      Use these learned patterns:
      ${JSON.stringify(patterns, null, 2)}

      Learn from these implementations:
      ${JSON.stringify(reflexions, null, 2)}
    `,
    strategy: 'adaptive'
  });

  // 4. Record new knowledge
  await mcp.callTool('ultrathink_memory_store', {
    content: JSON.stringify(result),
    tags: ['implementation', feature],
    metadata: { feature, timestamp: new Date() }
  });

  return result;
}

// Use memory-augmented development
await developWithMemory('user authentication with OAuth2');
```

### Performance Monitoring

```javascript
async function monitorPerformance() {
  // Get overall metrics
  const metrics = await mcp.callTool('ultrathink_metrics_get', {
    category: 'all',
    timeRange: '24h'
  });

  console.log('System Metrics:', metrics);

  // Get tool statistics
  const toolStats = await mcp.callTool('ultrathink_tool_stats', {});

  console.log('Tool Usage:', toolStats);

  // Check health
  const health = await mcp.callTool('ultrathink_health_check', {
    detailed: true
  });

  console.log('Health Status:', health);

  // Get agent metrics for each swarm
  const swarms = ['research-swarm', 'dev-swarm', 'qa-swarm'];
  for (const swarmId of swarms) {
    const agentMetrics = await mcp.callTool('ultrathink_agent_metrics', {
      swarmId
    });
    console.log(`${swarmId} Metrics:`, agentMetrics);
  }
}

// Run monitoring every hour
setInterval(monitorPerformance, 60 * 60 * 1000);
```

## Best Practices

1. **Initialize swarms early**: Set up swarms before spawning agents
2. **Use appropriate topology**: Match topology to coordination pattern
3. **Tag memories consistently**: Use consistent tags for better retrieval
4. **Record both successes and failures**: Learn from all outcomes
5. **Consolidate regularly**: Prevent memory bloat with consolidation
6. **Monitor performance**: Track metrics to identify bottlenecks
7. **Clean up resources**: Destroy swarms when no longer needed
8. **Use semantic queries**: Search with natural language for better results

## Troubleshooting

### Task Hanging
```javascript
// Check task status
const status = await mcp.callTool('ultrathink_task_status', {
  taskId: 'task-123'
});

// Check agent metrics
const metrics = await mcp.callTool('ultrathink_agent_metrics', {
  swarmId: 'my-swarm'
});
```

### Poor Pattern Quality
```javascript
// Increase confidence threshold
const patterns = await mcp.callTool('ultrathink_pattern_discover', {
  domain: 'my-domain',
  minConfidence: 0.9  // Higher threshold
});
```

### Memory Not Found
```javascript
// Broaden search
const results = await mcp.callTool('ultrathink_memory_search', {
  query: 'broader search terms',
  limit: 20,
  tags: [] // No tag filter
});
```

## More Examples

See the [test directory](../tests/) for comprehensive integration tests and more examples.
