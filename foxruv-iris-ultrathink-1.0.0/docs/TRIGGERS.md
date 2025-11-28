# Trigger System Documentation

## Overview

The Ultrathink trigger system is a generic, event-based automation framework extracted from the IRIS auto-invocation system. It provides intelligent threshold-based triggers, cooldown management, and multi-action coordination for automated operations.

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Trigger Engine (Core)                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐  ┌──────────────┐            │
│  │Event Tracker│  │Config Manager│            │
│  └──────┬──────┘  └──────┬───────┘            │
│         │                │                     │
│  ┌──────▼──────────┐  ┌──▼────────────┐       │
│  │ Event History   │  │  Thresholds   │       │
│  │ (JSONL Store)   │  │  Time Windows │       │
│  └─────────────────┘  │  Critical List│       │
│                       └───────────────┘       │
│  ┌──────────────────┐                         │
│  │Cooldown Manager  │                         │
│  ├──────────────────┤                         │
│  │ Last Invocations │                         │
│  │ Invocation Hist. │                         │
│  │ Success Tracking │                         │
│  └──────────────────┘                         │
│                                                 │
│  ┌──────────────────────────────────────────┐ │
│  │         Action Handlers                  │ │
│  ├──────────────────────────────────────────┤ │
│  │ • Custom Actions                         │ │
│  │ • Error Handlers                         │ │
│  │ • Telemetry                              │ │
│  └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Key Components

### 1. TriggerEngine

The main orchestrator that coordinates all trigger operations.

**Responsibilities:**
- Process incoming events
- Check trigger conditions
- Manage action execution
- Handle telemetry
- Coordinate cooldowns

### 2. EventTracker

Fast JSONL-based event storage optimized for append-only writes and time-window queries.

**Features:**
- O(1) event recording
- Efficient time-window filtering
- Event aggregation and statistics
- Pattern detection (spikes, trends)
- Export/import capabilities

### 3. CooldownManager

Prevents trigger spam by enforcing cooldown periods between invocations.

**Features:**
- Per-context cooldown tracking
- Success rate monitoring
- Adaptive cooldowns based on performance
- Invocation history
- Average duration tracking

### 4. TriggerConfigManager

Manages trigger configurations with presets and custom settings.

**Features:**
- Configuration presets (dev, prod, ML, CI/CD)
- Per-context customization
- Dynamic threshold updates
- Critical event management
- Configuration import/export

## Event Flow

```
1. Event Occurs
   ↓
2. Record to History (EventTracker)
   ↓
3. Check Triggers
   ├─ Critical Event? → Invoke Immediately
   ├─ Cooldown Active? → Skip
   └─ Threshold Met? → Invoke Actions
   ↓
4. Execute Actions
   ├─ Action 1 (with error handling)
   ├─ Action 2 (with error handling)
   └─ Action N (with error handling)
   ↓
5. Record Invocation (CooldownManager)
   ↓
6. Send Telemetry (Optional)
```

## Configuration Presets

### Development
**Use case:** Local development workflows

```typescript
{
  eventThresholds: {
    file_edit: 10,        // Trigger after 10 file edits
    test_failure: 2,      // Trigger after 2 test failures
    build_failure: 1,     // Trigger on first build failure
    lint_error: 10        // Trigger after 10 lint errors
  },
  timeWindow: 60 * 60 * 1000,      // 1 hour
  cooldownPeriod: 30 * 60 * 1000,  // 30 minutes
  criticalEvents: ['build_failure', 'critical_error']
}
```

### Production
**Use case:** Production monitoring and alerting

```typescript
{
  eventThresholds: {
    error: 5,                     // Trigger after 5 errors
    performance_degradation: 3,   // Trigger after 3 performance issues
    drift_detected: 1             // Trigger immediately on drift
  },
  timeWindow: 30 * 60 * 1000,     // 30 minutes
  cooldownPeriod: 15 * 60 * 1000, // 15 minutes
  criticalEvents: ['critical_error', 'security_breach', 'data_loss']
}
```

### ML Training
**Use case:** Machine learning model monitoring

```typescript
{
  eventThresholds: {
    model_train: 1,          // Trigger after each training
    drift_detected: 1,       // Trigger immediately on drift
    accuracy_drop: 2         // Trigger after 2 accuracy drops
  },
  timeWindow: 2 * 60 * 60 * 1000,  // 2 hours
  cooldownPeriod: 60 * 60 * 1000,  // 1 hour
  criticalEvents: ['drift_detected', 'critical_accuracy_drop']
}
```

### CI/CD
**Use case:** Continuous integration/deployment pipelines

```typescript
{
  eventThresholds: {
    pipeline_start: 1,
    test_failure: 1,
    build_failure: 1,
    deployment_success: 1
  },
  timeWindow: 15 * 60 * 1000,     // 15 minutes
  cooldownPeriod: 5 * 60 * 1000,  // 5 minutes
  criticalEvents: ['deployment_failure', 'security_scan_failure']
}
```

## Integration Patterns

### 1. AgentDB Integration

Store events in AgentDB for vector-based analysis:

```typescript
const engine = createTriggerEngine(
  './data/triggers',
  [{
    name: 'store-in-agentdb',
    handler: async (context, event, metadata) => {
      await agentDB.insert({
        id: `${context}-${Date.now()}`,
        text: `${event.event} in ${context}`,
        metadata: { context, event: event.event, ...metadata }
      })

      // Search for similar past events
      const similar = await agentDB.search(event.event, 5)
      // Analyze patterns...
    }
  }]
)
```

### 2. Agentic-Flow Integration

Coordinate swarm responses to events:

```typescript
const engine = createTriggerEngine(
  './data/triggers',
  [{
    name: 'coordinate-swarm',
    handler: async (context, event, metadata) => {
      const swarm = await createSwarm({
        topology: 'mesh',
        agents: [
          { type: 'researcher', name: 'Event Analyzer' },
          { type: 'coder', name: 'Fix Generator' },
          { type: 'tester', name: 'Validation' }
        ]
      })

      await swarm.execute(`Handle ${event.event}`, metadata)
    }
  }]
)
```

### 3. Custom Threshold Functions

Implement dynamic thresholds based on context:

```typescript
const config: TriggerConfig = {
  eventThresholds: { default: 5 },
  customThresholdFn: (event, context, history) => {
    // Dynamic threshold based on recent activity
    const recentRate = history.filter(e =>
      e.timestamp > Date.now() - 5 * 60 * 1000
    ).length

    if (recentRate > 20) {
      return 15 // Higher threshold for high activity
    }
    return 5 // Normal threshold
  },
  timeWindow: 60 * 60 * 1000,
  cooldownPeriod: 30 * 60 * 1000,
  criticalEvents: []
}
```

## Performance Optimization

### Fast Event Recording

Events are appended to JSONL files with O(1) complexity:

```typescript
// Append-only, no parsing required
fs.appendFileSync(historyPath, JSON.stringify(event) + '\n')
```

### Efficient Time-Window Queries

Only events within the time window are parsed:

```typescript
const cutoffTime = Date.now() - timeWindow
// Skip events before cutoff during parsing
```

### Cooldown Caching

Last invocation timestamps are cached in memory:

```typescript
private cache: Map<string, number> = new Map()
```

### Batch Operations

Record multiple events at once:

```typescript
tracker.recordBatch([event1, event2, event3])
```

## Telemetry

Built-in telemetry for monitoring:

```typescript
const engine = createTriggerEngine(
  dbBasePath,
  actions,
  'production',
  {
    telemetryFn: async (data) => {
      await logTelemetry({
        operation: data.operation,
        context: data.context,
        event: data.event,
        outcome: data.outcome,
        reason: data.reason,
        durationMs: data.durationMs,
        metadata: data.metadata
      })
    }
  }
)
```

## Maintenance

### Cleanup Old Data

Run periodically to prevent unbounded growth:

```typescript
// Keep 7 days of data
const cleaned = engine.cleanup(7 * 24 * 60 * 60 * 1000)
console.log(`Cleaned ${cleaned.events} events, ${cleaned.invocations} invocations`)
```

### Export for Backup

Export all data for backup or analysis:

```typescript
const data = engine.exportData('my-project')
fs.writeFileSync('backup.json', JSON.stringify(data, null, 2))
```

### Monitor Health

Track success rates and performance:

```typescript
const successRate = cooldowns.getSuccessRate('my-project', 24 * 60 * 60 * 1000)
const avgDuration = cooldowns.getAverageDuration('my-project', 24 * 60 * 60 * 1000)

console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`)
console.log(`Avg duration: ${avgDuration.toFixed(0)}ms`)
```

## Best Practices

### 1. Choose Appropriate Thresholds

- **Development**: Higher thresholds to avoid interruption
- **Production**: Lower thresholds for faster response
- **Critical Events**: Always use critical events for urgent issues

### 2. Set Reasonable Cooldowns

- **High-Frequency Events**: Longer cooldowns (30-60 min)
- **Low-Frequency Events**: Shorter cooldowns (5-15 min)
- **Adaptive**: Use AdaptiveCooldownManager for automatic adjustment

### 3. Monitor Performance

- Track success rates regularly
- Adjust thresholds based on patterns
- Use telemetry for debugging

### 4. Handle Errors Gracefully

Always provide error handlers:

```typescript
{
  name: 'my-action',
  handler: async (context, event, metadata) => {
    // Main logic
  },
  onError: async (error, context, event) => {
    console.error(`Error in ${context}:`, error)
    // Fallback logic or alerting
  }
}
```

### 5. Use Dry-Run Mode

Test configurations before deploying:

```typescript
await engine.processEvent({
  event: 'test_event',
  context: 'test-project',
  dryRun: true // Won't execute actions
})
```

## Migration from IRIS

The trigger system was extracted from IRIS with the following changes:

1. **Generic Context**: Changed from `project` to `context` for flexibility
2. **Configurable Actions**: Multiple action handlers instead of single IRIS invocation
3. **Improved Telemetry**: Built-in telemetry function support
4. **Enhanced Statistics**: Event aggregation and pattern detection
5. **Better Error Handling**: Per-action error handlers

## Examples

See `/examples` directory for:
- `trigger-example.ts` - Basic usage
- `trigger-integration-example.ts` - AgentDB and Agentic-Flow integration

## API Reference

See `/src/triggers/README.md` for complete API documentation.
