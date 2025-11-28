import { AgentDBManager } from '../storage/agentdb-integration.js'
import type { DecisionDraftRecord } from '../types/supabase-types.js'

export class DraftDecisionStore {
  private readonly db: AgentDBManager
  private readonly prefix = 'draft_decisions.'

  constructor(db?: AgentDBManager) {
    this.db = db ?? new AgentDBManager({ dbPath: './data/draft-decisions.db' })
  }

  async createDraft(draft: DecisionDraftRecord): Promise<DecisionDraftRecord> {
    const now = new Date().toISOString()
    const record: DecisionDraftRecord = {
      ...draft,
      created_at: draft.created_at ?? now,
      updated_at: now
    }
    await this.db.setKeyValue(this.prefix + record.id, record)
    return record
  }

  async updateStatus(id: string, status: DecisionDraftRecord['status']): Promise<DecisionDraftRecord | null> {
    const existing = await this.getDraft(id)
    if (!existing) return null
    const updated = { ...existing, status, updated_at: new Date().toISOString() }
    await this.db.setKeyValue(this.prefix + id, updated)
    return updated
  }

  async getDraft(id: string): Promise<DecisionDraftRecord | null> {
    return this.db.getKeyValue<DecisionDraftRecord>(this.prefix + id)
  }

  async listDrafts(status?: DecisionDraftRecord['status']): Promise<DecisionDraftRecord[]> {
    const all = await this.db.listKeyPrefix(this.prefix)
    const drafts = all.map(entry => entry.value as DecisionDraftRecord)
    return status ? drafts.filter(d => d.status === status) : drafts
  }
}
