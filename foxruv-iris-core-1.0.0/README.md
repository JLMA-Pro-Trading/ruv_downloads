# @iris/core

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)
![Tests](https://img.shields.io/badge/tests-118%20passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)
![Bundle Size](https://img.shields.io/badge/bundle-154KB-success.svg)

**Core orchestration and multi-provider LM management for Iris AI**

[Features](#-features) • [Installation](#-installation) • [Quick Start](#-quick-start) • [API](#-api) • [Migration](#-migration-guide)

</div>

---

## 🎯 Overview

`@iris/core` is the **modular core package** extracted from the Iris monolith, providing:

- 🤖 **Intelligent Orchestration** - AI operations management with drift detection and auto-retraining
- 🔌 **Multi-Provider Support** - Claude Sonnet 4.5, Qwen3, and extensible LM providers
- 📊 **Performance Tracking** - Built-in metrics, health scoring, and optimization
- 🧪 **Production Ready** - 99% test coverage, TypeScript strict mode, zero dependencies
- 🚀 **Lightweight** - 154KB bundle, sub-2s build time, ESM + CJS dual output

---

## ✨ Features

### 🎛️ Orchestration Engine

- **Project Health Evaluation** - Real-time monitoring with drift detection
- **Auto-Retraining** - Intelligent expert rotation based on performance
- **Prompt Auto-Promotion** - Best-in-class signature discovery and deployment
- **Pattern Discovery** - Cross-project knowledge transfer
- **Consensus Tracking** - Version lineage and rotation recommendations

### 🔌 Provider Management

**Supported Providers:**
- **Anthropic Claude** - Claude Sonnet 4.5 (production default)
- **Qwen3** - Local LM Studio / OpenAI-compatible endpoints
- **Extensible** - Easy custom provider integration

**Provider Features:**
- Environment-based configuration
- Performance tracking (latency, success rate, quality)
- Provider switching and failover
- Batch processing with concurrency control (5x throughput)

### 📦 Package Features

- **Zero External Dependencies** - Pure Node.js implementation
- **TypeScript First** - Full type safety with strict mode
- **Dual Module Support** - ESM and CJS outputs
- **Comprehensive Tests** - 118 tests, 99% coverage
- **Fast Builds** - <2s compilation time
- **Small Bundle** - 154KB total size

---

## 📥 Installation

```bash
npm install @iris/core
```

**Requirements:**
- Node.js 18+ (ESM support)
- TypeScript 5.6+ (for development)

---

## 🚀 Quick Start

### Basic Orchestrator Usage

```typescript
import { createIrisOrchestrator } from '@foxruv/iris-core'

// Create orchestrator instance
const iris = createIrisOrchestrator({
  dbBasePath: './data/iris',
  defaultAutoRetrain: true,
  defaultAutoPromote: true
})

// Configure project
iris.configureProject({
  projectId: 'my-project',
  autoRetrain: true,
  autoPromote: true,
  retrainingThreshold: 0.1, // 10% accuracy drop
  promotionThreshold: 0.1,  // 10% improvement
  minEvaluations: 10
})

// Evaluate project health
const report = await iris.evaluateProject('my-project')

console.log(`Health Score: ${report.healthScore}/100`)
console.log(`Status: ${report.overallHealth}`)
console.log(`Drift Alerts: ${report.driftAlerts.length}`)
console.log(`Recommendations: ${report.recommendedActions.length}`)

// Auto-promote better prompts
const promoted = await iris.autoPromotePrompts('my-project')
console.log(`Promoted ${promoted.length} experts`)

// Auto-retrain drifting experts
const retrained = await iris.autoRetrainExperts('my-project')
console.log(`Retrained ${retrained.length} experts`)

// Clean up
iris.close()
```

### Provider Usage

#### Claude Provider

```typescript
import { ClaudeProvider } from '@foxruv/iris-core/providers'

const provider = new ClaudeProvider(
  process.env.ANTHROPIC_API_KEY,
  'claude-sonnet-4-5-20250929'
)

const signature = {
  instructions: 'Classify sentiment as positive, negative, or neutral',
  input: { text: 'Input text to classify' },
  output: { sentiment: 'Sentiment classification' }
}

const result = await provider.predict(
  signature,
  { text: 'I love this product!' },
  undefined, // custom instructions (optional)
  0.0,       // temperature
  1024       // max tokens
)

console.log(result) // { sentiment: "positive" }
```

#### Qwen3 Provider (Local LM)

```typescript
import { Qwen3Provider } from '@foxruv/iris-core/providers'

const provider = new Qwen3Provider(
  'http://localhost:1234',      // LM Studio endpoint
  'qwen2.5-32b-instruct',       // model name
  5                              // max concurrent requests
)

// Single prediction
const result = await provider.predict(signature, input)

// Batch predictions (5x throughput)
const results = await provider.batchPredict(
  signature,
  [input1, input2, input3, ...],
  undefined,  // custom instructions
  0.3,        // temperature
  2048        // max tokens
)

// Batch with retry (auto-recover from failures)
const results = await provider.batchPredictWithRetry(
  signature,
  inputs,
  undefined,
  0.3,
  2048,
  2  // max retries per prediction
)

// Health check
const isHealthy = await provider.healthCheck()
```

#### Provider Manager

```typescript
import { getLMProvider } from '@foxruv/iris-core/providers'

// Auto-detect provider from environment
const manager = getLMProvider()
const provider = manager.getProvider()

// Get performance metrics
const metrics = manager.getPerformanceMetrics('anthropic')
console.log(`Latency: ${metrics.averageLatencyMs}ms`)
console.log(`Success Rate: ${metrics.successRate * 100}%`)

// Compare all providers
const comparison = manager.compareProviders()
console.log(`Fastest: ${comparison.fastest}`)
console.log(`Most Reliable: ${comparison.mostReliable}`)

// Switch providers
manager.switchProvider('lmstudio')
```

### Utility Functions

```typescript
import { calculateHealthScore, getHealthLevel, incrementVersion } from '@foxruv/iris-core'

// Calculate health score
const score = calculateHealthScore({
  driftAlerts: 2,
  staleReflexions: 5,
  avgValidity: 0.8,
  highPriorityRotations: 1
})
console.log(score) // 47 (0-100)

// Get health level
const level = getHealthLevel(score)
console.log(level) // "poor"

// Increment version
const newVersion = incrementVersion('v1.0.5')
console.log(newVersion) // "v1.0.6"
```

---

## 📚 API Reference

### Core Orchestrator

#### `createIrisOrchestrator(config?): IrisOrchestrator`

Creates a new Iris orchestrator instance.

**Config:**
```typescript
interface IrisPrimeConfig {
  dbBasePath?: string              // Default: './data/iris'
  defaultAutoRetrain?: boolean     // Default: false
  defaultAutoPromote?: boolean     // Default: false
  scheduleIntervalMs?: number      // Default: 86400000 (24h)
  logPath?: string                 // Default: './logs'
  notifiers?: IrisNotifier[]       // Default: []
}
```

#### `IrisOrchestrator.evaluateProject(projectId): Promise<IrisReport>`

Evaluates a project's health and returns a comprehensive report.

**Returns:**
```typescript
interface IrisReport {
  projectId: string
  timestamp: Date
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  healthScore: number // 0-100
  driftAlerts: DriftAlert[]
  promptRecommendations: PromptRecommendation[]
  reflexionStatus: ReflexionStatus
  rotationRecommendations: RotationRecommendation[]
  transferablePatterns: TransferablePattern[]
  recommendedActions: RecommendedAction[]
}
```

### Providers

#### `ClaudeProvider`

Anthropic Claude API wrapper with fetch-based implementation.

**Methods:**
- `predict(signature, input, customInstructions?, temperature?, maxTokens?): Promise<Record<string, any>>`

#### `Qwen3Provider`

OpenAI-compatible local model provider with concurrency control.

**Methods:**
- `predict(signature, input, customInstructions?, temperature?, maxTokens?, schema?): Promise<Record<string, any>>`
- `batchPredict(signature, inputs, customInstructions?, temperature?, maxTokens?): Promise<Array<Record<string, any>>>`
- `batchPredictWithRetry(signature, inputs, customInstructions?, temperature?, maxTokens?, maxRetries?): Promise<Array<Record<string, any>>>`
- `healthCheck(): Promise<boolean>`

#### `LMProviderManager`

Multi-provider orchestration with performance tracking.

**Methods:**
- `getProvider(): any`
- `getProviderByName(name): any | undefined`
- `getAvailableProviders(): ModelProvider[]`
- `switchProvider(provider): void`
- `recordPerformance(provider, latencyMs, success, qualityScore?): void`
- `getPerformanceMetrics(provider?): PerformanceMetrics | PerformanceMetrics[]`
- `compareProviders(): ProviderComparison`

### Utility Functions

- `calculateHealthScore(factors): number` - Calculate health score (0-100)
- `getHealthLevel(score): HealthStatus` - Get health level from score
- `incrementVersion(version): string` - Increment semver version
- `validateProjectId(id): boolean` - Validate project ID format
- `validateSemver(version): boolean` - Validate semver string

---

## 🔄 Migration Guide

### From Monolith to @iris/core

**Before (Monolith):**
```typescript
import { IrisPrime } from './orchestrators/iris-prime.js'

const iris = new IrisPrime({ dbBasePath: './data' })
```

**After (@iris/core):**
```typescript
import { createIrisOrchestrator } from '@foxruv/iris-core'

const iris = createIrisOrchestrator({ dbBasePath: './data' })
```

### Key Changes

1. **Class Name:** `IrisPrime` → `IrisOrchestrator`
2. **Factory Function:** Use `createIrisOrchestrator()` instead of `new IrisPrime()`
3. **Import Path:** `@iris/core` instead of local path
4. **Zero Dependencies:** No need to install federated learning components

### Backward Compatibility

The monolith provides a backward compatibility shim at `src/orchestrators/iris-prime.ts` that re-exports from `@iris/core`:

```typescript
// Still works (with deprecation warning)
import { IrisPrime } from './orchestrators/iris-prime.js'
```

**Deprecation Timeline:**
- **v1.x:** Full backward compatibility maintained
- **v2.0:** Legacy imports removed

---

## 🧪 Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test Results:**
- **118 tests** across 5 test suites
- **99% coverage** (statements, lines, functions)
- **1.93s** execution time
- **Zero flaky tests**

---

## 🏗️ Building

```bash
# Build TypeScript
npm run build

# Type checking only
npm run typecheck
```

**Build Output:**
- ESM modules in `dist/`
- TypeScript declarations (`.d.ts`)
- Source maps for debugging
- **154KB total bundle size**
- **<2s build time**

---

## 📊 Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Bundle Size | <500KB | 154KB | ✅ |
| Build Time | <2s | ~1.5s | ✅ |
| Test Execution | <5s | 1.93s | ✅ |
| Coverage | >95% | 99% | ✅ |
| Zero Dependencies | Yes | Yes | ✅ |

---

## 🛠️ Development

### Project Structure

```
@iris/core/
├── src/
│   ├── index.ts                 # Main exports
│   ├── orchestrator.ts          # IrisOrchestrator class
│   ├── providers.ts             # Provider implementations
│   ├── types.ts                 # Type definitions
│   ├── utils.ts                 # Utility functions
│   ├── providers/               # Provider modules
│   │   ├── claude.ts
│   │   ├── qwen.ts
│   │   ├── manager.ts
│   │   └── index.ts
│   ├── types/                   # Type modules
│   │   ├── config.ts
│   │   ├── metrics.ts
│   │   ├── reports.ts
│   │   └── index.ts
│   └── utils/                   # Utility modules
│       ├── health.ts
│       └── validation.ts
├── tests/                       # Comprehensive test suite
├── dist/                        # Build output (ESM + CJS)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

### Dependencies

**Runtime:** Zero external dependencies

**Development:**
- `typescript` - Type checking and compilation
- `vitest` - Fast unit testing
- `@vitest/coverage-v8` - Code coverage reporting
- `@types/node` - Node.js type definitions

---

## 📄 License

MIT © [Iris Team]

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass (`npm test`)
5. Submit a pull request

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/scan-iq/iris/issues)
- **Discussions:** [GitHub Discussions](https://github.com/scan-iq/iris/discussions)
- **Documentation:** [Full Docs](https://github.com/scan-iq/iris/tree/main/packages/core/docs)

---

## 🔗 Related Packages

- `@iris/council` - Expert council coordination
- `@iris/voice` - Voice interface integration
- `@foxruv/iris` - Federated learning components

---

<div align="center">

**Built with ❤️ by the Iris Team**

[⬆ Back to Top](#iriscore)

</div>
