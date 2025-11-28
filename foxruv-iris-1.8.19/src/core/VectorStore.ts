/**
 * Vector Store - Simple wrapper around AgentDB
 * This is a placeholder - actual implementation should use AgentDB
 */

export interface Vector {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
}

import fs from 'fs'
import { AgentDBManager, type ExpertEmbedding } from '../storage/agentdb-integration.js'

export class VectorStore {
  private readonly store = new Map<string, Vector>()
  private readonly persistPath?: string
  private readonly agentdb: AgentDBManager

  constructor(config: { dimension: number; metric?: string; persistPath?: string }) {
    this.persistPath = config.persistPath
    this.agentdb = new AgentDBManager({
      dbPath: this.persistPath || ':memory:',
      vectorDimension: config.dimension
    })
    if (this.persistPath && fs.existsSync(this.persistPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.persistPath, 'utf8'))
        raw.forEach((item: Vector) => this.store.set(item.id, item))
      } catch {
        // ignore corrupt cache; start fresh
      }
    }
  }

  async initialize(): Promise<void> {
    // No-op for in-memory implementation
  }

  async insert(_vectors: Vector[]): Promise<void> {
    for (const v of _vectors) {
      this.store.set(v.id, v)
      const embedding: ExpertEmbedding = {
        expertId: v.id,
        name: (v.metadata && (v.metadata as any).name) || v.id,
        signature: (v.metadata && (v.metadata as any).signature) || 'vector',
        embedding: v.vector,
        performance: typeof (v.metadata as any)?.performance === 'number' ? (v.metadata as any).performance : 0,
        metadata: v.metadata || {}
      }
      await this.agentdb.storeExpertEmbedding(embedding)
    }
    this.persist()
  }

  async retrieve(_ids: string[]): Promise<Vector[]> {
    if (_ids.length === 0) return Array.from(this.store.values())

    const results: Vector[] = []
    for (const id of _ids) {
      const fromDb = await this.agentdb.getExpert(id)
      if (fromDb) {
        results.push({
          id: fromDb.expertId,
          vector: fromDb.embedding,
          metadata: { ...fromDb.metadata, name: fromDb.name, signature: fromDb.signature, performance: fromDb.performance }
        })
        continue
      }
      const cached = this.store.get(id)
      if (cached) results.push(cached)
    }
    return results
  }

  async search(_query: number[], _limit: number): Promise<Vector[]> {
    const similar = await this.agentdb.findSimilarExperts(_query, _limit)
    if (similar.length > 0) {
      return similar.map(sim => ({
        id: sim.expertId,
        vector: sim.embedding,
        metadata: { ...sim.metadata, name: sim.name, signature: sim.signature, performance: sim.performance }
      }))
    }

    // Fallback: Simple cosine using cached store
    const scored = Array.from(this.store.values()).map(v => ({
      vector: v,
      score: dot(_query, v.vector)
    }))

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, _limit).map(s => s.vector)
  }

  private persist(): void {
    if (!this.persistPath) return
    try {
      fs.writeFileSync(this.persistPath, JSON.stringify(Array.from(this.store.values()), null, 2))
    } catch {
      // best-effort; ignore errors
    }
  }
}

// Simple dot product helper
function dot(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i]
  }
  return sum
}
