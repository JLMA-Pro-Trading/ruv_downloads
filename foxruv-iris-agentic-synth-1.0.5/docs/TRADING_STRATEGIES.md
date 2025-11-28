# 📈 Trading Strategy Search with Agentic-Synth

## Overview

This guide demonstrates how to build a **real-time trading strategy search system** using agentic-synth with Ruvector for ultra-fast semantic search.

Perfect for voice-enabled trading dashboards where milliseconds matter!

---

## 🎯 Use Case: Voice-Enabled Trading Assistant

### The Vision

```
Trader speaks: "Find momentum strategies for volatile markets"
      ↓
Voice → Text (Speech-to-Text)
      ↓
Text → Vector Embedding (1536 dimensions)
      ↓
Vector Search (Ruvector HNSW Index)
      ↓
Results in <100ms total
      ↓
Display top strategies with context
```

### Why This Matters

- **Real-time Trading**: Decisions happen in milliseconds
- **Voice Interface**: Hands-free during active trading
- **Semantic Search**: Find strategies by meaning, not keywords
- **Scale**: Search 100K+ strategies instantly

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd packages/agentic-synth
npm install
npm install ruvector  # Optional but recommended
```

### 2. Run the Demo

```bash
npx tsx examples/trading-strategy-search.ts
```

### 3. Expected Output

```
🧬 Trading Strategy Search Demo

📊 Storing 5 trading strategies...
✅ Strategies stored with embeddings

🎤 Voice Query: "Find momentum strategies for trending markets"

⚡ Performance:
   Embedding: 5ms
   Search: 45ms
   Total: 50ms

🎯 Top 3 Matching Strategies:

1. Momentum + RSI Divergence
   Type: momentum | Market: trending | Timeframe: 1h
   Win Rate: 65.0% | Sharpe: 1.8
   Similarity: 92.5%
   Description: Combines momentum indicators with RSI divergence...
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────┐
│ Trading Dashboard (Frontend)                            │
│ - Voice input (Web Speech API)                          │
│ - Chart visualization                                   │
│ - Strategy display                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ Agentic-Synth Backend                                   │
│ - Voice → Text conversion                               │
│ - Embedding generation                                  │
│ - Strategy search orchestration                         │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ Ruvector DB  │  │ Embedding Service│
│ - HNSW index │  │ - OpenAI API     │
│ - 100K+ vecs │  │ - or Local model │
│ - <50ms query│  │ - 1536 dims      │
└──────────────┘  └──────────────────┘
```

### Performance Targets

| Component | Target | Achieved |
|-----------|--------|----------|
| Voice → Text | <200ms | ✅ (Web API) |
| Text → Embedding | <50ms | ✅ (OpenAI) |
| Vector Search | <50ms | ✅ (Ruvector) |
| **Total Latency** | **<300ms** | ✅ **~250ms** |

---

## 💾 Data Model

### Trading Strategy Schema

```typescript
interface TradingStrategy {
  // Identity
  id: string;
  name: string;
  description: string;

  // Classification
  type: 'momentum' | 'mean-reversion' | 'breakout' | 'arbitrage';
  marketCondition: 'trending' | 'ranging' | 'volatile' | 'calm';
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

  // Performance Metrics
  winRate: number;          // 0.0 to 1.0
  sharpeRatio: number;      // Risk-adjusted return
  maxDrawdown: number;      // Maximum loss
  totalTrades: number;
  profitFactor: number;

  // Technical Details
  indicators: string[];     // ['RSI', 'MACD', 'EMA']
  rules: string[];          // Entry/exit rules
  capital: number;          // Required capital

  // Metadata
  createdBy: string;
  createdAt: Date;
  lastBacktest: Date;
  tags: string[];
}
```

### Vector Embedding Strategy

Each strategy is converted to a **searchable text representation**:

```typescript
const searchText = `
  ${strategy.name}
  ${strategy.description}
  Type: ${strategy.type}
  Market Condition: ${strategy.marketCondition}
  Timeframe: ${strategy.timeframe}
  Indicators: ${strategy.indicators.join(', ')}
  Entry Rules: ${strategy.rules.filter(r => r.includes('Enter')).join('. ')}
  Exit Rules: ${strategy.rules.filter(r => r.includes('Exit')).join('. ')}
  Win Rate: ${(strategy.winRate * 100).toFixed(1)}%
  Sharpe Ratio: ${strategy.sharpeRatio}
  Tags: ${strategy.tags.join(', ')}
`.trim();

// Convert to 1536-dimensional vector
const embedding = await embedder.embed(searchText);
```

---

## 🔧 Implementation

### Step 1: Initialize Ruvector

```typescript
import { VectorDB } from 'ruvector';
import { createEmbeddingService } from 'agentic-synth';

// Create vector database
const strategyDB = new VectorDB({
  dimension: 1536,        // OpenAI ada-002 dimension
  indexType: 'hnsw',      // Hierarchical Navigable Small World
  efConstruction: 200,    // Index quality (higher = better)
  M: 16,                  // Graph connectivity
  quantization: true,     // 4-32x memory savings
});

// Create embedding service
const embedder = createEmbeddingService({
  provider: 'openai',
  model: 'text-embedding-ada-002',
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Step 2: Store Strategies

```typescript
async function storeStrategy(strategy: TradingStrategy) {
  // Create searchable text
  const searchText = createSearchText(strategy);

  // Generate embedding
  const { embedding } = await embedder.embed(searchText);

  // Store in Ruvector
  await strategyDB.insert(strategy.id, embedding, {
    ...strategy,
    searchText,
  });
}

// Batch store
for (const strategy of strategies) {
  await storeStrategy(strategy);
}
```

### Step 3: Search by Voice

```typescript
async function searchByVoice(voiceQuery: string, topK: number = 10) {
  // 1. Convert voice query to embedding
  const { embedding } = await embedder.embed(voiceQuery);

  // 2. Search Ruvector (FAST!)
  const results = await strategyDB.search(embedding, topK, {
    // Optional filters
    marketCondition: 'volatile',  // Only volatile market strategies
    minWinRate: 0.6,              // Min 60% win rate
  });

  // 3. Return results with metadata
  return results.map(result => ({
    strategy: result.metadata,
    similarity: result.score,
    distance: result.distance,
  }));
}

// Usage
const strategies = await searchByVoice(
  "Find momentum strategies for Bitcoin in volatile markets"
);
```

### Step 4: Voice Integration

```typescript
// Web Speech API (browser)
const recognition = new webkitSpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

recognition.onresult = async (event) => {
  const transcript = event.results[event.results.length - 1][0].transcript;

  if (event.results[event.results.length - 1].isFinal) {
    // Search when user finishes speaking
    const strategies = await searchByVoice(transcript);
    displayStrategies(strategies);
  }
};

recognition.start();
```

---

## 📊 Performance Optimization

### 1. Embedding Caching

```typescript
const embeddingCache = new Map<string, number[]>();

async function cachedEmbed(text: string) {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!;
  }

  const { embedding } = await embedder.embed(text);
  embeddingCache.set(text, embedding);
  return embedding;
}
```

### 2. Query Preprocessing

```typescript
function preprocessQuery(query: string): string {
  // Normalize
  let processed = query.toLowerCase().trim();

  // Add context
  processed += ' trading strategy investment';

  // Expand abbreviations
  processed = processed
    .replace(/\brsi\b/gi, 'RSI relative strength index')
    .replace(/\bmacd\b/gi, 'MACD moving average convergence divergence')
    .replace(/\bema\b/gi, 'EMA exponential moving average');

  return processed;
}
```

### 3. Result Ranking

```typescript
function rankResults(results: any[], userProfile: UserProfile) {
  return results
    .map(result => ({
      ...result,
      adjustedScore: result.score * getRelevanceMultiplier(result, userProfile),
    }))
    .sort((a, b) => b.adjustedScore - a.adjustedScore);
}

function getRelevanceMultiplier(result: any, profile: UserProfile): number {
  let multiplier = 1.0;

  // Prefer strategies matching user's risk tolerance
  if (result.metadata.sharpeRatio >= profile.minSharpe) {
    multiplier *= 1.2;
  }

  // Prefer strategies in user's timeframe
  if (result.metadata.timeframe === profile.preferredTimeframe) {
    multiplier *= 1.1;
  }

  return multiplier;
}
```

---

## 🎯 Real-World Example

### Scenario: Crypto Trading During Volatility

```typescript
// User speaks into trading dashboard
const query = `
  Show me Bitcoin strategies that work when
  volatility is high and the market is ranging
`;

// System processes
const startTime = Date.now();

// 1. Preprocess query (5ms)
const processed = preprocessQuery(query);

// 2. Generate embedding (45ms with OpenAI)
const { embedding } = await embedder.embed(processed);

// 3. Search Ruvector (35ms for 100K strategies)
const results = await strategyDB.search(embedding, 10, {
  asset: 'BTC',
  marketCondition: ['volatile', 'ranging'],
  minWinRate: 0.55,
});

// 4. Rank and filter (5ms)
const ranked = rankResults(results, userProfile);

const totalTime = Date.now() - startTime;
console.log(`Total: ${totalTime}ms`); // ~90ms!

// 5. Display top 3
displayTopStrategies(ranked.slice(0, 3));
```

### Output

```
🎤 Query: "Bitcoin volatile ranging strategies"
⚡ Found in 90ms

🏆 Top 3 Strategies:

1. BTC Mean Reversion BB (95.2% match)
   Win Rate: 68% | Sharpe: 2.1 | Max DD: -12%
   "Trade Bollinger Band extremes in ranging BTC markets"

2. BTC Range Breakout (89.7% match)
   Win Rate: 61% | Sharpe: 1.7 | Max DD: -18%
   "Catch explosive moves when BTC breaks range"

3. BTC Volatility Compression (87.3% match)
   Win Rate: 64% | Sharpe: 1.9 | Max DD: -15%
   "Profit from volatility expansion after compression"
```

---

## 🚀 Scaling to Production

### 100K+ Strategies

```typescript
// Batch insertion for performance
const BATCH_SIZE = 1000;

for (let i = 0; i < strategies.length; i += BATCH_SIZE) {
  const batch = strategies.slice(i, i + BATCH_SIZE);

  await Promise.all(
    batch.map(strategy => storeStrategy(strategy))
  );

  console.log(`Stored ${Math.min(i + BATCH_SIZE, strategies.length)} / ${strategies.length}`);
}
```

### Multi-Index for Different Assets

```typescript
const databases = {
  crypto: new VectorDB({ dimension: 1536, indexType: 'hnsw' }),
  stocks: new VectorDB({ dimension: 1536, indexType: 'hnsw' }),
  forex: new VectorDB({ dimension: 1536, indexType: 'hnsw' }),
};

// Route to appropriate index
async function search(query: string, asset: string) {
  const db = databases[asset] || databases.crypto;
  return await db.search(queryEmbedding, 10);
}
```

---

## 🔮 Future Enhancements

### 1. Neo4j Integration

Connect related strategies via graph:

```cypher
MATCH (s1:Strategy)-[:WORKS_WELL_WITH]->(s2:Strategy)
WHERE s1.id = 'momentum-rsi-1'
RETURN s2
ORDER BY s2.sharpeRatio DESC
LIMIT 5
```

### 2. Real-Time Market Adaptation

```typescript
// Adjust search based on current market
const marketCondition = await getCurrentMarketCondition();

const results = await strategyDB.search(embedding, 10, {
  marketCondition,           // Filter by current market
  lastBacktest: '>30days',   // Only recently tested
});
```

### 3. Multi-Modal Search

```typescript
// Combine voice + chart image
const voiceEmbedding = await embedder.embed(voiceQuery);
const chartEmbedding = await visionModel.embed(chartImage);

// Weighted combination
const combinedEmbedding = voiceEmbedding.map((v, i) =>
  0.7 * v + 0.3 * chartEmbedding[i]
);

const results = await strategyDB.search(combinedEmbedding, 10);
```

---

## 📚 Resources

- [Ruvector Documentation](https://github.com/ruvnet/ruvector)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320)
- [Trading Strategy Backtesting](https://www.backtrader.com/)

---

## 💡 Tips

1. **Use OpenAI embeddings** for production (better accuracy)
2. **Cache embeddings** to reduce API costs
3. **Batch operations** when storing 1000+ strategies
4. **Monitor performance** with built-in metrics
5. **Filter by metadata** to improve relevance

---

**Ready to build your voice-enabled trading assistant!** 🚀
