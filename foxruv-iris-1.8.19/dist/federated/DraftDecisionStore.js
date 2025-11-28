import { AgentDBManager } from '../storage/agentdb-integration.js';
export class DraftDecisionStore {
    db;
    prefix = 'draft_decisions.';
    constructor(db) {
        this.db = db ?? new AgentDBManager({ dbPath: './data/draft-decisions.db' });
    }
    async createDraft(draft) {
        const now = new Date().toISOString();
        const record = {
            ...draft,
            created_at: draft.created_at ?? now,
            updated_at: now
        };
        await this.db.setKeyValue(this.prefix + record.id, record);
        return record;
    }
    async updateStatus(id, status) {
        const existing = await this.getDraft(id);
        if (!existing)
            return null;
        const updated = { ...existing, status, updated_at: new Date().toISOString() };
        await this.db.setKeyValue(this.prefix + id, updated);
        return updated;
    }
    async getDraft(id) {
        return this.db.getKeyValue(this.prefix + id);
    }
    async listDrafts(status) {
        const all = await this.db.listKeyPrefix(this.prefix);
        const drafts = all.map(entry => entry.value);
        return status ? drafts.filter(d => d.status === status) : drafts;
    }
}
