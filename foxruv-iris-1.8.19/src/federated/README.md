# 🦊 FoxRUV Prime - Federated Learning Control Plane

Complete federated learning system for cross-project AI optimization.

## ✅ What's Included

### Core Components

1. **FederatedControlPlane.ts** - Main orchestrator
   - Runs every 5 minutes (configurable)
   - Aggregates telemetry from all projects
   - Executes AI Council analysis
   - Tests patterns on target projects
   - Deploys approved improvements

2. **ScheduledJobs.ts** - Automated execution
   - Configurable intervals
   - Retry logic on failures
   - Execution history tracking
   - Health monitoring

3. **ProjectConnector.ts** - Webhook delivery
   - Pushes decisions to projects
   - Authentication & retries
   - Delivery tracking
   - Connection testing

4. **TelemetryAggregator.ts** - Data aggregation
   - Collects telemetry from all projects
   - Detects patterns using vector similarity
   - Groups by project and pattern type

5. **AICouncil.ts** - Decision making
   - 5 specialized AI agents vote
   - Consensus-based decisions
   - Pattern analysis and recommendations

6. **PatternTestRunner.ts** - A/B testing
   - Tests patterns on target projects
   - 10% traffic rollout
   - Monitors improvement metrics

### CLI Tool

```bash
# Start control plane
npx foxruv-prime start

# Run analysis
npx foxruv-prime analyze

# View status
npx foxruv-prime status

# View decisions
npx foxruv-prime decisions --recent 10

# Test pattern transfer
npx foxruv-prime test-transfer --pattern <id> --target microbiome
```

### Tests

- **e2e.test.ts** - Complete workflow testing
- **integration.test.ts** - Component integration tests

## 🚀 Quick Start

### 1. Setup Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Setup Database

See [FEDERATED_QUICKSTART.md](../../docs/FEDERATED_QUICKSTART.md) for SQL schema.

### 3. Start Control Plane

```bash
npm run federated:start
```

## 📊 E2E Workflow Example

1. **NFL logs 100 telemetry events** with confidence calibration pattern
2. **Control plane aggregates** every 5 minutes
3. **AI Council detects pattern** and votes (consensus: 0.88)
4. **Pattern tested on microbiome** (10% traffic)
5. **Test shows 5% improvement** - passes threshold
6. **Council votes to deploy** (consensus: 0.92)
7. **Pattern pushed to microbiome** via webhook
8. **Monitor confirms improvement**
9. **Pattern marked as universal**

## 📈 Metrics Tracked

- Total telemetry events processed
- Patterns detected
- Decisions proposed/approved
- Patterns transferred
- Average consensus score
- Success rates
- Delivery statistics

## 🔧 Configuration

```typescript
const controlPlane = new FederatedControlPlane({
  vectorStore,
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-key',
  intervalMinutes: 5,
  councilSize: 5,
  quorumThreshold: 0.6,
  testTrafficPercentage: 10,
  successThreshold: 0.05,
  projectWebhooks: new Map([
    ['nfl-picks', 'https://nfl.example.com/webhook'],
    ['microbiome', 'https://microbiome.example.com/webhook'],
  ]),
  autoExecute: true,
});
```

## 🧪 Testing

```bash
# Run all federated tests
npm run test:federated

# Run E2E tests
npm run test:e2e
```

## 📚 Documentation

- [Quick Start Guide](../../docs/FEDERATED_QUICKSTART.md)
- [Full Documentation](../../docs/FEDERATED_CONTROL_PLANE.md)
- [Deployment Guide](../../docs/FEDERATED_DEPLOYMENT.md)

## 🎯 Architecture

```
┌─────────────────────────────────────┐
│  FederatedControlPlane (Every 5m)   │
├─────────────────────────────────────┤
│  1. TelemetryAggregator             │
│  2. Pattern Detection (Vector)      │
│  3. AICouncil Analysis              │
│  4. PatternTestRunner               │
│  5. Decision Execution              │
│  6. ProjectConnector (Webhooks)     │
└─────────────────────────────────────┘
         ↓         ↓         ↓
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │   NFL   │ │Microbiome│ │ Crypto  │
   └─────────┘ └─────────┘ └─────────┘
```

## 🔒 Security

- Webhook authentication via tokens
- Rate limiting on endpoints
- Environment variable secrets
- Retry logic with exponential backoff

## 📞 Support

- Issues: GitHub Issues
- Docs: /docs folder
- Examples: See tests/federated/
