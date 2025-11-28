# Pattern Discovery & Management

This directory contains the pattern discovery and management systems for FoxRuv Prime.

## Files

### `pattern-discovery.ts`
Base pattern discovery engine for cross-domain learning with:
- Vector similarity search for patterns (Supabase pgvector primary, AgentDB fallback)
- Cross-domain strategy discovery
- Few-shot example retrieval
- Decision chain matching
- Transfer learning recommendations

### `cross-project-discovery.ts`
**NEW - FoxRuv Prime**

Complete cross-project pattern discovery engine that:
1. **Extracts patterns from telemetry** - Finds successful patterns (confidence > 0.9, success > 0.85)
2. **Uses AgentDB vector search** - Finds similar patterns across NFL, Microbiome, BeClever
3. **Tests pattern transfers** - Validates effectiveness on target projects
4. **Stores for reuse** - Maintains cross-project pattern library
5. **AI Council integration** - Gets automated approval decisions

### `prompt-registry.ts`
Prompt template management and versioning system.

## Quick Start

```typescript
import { createCrossProjectDiscovery } from './cross-project-discovery';

// Initialize
const discovery = createCrossProjectDiscovery({
  projects: ['nfl-predictor', 'microbiome', 'beclever']
});

// Extract patterns from NFL Predictor
const patterns = await discovery.extractPatternsFromTelemetry('nfl-predictor');

// Find patterns for Microbiome
const matches = await discovery.findSimilarPatternsAcrossProjects({
  description: 'High-confidence classification for genomic data',
  patternType: 'strategy',
  context: { targetProject: 'microbiome', domain: 'bioinformatics' }
});

// Test transfer
const result = await discovery.testPatternTransfer(
  matches[0].pattern.patternId,
  'microbiome'
);

console.log(`Improvement: ${(result.metrics.improvement * 100).toFixed(1)}%`);
console.log(`Deploy: ${result.shouldDeploy}`);
```

## Architecture

```
cross-project-discovery.ts
├── Pattern Extraction (from Supabase telemetry)
├── AgentDB Vector Search (find similar patterns)
├── Transfer Testing (validate on target)
├── AI Council Integration (approval decisions)
└── Pattern Storage (AgentDB + SQLite)
```

## Key Features

### 1. Automatic Pattern Extraction
- Queries telemetry from all projects
- Filters by quality thresholds (confidence, success rate)
- Extracts implementation details and metadata
- Generates embeddings for vector search

### 2. Vector Similarity Search
- Uses AgentDB for 150x faster vector search
- Finds patterns across different domains
- Ranks by transfer potential
- Considers domain similarity

### 3. Transfer Testing Framework
- Baseline vs pattern performance
- Success/failure/partial status
- Metrics tracking (accuracy, latency, confidence)
- Deployment recommendations

### 4. AI Council Integration
- Automated approval decisions
- Confidence scoring
- Required tests and conditions
- Rollback planning

### 5. Cross-Project Storage
- Patterns stored with full metadata
- Reusable across all projects
- Version tracking
- Usage history

## Examples

See `/examples/cross-project-discovery-demo.ts` for a complete working example.

See `/tests/cross-project-discovery.test.ts` for comprehensive test cases showing:
- NFL pattern extraction
- Microbiome transfer testing
- Success/failure scenarios
- End-to-end workflows

## Documentation

Full documentation: `/docs/cross-project-pattern-discovery.md`

Includes:
- Complete API reference
- Usage examples
- Integration guides
- Best practices
- Troubleshooting

## Integration Points

### Supabase Telemetry
```typescript
import { getProjectExpertStats } from '../supabase/telemetry';

// Automatically queries telemetry for pattern extraction
const stats = await getProjectExpertStats('nfl-predictor');
```

### AgentDB Vector Search
```typescript
// Patterns automatically indexed for fast similarity search
const similar = await agentDB.findSimilarExperts(queryEmbedding, 10);
```

### Global Metrics
```typescript
import { GlobalMetricsCollector } from '../telemetry/global-metrics';

// Drift detection and performance tracking
const metrics = new GlobalMetricsCollector();
```

## Performance

- **Pattern Extraction**: ~2-5 seconds per project
- **Vector Search**: ~50-100ms for 10,000 patterns
- **Transfer Testing**: Configurable (1-14 days)
- **Storage**: ~10KB per pattern

## Future Enhancements

- [ ] Real-time pattern monitoring
- [ ] OpenAI embedding generation
- [ ] Multi-modal pattern transfer
- [ ] Pattern versioning
- [ ] Cross-organization sharing
- [ ] Advanced AI Council with LLM
- [ ] Pattern marketplace
- [ ] Automated A/B testing

## License

MIT
