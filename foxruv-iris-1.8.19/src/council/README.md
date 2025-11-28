# FoxRuv Prime AI Council

6-Agent federated learning control plane for cross-project meta-decisions.

## Overview

The AI Council is a simplified version of the 18-agent microbiome council, optimized for **cross-project pattern transfer** rather than deep domain analysis.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 TIER 1: DECISION MAKERS                     │
│  🧠 PatternMaster      (weight: 2.0)                        │
│  🔬 PromptScientist    (weight: 2.0)                        │
│  ⚖️ PerformanceJudge   (weight: 2.0)                        │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              TIER 2: VALIDATORS & TESTERS                   │
│  🔄 TransferTester     (weight: 1.5)                        │
│  🛡️ SafetyValidator    (weight: 1.5)                        │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│            TIER 3: CONSENSUS & ORCHESTRATION                │
│  🎯 ConsensusOrchestrator (ReConcile Algorithm)             │
└─────────────────────────────────────────────────────────────┘
```

## Decision Types

### 1. Pattern Transfer
Transfer successful patterns from one project to others.

**Example:** NFL's confidence calibration pattern → Microbiome

### 2. Prompt Upgrade
Deploy PromptBreeder-evolved prompts across projects.

**Example:** TheAnalyst v2.2.0 with 7% improvement

### 3. Expert Rotation
Manage expert performance, promotions, and retraining.

**Example:** Retrain drifting MarketAnalyst using HealthAnalyst's approach

## Quick Start

```typescript
import { createAICouncil } from '@foxruv/agent-learning-core/council'
import { GlobalMetricsCollector } from '@foxruv/agent-learning-core/telemetry'
import { aggregateTelemetryForCouncil } from '@foxruv/agent-learning-core/council/utils'

// Initialize council
const council = createAICouncil({
  consensusThreshold: 0.80,
  defaultRolloutPercentage: 0.10
})

// Aggregate telemetry
const metricsCollector = new GlobalMetricsCollector()
const telemetry = await aggregateTelemetryForCouncil(
  ['nfl-predictor', 'microbiome', 'beclever'],
  { start: dayAgo, end: now },
  metricsCollector
)

// Hold council meeting
const result = await council.holdMeeting(telemetry)

// Execute decisions
await council.executeDecisions(result)

council.close()
```

## Run Example

```bash
npx tsx src/council/examples/run-council-meeting.ts
```

## Agent Responsibilities

### Tier 1: Core Decision Makers

#### 🧠 PatternMaster
- **Role:** Discover cross-project patterns using AgentDB vector search
- **Vote Weight:** 2.0
- **Decisions:** Which patterns transfer between projects

#### 🔬 PromptScientist
- **Role:** Evolve prompts using PromptBreeder genetic algorithm
- **Vote Weight:** 2.0
- **Decisions:** Which prompt versions to deploy

#### ⚖️ PerformanceJudge
- **Role:** Manage expert leagues, detect drift, recommend rotations
- **Vote Weight:** 2.0
- **Decisions:** Which experts to promote/demote/retrain

### Tier 2: Validators

#### 🔄 TransferTester
- **Role:** Test patterns/prompts on new projects with A/B testing
- **Vote Weight:** 1.5
- **Decisions:** GO/NO-GO for pattern deployment

#### 🛡️ SafetyValidator
- **Role:** Ensure changes don't degrade performance
- **Vote Weight:** 1.5
- **Decisions:** Safety approval with guardrails

### Tier 3: Consensus

#### 🎯 ConsensusOrchestrator
- **Role:** Aggregate votes using ReConcile algorithm
- **Vote Weight:** 1.0
- **Decisions:** Final GO/NO-GO + execution coordination

## Consensus Algorithm (ReConcile)

The council uses the **ReConcile** weighted voting algorithm:

```typescript
// Step 1: Convert votes to scores
APPROVE     →  +confidence
CONDITIONAL →  +confidence * 0.7
NEUTRAL     →  0
REJECT      →  -confidence

// Step 2: Calculate weighted average
weightedScore = Σ(score × weight) / Σ(weight)

// Step 3: Normalize to 0-1
normalizedConfidence = (weightedScore + 1) / 2

// Step 4: Reach consensus
if normalizedConfidence >= 0.80:
  CONSENSUS REACHED ✅
else:
  REFINE VOTES (up to 3 iterations)
```

## Integration with Telemetry

The council integrates with the existing GlobalMetricsCollector:

```typescript
import { GlobalMetricsCollector } from '@foxruv/agent-learning-core/telemetry'
import { aggregateTelemetryForCouncil } from './utils/telemetry-aggregator'

const metricsCollector = new GlobalMetricsCollector({
  useSupabase: true,
  enableAgentDBCache: true
})

// Aggregate last 24 hours
const telemetry = await aggregateTelemetryForCouncil(
  ['nfl-predictor', 'microbiome'],
  {
    start: new Date(Date.now() - 86400000),
    end: new Date()
  },
  metricsCollector
)

const result = await council.holdMeeting(telemetry)
```

## Configuration

```typescript
interface AICouncilConfig {
  agentDbPath?: string                  // Default: './data/council/council.db'
  consensusThreshold?: number           // Default: 0.80
  maxIterations?: number                // Default: 3
  agentWeights?: {
    PatternMaster?: number              // Default: 2.0
    PromptScientist?: number            // Default: 2.0
    PerformanceJudge?: number           // Default: 2.0
    TransferTester?: number             // Default: 1.5
    SafetyValidator?: number            // Default: 1.5
  }
  analysisInterval?: string             // Default: '5m'
  defaultRolloutPercentage?: number     // Default: 0.10
  defaultMonitoringDuration?: string    // Default: '24h'
  defaultRollbackThreshold?: number     // Default: 0.05
}
```

## Example Decision Flow

### Pattern Transfer: NFL → Microbiome

```
Week 1: Discovery
  NFL TheAnalyst: 500 predictions, 0.95 accuracy
  → PatternMaster detects: "Confidence calibration pattern"

Week 1: Council Analysis (Friday)
  PatternMaster:    APPROVE (0.92)
  PromptScientist:  NEUTRAL (0.70)
  PerformanceJudge: APPROVE (0.90)
  TransferTester:   APPROVE (0.88) [tested on Microbiome: +6%]
  SafetyValidator:  APPROVE (0.85)

  Consensus: 0.87 → APPROVED ✅

Week 2: Gradual Deployment
  Monday:    10% traffic → +5.8% improvement
  Tuesday:   25% traffic → +6.1% improvement
  Wednesday: 50% traffic → +6.0% improvement
  Thursday:  100% deployment → +6.2% final improvement

Week 3: Second Transfer (Microbiome → BeClever)
  Pattern now has proof across 2 projects
  Council votes to test on BeClever → +4% improvement
  Pattern marked as "universal"
```

## Comparison: Microbiome Council vs FoxRuv Prime Council

| Aspect | Microbiome Council | FoxRuv Prime Council |
|--------|-------------------|----------------------|
| **Purpose** | Deep domain analysis (medical) | Cross-project meta-learning |
| **Agents** | 18 (3-tier hierarchy) | 6 (3-tier simplified) |
| **Decision Speed** | Hours (careful medical analysis) | Minutes (pattern transfer) |
| **Scope** | Single project, single domain | Multi-project, meta-level |
| **Consensus** | Evidence-based medical consensus | ReConcile weighted voting |

## Testing

```bash
# Run unit tests
npm test src/council/tests/AICouncil.test.ts

# Run integration example
npx tsx src/council/examples/run-council-meeting.ts
```

## Architecture Decisions

### Why 6 Agents (Not 18)?

The microbiome council uses 18 agents for **deep domain expertise** within ONE project. FoxRuv Prime needs **cross-project meta-intelligence**, which is simpler:

- Fewer agents (6 vs 18)
- Faster consensus (minutes vs hours)
- Lightweight (can run every 5 minutes)
- Focused on pattern transfer, not domain specifics

### Why ReConcile Algorithm?

ReConcile provides:
- **Weighted voting** (respects agent expertise)
- **Iterative refinement** (agents can adjust based on others)
- **Fast convergence** (3 iterations max)
- **Confidence-based decisions** (not just majority)

## Future Enhancements

1. **Claude Flow Integration** - Use swarm orchestration for parallel agent execution
2. **AgentDB Vector Search** - Semantic pattern matching across projects
3. **PromptBreeder Integration** - Actual genetic algorithm for prompt evolution
4. **Automated Deployment** - Execute decisions without human intervention
5. **Cross-Project Knowledge Export** - Share learned skills between projects

## License

MIT - Part of @foxruv/agent-learning-core
