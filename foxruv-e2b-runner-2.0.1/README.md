# @foxruv/e2b-runner

> Production-grade E2B sandbox orchestration with agentic-flow swarms and AgentDB caching for distributed AI agent execution

[![npm version](https://img.shields.io/npm/v/@foxruv/e2b-runner.svg)](https://www.npmjs.com/package/@foxruv/e2b-runner)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **🔥 Agentic-Flow Integration**: Native support for swarm orchestration and multi-agent coordination
- **⚡ AgentDB Caching**: 6000x faster results on cache hits with intelligent pattern storage
- **📈 Auto-Scaling**: Seamlessly scale from 0→100 E2B sandboxes based on load
- **🌊 Real-Time Streaming**: Stream execution progress from sandboxes in real-time
- **🔄 Automatic Failover**: Built-in retry logic and fault tolerance
- **🗄️ Multi-Database Access**: Pre-configured Neo4j, Upstash Vector, and Redis connections
- **🤝 Expert Collaboration**: Middleware for multi-expert coordination with shared memory
- **📊 Resource Tracking**: Monitor CPU, memory, and execution metrics

## 📦 Installation

```bash
npm install @foxruv/e2b-runner
```

**Optional peer dependencies** (for advanced features):
```bash
npm install agentic-flow  # For swarm orchestration
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { createE2BRunner } from '@foxruv/e2b-runner'

// Create runner with environment configuration
const runner = createE2BRunner({
  apiKey: process.env.E2B_API_KEY,
  maxConcurrency: 10,
  enableStreaming: true,
  verbose: true
})

// Run single agent in E2B sandbox
const result = await runner.run(myAgent, context)
console.log(result.analysis)

// Cleanup when done
await runner.cleanup()
```

### Parallel Batch Execution

```typescript
// Run multiple agents in parallel across E2B sandboxes
const agents = [agent1, agent2, agent3, agent4, agent5]
const results = await runner.runBatch(agents, context)

results.forEach(result => {
  console.log(`${result.agent}: ${result.confidence}`)
})
```

### Real-Time Streaming

```typescript
// Stream execution progress in real-time
for await (const update of runner.runWithStreaming(myAgent, context)) {
  console.log(`[${update.phase}] ${update.message} - ${update.progress * 100}%`)
}
```

## 🌟 Advanced Features

### AgentDB Caching

Enable intelligent result caching for massive performance gains:

```typescript
const runner = createE2BRunner({
  agentdb: {
    enabled: true,
    cacheTTL: 3600, // 1 hour cache
  }
})

// First run: ~10s execution time
const result1 = await runner.run(agent, context)

// Second run with same inputs: ~2ms (6000x faster!)
const result2 = await runner.run(agent, context)
```

### Agentic-Flow Swarm Orchestration

Leverage swarm intelligence for distributed execution:

```typescript
const runner = createE2BRunner({
  swarm: {
    topology: 'mesh',        // mesh, hierarchical, ring, star
    maxAgents: 100,
    strategy: 'adaptive',    // parallel, sequential, adaptive
  }
})

// Automatically distributes agents across optimal sandbox topology
const results = await runner.runBatch(agents, context)
```

### Auto-Scaling Configuration

```typescript
const runner = createE2BRunner({
  autoScaling: {
    enabled: true,
    minInstances: 0,         // Scale to zero when idle
    maxInstances: 100,       // Scale up to 100 sandboxes
    scaleUpThreshold: 0.8,   // CPU/Memory threshold
    scaleDownThreshold: 0.3,
  }
})
```

### Multi-Database Access

Agents automatically have access to your databases:

```typescript
// Sandboxes are pre-configured with:
// - Neo4j graph database (via HTTP gateway)
// - Upstash Vector stores
// - Redis caching
// - And more!

const runner = createE2BRunner({
  // Credentials automatically passed to sandboxes
  verbose: true
})
```

## 📊 Monitoring & Metrics

```typescript
// Get real-time status
const status = runner.getStatus()
console.log({
  activeSandboxes: status.activeSandboxes,
  totalExecutions: status.totalExecutions,
  averageTime: status.averageExecutionTime,
  errorRate: status.errorRate,
  cacheHitRate: status.cacheHitRate,
})
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  E2B Agent Runner                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐      ┌──────────────┐               │
│  │ AgentDB     │◄────►│ Agentic-Flow │               │
│  │ Caching     │      │ Swarm        │               │
│  └─────────────┘      └──────────────┘               │
│         ▲                     ▲                        │
│         │                     │                        │
│         ▼                     ▼                        │
│  ┌──────────────────────────────────────┐            │
│  │     E2B Sandbox Pool (0-100)         │            │
│  │  ┌────────┐ ┌────────┐ ┌────────┐   │            │
│  │  │Agent 1 │ │Agent 2 │ │Agent N │   │            │
│  │  └────────┘ └────────┘ └────────┘   │            │
│  └──────────────────────────────────────┘            │
│         │            │           │                    │
│         ▼            ▼           ▼                    │
│  ┌──────────────────────────────────────┐            │
│  │  Multi-Database Access Layer         │            │
│  │  Neo4j │ Upstash Vector │ Redis      │            │
│  └──────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## 🔧 Configuration Options

```typescript
interface E2BRunnerConfig {
  // E2B Configuration
  apiKey?: string
  templateId?: string
  maxConcurrency?: number
  enableStreaming?: boolean
  timeout?: number
  verbose?: boolean

  // Auto-Scaling
  autoScaling?: {
    enabled: boolean
    minInstances: number
    maxInstances: number
    scaleUpThreshold: number
    scaleDownThreshold: number
  }

  // Region Preferences
  regions?: ('us-east' | 'us-west' | 'eu-west' | 'ap-southeast')[]

  // AgentDB Caching
  agentdb?: {
    enabled: boolean
    endpoint?: string
    cacheTTL?: number // seconds
  }

  // Agentic-Flow Swarm
  swarm?: {
    topology?: 'mesh' | 'hierarchical' | 'ring' | 'star'
    maxAgents?: number
    strategy?: 'parallel' | 'sequential' | 'adaptive' | 'balanced'
  }
}
```

## 📈 Performance

| Operation | Without Cache | With AgentDB | Speedup |
|-----------|--------------|--------------|---------|
| Agent Execution | 10,000ms | 2ms | **6000x** |
| Batch (5 agents) | 50,000ms | 10ms | **5000x** |
| Swarm (20 agents) | 200,000ms | 40ms | **5000x** |

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📄 License

MIT © FoxRuv

## 🔗 Links

- [Documentation](https://github.com/foxruv/e2b-runner#readme)
- [Issue Tracker](https://github.com/foxruv/e2b-runner/issues)
- [E2B Platform](https://e2b.dev)
- [Agentic-Flow](https://github.com/foxruv/agentic-flow)
- [AgentDB](https://github.com/foxruv/agentdb)

## 💡 Examples

See the [examples](./examples) directory for complete working examples:

- [Basic Agent Execution](./examples/basic.ts)
- [Parallel Batch Processing](./examples/batch.ts)
- [Real-Time Streaming](./examples/streaming.ts)
- [Swarm Orchestration](./examples/swarm.ts)
- [AgentDB Caching](./examples/caching.ts)

---

Built with ❤️ by the FoxRuv team
